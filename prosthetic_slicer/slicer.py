"""Slicing-Kern: (vorverformtes) Mesh planar schneiden, Konturen, Perimeter, Infill.

Liefert eine SliceResult-Struktur aus *nominalen* 2D-Bahnen je Schicht plus die
Nachverformung (post_point), die G-code/Vorschau pro Punkt anwenden.
"""

import math
from .deform import make_plan, apply_pre
from .geometry import bounds


class Layer:
    __slots__ = ('index', 'w', 'perimeters', 'infill')

    def __init__(self, index, w):
        self.index = index
        self.w = w               # nominale (gerade gezogene) Schichthoehe
        self.perimeters = []     # Liste von Polylinien [(x,y), ...] (geschlossen)
        self.infill = []         # Liste von Segmenten ((x,y),(x,y))


class SliceResult:
    def __init__(self, layers, post_point, meta):
        self.layers = layers
        self.post_point = post_point
        self.meta = meta


# --------------------------------------------------------------------------- #
#  Mesh x Ebene
# --------------------------------------------------------------------------- #

def slice_plane(tris, zc):
    segs = []
    for (a, b, c) in tris:
        pts = []
        for (p, q) in ((a, b), (b, c), (c, a)):
            dp, dq = p[2] - zc, q[2] - zc
            if (dp < 0 < dq) or (dq < 0 < dp):
                t = dp / (dp - dq)
                pts.append((p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t))
        if len(pts) == 2:
            segs.append((pts[0], pts[1]))
    return segs


def _key(p, q=1e4):
    return (round(p[0] * q), round(p[1] * q))


def stitch(segs):
    adj = {}
    for i, (p0, p1) in enumerate(segs):
        adj.setdefault(_key(p0), []).append((i, p1))
        adj.setdefault(_key(p1), []).append((i, p0))
    used = [False] * len(segs)
    loops = []
    for start in range(len(segs)):
        if used[start]:
            continue
        p0, p1 = segs[start]
        used[start] = True
        loop = [p0, p1]
        cur = p1
        while True:
            nxt = None
            for (j, other) in adj.get(_key(cur), []):
                if not used[j]:
                    nxt = (j, other); break
            if nxt is None:
                break
            j, other = nxt
            used[j] = True
            if _key(other) == _key(loop[0]):
                break
            loop.append(other)
            cur = other
        if len(loop) >= 3:
            loops.append(loop)
    return loops


def signed_area(loop):
    a = 0.0
    n = len(loop)
    for i in range(n):
        x0, y0 = loop[i]
        x1, y1 = loop[(i + 1) % n]
        a += x0 * y1 - x1 * y0
    return a * 0.5


# --------------------------------------------------------------------------- #
#  Polygon-Offset (naiv, Kanten-Normalen-Verschiebung)
# --------------------------------------------------------------------------- #

def offset_loop(loop, dist):
    """Verschiebt eine Kontur um dist nach innen (CCW positiv = innen)."""
    n = len(loop)
    if n < 3:
        return loop
    ccw = signed_area(loop) > 0
    d = dist if ccw else -dist
    moved = []
    for i in range(n):
        p_prev = loop[(i - 1) % n]
        p = loop[i]
        p_next = loop[(i + 1) % n]
        e0 = _norm_left(p_prev, p, d)
        e1 = _norm_left(p, p_next, d)
        inter = _line_intersect(e0[0], e0[1], e1[0], e1[1])
        moved.append(inter if inter else ((e0[1][0] + e1[0][0]) / 2,
                                          (e0[1][1] + e1[0][1]) / 2))
    return moved


def _norm_left(a, b, d):
    dx, dy = b[0] - a[0], b[1] - a[1]
    L = math.hypot(dx, dy)
    if L < 1e-12:
        return (a, b)
    nx, ny = -dy / L * d, dx / L * d
    return ((a[0] + nx, a[1] + ny), (b[0] + nx, b[1] + ny))


def _line_intersect(p1, p2, p3, p4):
    x1, y1 = p1; x2, y2 = p2; x3, y3 = p3; x4, y4 = p4
    den = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4)
    if abs(den) < 1e-9:
        return None
    t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / den
    return (x1 + t * (x2 - x1), y1 + t * (y2 - y1))


# --------------------------------------------------------------------------- #
#  Infill (Scanlinien, even-odd)
# --------------------------------------------------------------------------- #

def infill(loops, spacing, axis, bbox):
    if spacing <= 0 or not loops:
        return []
    xmin, ymin, xmax, ymax = bbox
    lines = []
    lo, hi = (ymin, ymax) if axis == 'x' else (xmin, xmax)
    c = lo + spacing * 0.5
    while c < hi:
        xs = []
        for loop in loops:
            n = len(loop)
            for i in range(n):
                p, q = loop[i], loop[(i + 1) % n]
                if axis == 'x':
                    y0, y1 = p[1], q[1]
                    if (y0 <= c < y1) or (y1 <= c < y0):
                        xs.append(p[0] + (q[0] - p[0]) * (c - y0) / (y1 - y0))
                else:
                    x0, x1 = p[0], q[0]
                    if (x0 <= c < x1) or (x1 <= c < x0):
                        xs.append(p[1] + (q[1] - p[1]) * (c - x0) / (x1 - x0))
        xs.sort()
        for i in range(0, len(xs) - 1, 2):
            a, b = xs[i], xs[i + 1]
            if b - a < 1e-4:
                continue
            lines.append(((a, c), (b, c)) if axis == 'x' else ((c, a), (c, b)))
        c += spacing
    return lines


# --------------------------------------------------------------------------- #
#  Hauptlauf
# --------------------------------------------------------------------------- #

def slice_model(tris, layer_height, line_width, perimeters, infill_spacing,
                field='planar', amp=0.0, wavelength=20.0, reference_stl=None,
                surface_grid=2.0, smooth=2, progress=None):
    plan = make_plan(field, tris, surface_grid, amp, wavelength,
                     reference_stl, smooth)
    work = apply_pre(tris, plan)
    _, _, wzmin, _, _, wzmax = bounds(work)
    bx0, by0, _, bx1, by1, _ = bounds(tris)
    bbox = (bx0, by0, bx1, by1)

    layers = []
    z = wzmin + layer_height * 0.5
    li = 0
    total = max(1, int((wzmax - wzmin) / layer_height))
    while z < wzmax:
        segs = slice_plane(work, z)
        if segs:
            loops = stitch(segs)
            if loops:
                layer = Layer(li, z)
                # Perimeter: nach innen versetzte Waende
                inner = loops
                for w_i in range(perimeters):
                    off = line_width * (0.5 + w_i)
                    walls = [offset_loop(lp, off) for lp in loops]
                    for wloop in walls:
                        layer.perimeters.append(wloop + [wloop[0]])
                    inner = walls
                axis = 'x' if (li % 2 == 0) else 'y'
                fill_off = line_width * (perimeters - 0.5) if perimeters else 0.0
                fill_loops = ([offset_loop(lp, fill_off) for lp in loops]
                              if perimeters else loops)
                layer.infill = infill(fill_loops, infill_spacing, axis, bbox)
                layers.append(layer)
        if progress and li % 10 == 0:
            progress(li, total)
        z += layer_height
        li += 1

    meta = {'field': field, 'layers': len(layers),
            'z_range': (wzmin, wzmax), 'bbox': bbox}
    return SliceResult(layers, plan.post_point, meta)
