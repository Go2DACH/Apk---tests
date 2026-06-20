"""Analyse der Bahnneigung (fuer die Nadel-Krummungsgrenze).

Die 40-cm-Nadel druckt im Wesentlichen vertikal; zu steile (non-planare)
Schichten sind nicht erreichbar/kollidieren. Hier schaetzen wir die maximale
Flaechenneigung der Deformation und passen die Konformitaet so an, dass sie
unter einer konfigurierbaren Grenze bleibt.
"""

import math
from . import deform


def max_slope_deg(post_point, bbox, w_levels, n=36):
    """Schaetzt die maximale Neigung |dz/dxy| (in Grad) der deformierten Flaeche
    durch Abtasten von post_point ueber ein Gitter bei mehreren w-Hoehen."""
    x0, y0, x1, y1 = bbox
    if x1 <= x0 or y1 <= y0:
        return 0.0
    dx = (x1 - x0) / n
    dy = (y1 - y0) / n
    h = min(dx, dy) * 0.5 or 1.0
    maxslope = 0.0
    for w in w_levels:
        for i in range(n + 1):
            x = x0 + i * dx
            for j in range(n + 1):
                y = y0 + j * dy
                z = post_point(x, y, w)[2]
                zx = post_point(x + h, y, w)[2]
                zy = post_point(x, y + h, w)[2]
                gx = (zx - z) / h
                gy = (zy - z) / h
                s = math.hypot(gx, gy)
                if s > maxslope:
                    maxslope = s
    return math.degrees(math.atan(maxslope))


def result_max_slope_deg(result, min_xy=0.5):
    """Maximale Bahnneigung (Grad) gemessen an den tatsaechlichen Werkzeugbahnen
    (deformierte, aufeinanderfolgende Punkte). Vermeidet Footprint-Artefakte."""
    post = result.post_point
    maxs = 0.0
    for layer in result.layers:
        polys = list(layer.perimeters) + \
            [[a, b] for (a, b) in (layer.solid_infill + layer.sparse_infill)]
        for poly in polys:
            prev = None
            for (x, y) in poly:
                p = post(x, y, layer.w)
                if prev is not None:
                    dxy = math.hypot(p[0] - prev[0], p[1] - prev[1])
                    if dxy > min_xy:
                        s = abs(p[2] - prev[2]) / dxy
                        if s > maxs:
                            maxs = s
                prev = p
    return math.degrees(math.atan(maxs))


def plan_slope_deg(field, tris, bbox, grid, smooth, conformity, max_angle,
                   amp=0.0, wavelength=20.0, reference_stl=None):
    plan = deform.make_plan(field, tris, grid, amp, wavelength,
                            reference_stl, smooth, conformity, max_angle)
    z0 = min(v[2] for t in tris for v in t)
    z1 = max(v[2] for t in tris for v in t)
    span = max(1e-3, z1 - z0)
    w_levels = [z0 + span * f for f in (0.1, 0.5, 0.9)]
    return max_slope_deg(plan.post_point, bbox, w_levels), plan
