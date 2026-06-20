"""Robuster Polygon-Offset fuer maßhaltige Perimeter und Infill-Begrenzung.

Bevorzugt wird Clipper (pyclipper): vereinigt rohe Schnittkonturen orientiert,
behandelt Loecher, entfernt Selbstueberschneidungen und versetzt korrekt nach
innen. Ist pyclipper nicht vorhanden, greift ein reiner-Python-Fallback
(Kanten-Normalen-Offset) – ausreichend fuer einfache/konvexe Querschnitte.
"""

import math

try:
    import pyclipper
    HAVE_CLIPPER = True
except Exception:            # pragma: no cover
    HAVE_CLIPPER = False

_SCALE = 10000.0


def _scaled_clean(path):
    """Skaliert + saeubert einen Pfad fuer Clipper. None wenn degeneriert."""
    p = _dedupe(path)
    if len(p) < 3:
        return None
    try:
        sp = pyclipper.scale_to_clipper(p, _SCALE)
        sp = pyclipper.CleanPolygon(sp)
    except Exception:
        return None
    if not sp or len(sp) < 3:
        return None
    return sp


def _safe_add(obj, path, *args):
    """AddPath, ungueltige/degenerierte Pfade still ueberspringen."""
    sp = _scaled_clean(path)
    if sp is None:
        return False
    try:
        obj.AddPath(sp, *args)
        return True
    except Exception:
        return False


# --------------------------------------------------------------------------- #
#  Gemeinsame Helfer
# --------------------------------------------------------------------------- #

def signed_area(loop):
    a = 0.0
    n = len(loop)
    for i in range(n):
        x0, y0 = loop[i]
        x1, y1 = loop[(i + 1) % n]
        a += x0 * y1 - x1 * y0
    return a * 0.5


def _dedupe(loop):
    out = []
    for p in loop:
        if not out or abs(p[0] - out[-1][0]) > 1e-9 or abs(p[1] - out[-1][1]) > 1e-9:
            out.append((p[0], p[1]))
    if len(out) > 1 and abs(out[0][0] - out[-1][0]) < 1e-9 \
            and abs(out[0][1] - out[-1][1]) < 1e-9:
        out.pop()
    return out


# --------------------------------------------------------------------------- #
#  Clipper-Pfad
# --------------------------------------------------------------------------- #

def _cl_normalize(loops):
    pc = pyclipper.Pyclipper()
    added = False
    for lp in loops:
        if _safe_add(pc, lp, pyclipper.PT_SUBJECT, True):
            added = True
    if not added:
        return []
    sol = pc.Execute(pyclipper.CT_UNION,
                     pyclipper.PFT_EVENODD, pyclipper.PFT_EVENODD)
    return [pyclipper.scale_from_clipper(p, _SCALE) for p in sol]


def _cl_inset(polys, dist):
    if dist <= 1e-9:
        return [list(p) for p in polys]
    co = pyclipper.PyclipperOffset()
    for p in polys:
        _safe_add(co, p, pyclipper.JT_ROUND, pyclipper.ET_CLOSEDPOLYGON)
    sol = co.Execute(-dist * _SCALE)        # negativ = nach innen
    return [pyclipper.scale_from_clipper(p, _SCALE) for p in sol]


# --------------------------------------------------------------------------- #
#  Fallback (naiv)
# --------------------------------------------------------------------------- #

def _naive_inset_loop(loop, dist):
    loop = _dedupe(loop)
    n = len(loop)
    if n < 3:
        return loop
    ccw = signed_area(loop) > 0
    d = dist if ccw else -dist
    out = []
    for i in range(n):
        a = loop[(i - 1) % n]; p = loop[i]; b = loop[(i + 1) % n]
        e0 = _norm_left(a, p, d)
        e1 = _norm_left(p, b, d)
        inter = _line_intersect(e0[0], e0[1], e1[0], e1[1])
        out.append(inter if inter else p)
    return out


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
#  Oeffentliche API
# --------------------------------------------------------------------------- #

def normalize_loops(loops):
    """Rohe Schnittkonturen -> orientierte Polygone (Aussen CCW, Loch CW)."""
    if HAVE_CLIPPER:
        return _cl_normalize(loops)
    return [_dedupe(lp) for lp in loops if len(_dedupe(lp)) >= 3]


def inset(polys, dist):
    """Versetzt Polygone um dist nach innen (Loecher waxsen mit)."""
    if HAVE_CLIPPER:
        return _cl_inset(polys, dist)
    return [_naive_inset_loop(p, dist) for p in polys]


def walls_and_infill(loops, line_width, perimeters):
    """Liefert (wall_polylines, infill_polys).

    wall_polylines: geschlossene Perimeter-Polylinien (erster Punkt am Ende
    wiederholt). infill_polys: Polygone, in denen Infill liegen darf."""
    return walls_and_infill_from_polys(normalize_loops(loops),
                                       line_width, perimeters)


def walls_and_infill_from_polys(polys, line_width, perimeters):
    """Wie walls_and_infill, aber mit bereits orientierten Polygonen (z. B.
    nachdem Entlueftungsloecher subtrahiert wurden)."""
    walls = []
    for i in range(perimeters):
        ring = inset(polys, line_width * (0.5 + i))
        for r in ring:
            if len(r) >= 3:
                walls.append(list(r) + [r[0]])
    if perimeters > 0:
        infill_polys = inset(polys, line_width * perimeters)
    else:
        infill_polys = polys
    return walls, infill_polys


# --------------------------------------------------------------------------- #
#  Boolean-Operationen (fuer Top/Bottom-Solid-Flaechen)
# --------------------------------------------------------------------------- #

def _clip(subj, clip, op):
    if not HAVE_CLIPPER:
        # Ohne Clipper keine echten Booleans -> konservativ leere/Subjekt-Menge.
        if op == 'difference':
            return [list(p) for p in subj]
        if op == 'union':
            return [list(p) for p in subj] + [list(p) for p in clip]
        return []                      # intersection unbekannt
    pc = pyclipper.Pyclipper()
    added_s = added_c = False
    for p in subj:
        if _safe_add(pc, p, pyclipper.PT_SUBJECT, True):
            added_s = True
    for p in clip:
        if _safe_add(pc, p, pyclipper.PT_CLIP, True):
            added_c = True
    cmap = {'intersection': pyclipper.CT_INTERSECTION,
            'difference': pyclipper.CT_DIFFERENCE,
            'union': pyclipper.CT_UNION}
    if op == 'intersection' and not (added_s and added_c):
        return []
    if op == 'difference' and not added_s:
        return []
    sol = pc.Execute(cmap[op], pyclipper.PFT_NONZERO, pyclipper.PFT_NONZERO)
    return [pyclipper.scale_from_clipper(p, _SCALE) for p in sol]


def intersection(a, b):
    return _clip(a, b, 'intersection')


def difference(a, b):
    return _clip(a, b, 'difference')


def union(a, b):
    return _clip(a, b, 'union')


def intersect_all(polysets):
    """Schnittmenge mehrerer Polygonmengen. Leere Liste -> leer."""
    if not polysets:
        return []
    acc = [list(p) for p in polysets[0]]
    for ps in polysets[1:]:
        if not acc:
            return []
        acc = intersection(acc, ps)
    return acc


def area(polys):
    if HAVE_CLIPPER:
        return sum(abs(pyclipper.Area(pyclipper.scale_to_clipper(_dedupe(p), _SCALE)))
                   for p in polys if len(_dedupe(p)) >= 3) / (_SCALE * _SCALE)
    return sum(abs(signed_area(_dedupe(p))) for p in polys if len(_dedupe(p)) >= 3)
