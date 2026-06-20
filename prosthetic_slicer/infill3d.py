"""3D-Infill: Gyroid (TPMS) als Iso-Kontur pro Schicht.

Die Gyroid-Flaeche  g(x,y,z) = sin x cos y + sin y cos z + sin z cos x = 0
ist ein dreifach periodisches Minimalflaechen-Gitter. Pro Schicht werten wir g
auf der (rektifizierten) Hoehe w aus und ziehen die Iso-Linie g=0 via
Marching-Squares, beschnitten auf die Sparse-Region. Da w pro Schicht waechst,
verschiebt sich das Muster kontinuierlich -> echtes 3D-Infill, das nach dem
Zurueckbiegen den gekruemmten Schichten folgt.
"""

import math


def _g(x, y, z):
    return (math.sin(x) * math.cos(y) + math.sin(y) * math.cos(z)
            + math.sin(z) * math.cos(x))


def _point_in_polys(x, y, polys):
    inside = False
    for loop in polys:
        n = len(loop)
        j = n - 1
        for i in range(n):
            xi, yi = loop[i]; xj, yj = loop[j]
            if ((yi > y) != (yj > y)) and \
               (x < (xj - xi) * (y - yi) / (yj - yi + 1e-12) + xi):
                inside = not inside
            j = i
    return inside


def gyroid_segments(region_polys, w, bbox, period=12.0, line_width=1.0):
    """Liefert Iso-Linien-Segmente des Gyroids in der Region als ((x,y),(x,y))."""
    if not region_polys:
        return []
    xmin, ymin, xmax, ymax = bbox
    f = 2 * math.pi / max(1e-3, period)
    zc = w * f
    cell = max(0.8, line_width)              # Gitteraufloesung
    nx = max(1, int((xmax - xmin) / cell))
    ny = max(1, int((ymax - ymin) / cell))
    segs = []
    for i in range(nx):
        for j in range(ny):
            x0 = xmin + i * cell; x1 = x0 + cell
            y0 = ymin + j * cell; y1 = y0 + cell
            # Eckwerte von g
            v00 = _g(x0 * f, y0 * f, zc); v10 = _g(x1 * f, y0 * f, zc)
            v11 = _g(x1 * f, y1 * f, zc); v01 = _g(x0 * f, y1 * f, zc)
            pts = []
            for (va, vb, pa, pb) in (
                    (v00, v10, (x0, y0), (x1, y0)),
                    (v10, v11, (x1, y0), (x1, y1)),
                    (v11, v01, (x1, y1), (x0, y1)),
                    (v01, v00, (x0, y1), (x0, y0))):
                if (va < 0) != (vb < 0):
                    t = va / (va - vb)
                    pts.append((pa[0] + (pb[0] - pa[0]) * t,
                                pa[1] + (pb[1] - pa[1]) * t))
            if len(pts) >= 2:
                a, b = pts[0], pts[1]
                mx, my = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2
                if _point_in_polys(mx, my, region_polys):
                    segs.append((a, b))
    return segs
