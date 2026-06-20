"""Slicing-Kern: (vorverformtes) Mesh planar schneiden, Konturen, Perimeter, Infill.

Liefert eine SliceResult-Struktur aus *nominalen* 2D-Bahnen je Schicht plus die
Nachverformung (post_point), die G-code/Vorschau pro Punkt anwenden.
"""

import math
from .deform import make_plan, apply_pre
from .geometry import bounds
from . import offset as offset_mod


class Layer:
    __slots__ = ('index', 'w', 'perimeters', 'solid_infill', 'sparse_infill')

    def __init__(self, index, w):
        self.index = index
        self.w = w                 # nominale (gerade gezogene) Schichthoehe
        self.perimeters = []       # Liste von Polylinien [(x,y), ...] (geschlossen)
        self.solid_infill = []     # Top/Bottom-Solid-Segmente ((x,y),(x,y))
        self.sparse_infill = []    # Sparse-Infill-Segmente

    @property
    def infill(self):
        """Kombinierte Infill-Segmente (solid + sparse)."""
        return self.solid_infill + self.sparse_infill


class SliceResult:
    def __init__(self, layers, post_point, meta, thickness_scale=None):
        self.layers = layers
        self.post_point = post_point
        self.meta = meta
        # thickness_scale(x,y) -> lokale Schichtdicke relativ zur Nennhoehe.
        self.thickness_scale = thickness_scale or (lambda x, y: 1.0)


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


# --------------------------------------------------------------------------- #
#  Infill (Scanlinien, even-odd)
# --------------------------------------------------------------------------- #

def infill(loops, spacing, axis, bbox, phase=0.0):
    """Scanlinien-Infill (even-odd). phase verschiebt die Linien pro Schicht,
    sodass sparse Infill ueber die (gekruemmten) Schichten ein 3D-Gitter bildet."""
    if spacing <= 0 or not loops:
        return []
    xmin, ymin, xmax, ymax = bbox
    lines = []
    lo, hi = (ymin, ymax) if axis == 'x' else (xmin, xmax)
    c = lo + spacing * 0.5 + (phase % spacing)
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
                surface_grid=2.0, smooth=2, top_layers=3, bottom_layers=3,
                progress=None):
    plan = make_plan(field, tris, surface_grid, amp, wavelength,
                     reference_stl, smooth)
    work = apply_pre(tris, plan)
    _, _, wzmin, _, _, wzmax = bounds(work)
    bx0, by0, _, bx1, by1, _ = bounds(tris)
    bbox = (bx0, by0, bx1, by1)

    # --- Pass A: Geometrie je Schicht sammeln (Waende + Innenregion) ---
    raw = []
    z = wzmin + layer_height * 0.5
    li = 0
    total = max(1, int((wzmax - wzmin) / layer_height))
    while z < wzmax:
        segs = slice_plane(work, z)
        if segs:
            loops = stitch(segs)
            if loops:
                walls, infill_polys = offset_mod.walls_and_infill(
                    loops, line_width, perimeters)
                raw.append({'w': z, 'walls': walls, 'region': infill_polys})
        if progress and li % 10 == 0:
            progress(li, total)
        z += layer_height
        li += 1

    # --- Pass B: Solid- (Top/Bottom) und Sparse-Bereiche bestimmen, fuellen ---
    n = len(raw)
    layers = []
    for i in range(n):
        region = raw[i]['region']
        solid = _solid_region(raw, i, n, top_layers, bottom_layers)
        sparse = offset_mod.difference(region, solid) if solid else region
        layer = Layer(i, raw[i]['w'])
        layer.perimeters = raw[i]['walls']
        axis = 'x' if (i % 2 == 0) else 'y'
        if solid:
            layer.solid_infill = infill(solid, line_width, axis, bbox)  # 100%
        if sparse and infill_spacing > 0:
            layer.sparse_infill = infill(sparse, infill_spacing, axis, bbox,
                                         phase=(i % 2) * (infill_spacing / 2.0))
        if layer.perimeters or layer.solid_infill or layer.sparse_infill:
            layers.append(layer)
        if progress and i % 10 == 0:
            progress(i, n)

    meta = {'field': field, 'layers': len(layers),
            'z_range': (wzmin, wzmax), 'bbox': bbox,
            'top_layers': top_layers, 'bottom_layers': bottom_layers}
    return SliceResult(layers, plan.post_point, meta,
                       thickness_scale=plan.thickness_scale)


def _solid_region(raw, i, n, top_layers, bottom_layers):
    """Bereich der Schicht i, der solide gefuellt werden muss (Top/Bottom-Shell).

    Mit Clipper: Flaeche, die in den N Schichten darueber/darunter nicht
    durchgehend gestuetzt ist (erfasst auch schraege Deckflaechen/Ueberhaenge).
    Ohne Clipper: die ersten/letzten N Schichten werden voll solide."""
    region = raw[i]['region']
    if not region or (top_layers <= 0 and bottom_layers <= 0):
        return []
    if not offset_mod.HAVE_CLIPPER:
        if i < bottom_layers or i >= n - top_layers:
            return [list(p) for p in region]
        return []
    solid = []
    if bottom_layers > 0:
        below = [raw[i - k]['region'] for k in range(1, bottom_layers + 1)
                 if i - k >= 0]
        if len(below) < bottom_layers:
            solid = [list(p) for p in region]          # nahe Boden: voll solide
        else:
            common = offset_mod.intersect_all(below)
            exposed = offset_mod.difference(region, common)
            solid = offset_mod.union(solid, exposed) if solid else exposed
    if top_layers > 0:
        above = [raw[i + k]['region'] for k in range(1, top_layers + 1)
                 if i + k < n]
        if len(above) < top_layers:
            return [list(p) for p in region]           # nahe Decke: voll solide
        common = offset_mod.intersect_all(above)
        exposed = offset_mod.difference(region, common)
        solid = offset_mod.union(solid, exposed) if solid else exposed
    # auf die Innenregion begrenzen
    return offset_mod.intersection(solid, region) if solid else []
