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
from .geometry import build_surface_map, read_stl

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


def make_plan(field, tris, grid, amp=0.0, wavelength=20.0,
              reference_stl=None, smooth=2):
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

        def pre(x, y, z):
            b = bmap.query(x, y)
            if b is None:
                return z
            return (z - b) / _T(x, y) * T0      # auf Slab der Hoehe T0 abbilden

        def post(x, y, w):
            b = bmap.query(x, y)
            if b is None:
                return (x, y, w)
            return (x, y, b + (w / T0) * _T(x, y))

        def thickness_scale(x, y):
            return _T(x, y) / T0                 # lokale Dicke / Nennhoehe

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
        ref = build_surface_map(ref_tris, mode, grid, smooth)
        rmin = ref.min_value()

        def pre(x, y, z):
            r = ref.query(x, y)
            off = 0.0 if r is None else (r - rmin)
            return z - off

        def post(x, y, w):
            r = ref.query(x, y)
            off = 0.0 if r is None else (r - rmin)
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
