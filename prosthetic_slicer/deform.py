"""Deformationsfelder fuer non-planares Slicing.

Zwei Kategorien:

* Konforme Felder (bottom/top/reference): Das Mesh wird VOR dem Slicen vertikal
  "gerade gezogen" (Referenzflaeche flach gemacht), planar geslict und die Bahnen
  danach wieder zurueckgebogen. Dadurch bleibt die Aussenform exakt erhalten und
  nur die Schichtung folgt der Referenzflaeche.  -> ideal fuer Prothesen, die auf
  einer Koerper-/Kontaktflaeche aufliegen.

* Analytische Felder (planar/wave/dome): reine Nachverformung der planaren
  Schichten (Aussenform wird absichtlich gebogen) - vor allem zum Testen.
"""

import math
from .geometry import build_surface_map, read_stl, SurfaceMap

CONFORMAL_FIELDS = ('bottom', 'top', 'reference')
ANALYTIC_FIELDS = ('planar', 'wave', 'dome')
MORPH_FIELDS = ('morph',)
ALL_FIELDS = ANALYTIC_FIELDS + CONFORMAL_FIELDS + MORPH_FIELDS


class DeformPlan:
    """Buendelt Vor- (Mesh) und Nach- (Bahn) Verformung fuer einen Lauf."""

    def __init__(self, pre_vertex, post_point, thickness_scale=None):
        self.pre_vertex = pre_vertex      # (x,y,z) -> z'   (Mesh vor Slicing)
        self.post_point = post_point      # (x,y,w) -> (x,y,z) (Bahn nach Slicing)
        # lokale reale Schichtdicke relativ zur Nennhoehe (fuer Flusskorrektur)
        self.thickness_scale = thickness_scale or (lambda x, y: 1.0)


def _identity_pre(x, y, z):
    return z


def slope_limit_map(smap, max_angle_deg, iters=400):
    """Begrenzt den Gradienten einer Hoehenkarte auf tan(max_angle) (Nadelgrenze).

    Grayscale-Erosion: senkt Spitzen iterativ, bis kein Nachbar mehr steiler als
    die Grenze ist. Wird in pre UND post mit derselben (limitierten) Karte
    verwendet -> Aussenform bleibt erhalten, nur die Schichtung wird sanfter."""
    step = math.tan(math.radians(max(1.0, min(89.0, max_angle_deg)))) * smap.grid
    cells = smap.cells
    for _ in range(iters):
        changed = False
        for k in list(cells.keys()):
            v = cells[k]
            ix, iy = k
            for (dx, dy) in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nb = cells.get((ix + dx, iy + dy))
                if nb is not None and v - nb > step:
                    v = nb + step
                    changed = True
            cells[k] = v
        if not changed:
            break
    return smap


def make_plan(field, tris, grid, amp=0.0, wavelength=20.0,
              reference_stl=None, smooth=2, conformity=1.0, max_angle=60.0,
              base_override=None):
    """conformity (0..1): globaler Multiplikator auf die Konformitaet.
    max_angle: lokale Krummungsbegrenzung in Grad (Nadelgrenze) – die Schichten
    werden punktweise nur dort Richtung planar entspannt, wo es noetig ist."""
    """Erzeugt einen DeformPlan fuer das gewuenschte Feld."""
    x0 = min(v[0] for t in tris for v in t)
    x1 = max(v[0] for t in tris for v in t)
    y0 = min(v[1] for t in tris for v in t)
    y1 = max(v[1] for t in tris for v in t)
    cx, cy = (x0 + x1) / 2.0, (y0 + y1) / 2.0

    if field == 'planar' or (field in ANALYTIC_FIELDS and amp == 0.0):
        return DeformPlan(_identity_pre, lambda x, y, w: (x, y, w))

    if field == 'wave':
        k = 2 * math.pi / max(1e-6, wavelength)
        return DeformPlan(_identity_pre,
                          lambda x, y, w: (x, y, w + amp * math.sin(k * (x - cx))))

    if field == 'dome':
        wl = max(1e-6, wavelength)
        def post(x, y, w):
            r = math.hypot(x - cx, y - cy)
            return (x, y, w + amp * math.cos(min(math.pi / 2, r / wl * (math.pi / 2))))
        return DeformPlan(_identity_pre, post)

    # --- Morph-Feld: Schichten morphen von Boden (b) zu Decke (t) ---
    if field == 'morph':
        bmap = build_surface_map(tris, 'min', grid, smooth)
        tmap = build_surface_map(tris, 'max', grid, smooth)
        # Basisflaechen auf die Nadelgrenze neigungsbegrenzen (Krummungslimit)
        slope_limit_map(bmap, max_angle)
        slope_limit_map(tmap, max_angle)
        # Nenndicke T0 = Mittel der lokalen Dicke ueber die Footprint-Zellen
        thicks = []
        for k in bmap.cells:
            b = bmap.cells.get(k)
            t = tmap.cells.get(k)
            if b is not None and t is not None and (t - b) > 1e-6:
                thicks.append(t - b)
        T0 = (sum(thicks) / len(thicks)) if thicks else 1.0
        eps = 1e-6

        def _T(x, y):
            b = bmap.query(x, y)
            t = tmap.query(x, y)
            if b is None or t is None:
                return T0
            return max(eps, t - b)

        c = conformity

        def pre(x, y, z):
            b = bmap.query(x, y)
            if b is None:
                return z
            morph = (z - b) / _T(x, y) * T0      # auf Slab der Hoehe T0 abbilden
            return (1 - c) * z + c * morph

        def post(x, y, w):
            b = bmap.query(x, y)
            if b is None:
                return (x, y, w)
            morph = b + (w / T0) * _T(x, y)
            return (x, y, (1 - c) * w + c * morph)

        def thickness_scale(x, y):
            return 1.0 + c * (_T(x, y) / T0 - 1.0)

        return DeformPlan(pre, post, thickness_scale)

    # --- konforme Felder ---
    if field in CONFORMAL_FIELDS:
        if field == 'reference':
            if not reference_stl:
                raise ValueError('reference-Feld braucht reference_stl')
            ref_tris = read_stl(reference_stl)
            mode = 'min'
        else:
            ref_tris = tris
            mode = 'min' if field == 'bottom' else 'max'
        # base_override erlaubt eine live-korrigierte Basiskarte (closed-loop)
        ref = base_override or build_surface_map(ref_tris, mode, grid, smooth)
        slope_limit_map(ref, max_angle)         # Krummungslimit (Nadelgrenze)
        rmin = ref.min_value()
        c = conformity

        def pre(x, y, z):
            r = ref.query(x, y)
            off = 0.0 if r is None else c * (r - rmin)
            return z - off

        def post(x, y, w):
            r = ref.query(x, y)
            off = 0.0 if r is None else c * (r - rmin)
            return (x, y, w + off)

        return DeformPlan(pre, post)

    raise ValueError('unbekanntes Feld: %s' % field)


def apply_pre(tris, plan):
    """Wendet die Mesh-Vorverformung auf alle Dreiecks-Vertices an."""
    out = []
    for (a, b, c) in tris:
        out.append((
            (a[0], a[1], plan.pre_vertex(a[0], a[1], a[2])),
            (b[0], b[1], plan.pre_vertex(b[0], b[1], b[2])),
            (c[0], c[1], plan.pre_vertex(c[0], c[1], c[2])),
        ))
    return out
