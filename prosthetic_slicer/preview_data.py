"""Reine Vorschau-Daten (ohne Qt): wandelt ein SliceResult in 3D-Linienzuege.

Wird von der GUI fuer die OpenGL-Vorschau und von Tests genutzt.
"""


def _resample_deform(post, x0, y0, x1, y1, w, max_seg):
    seg = ((x1 - x0) ** 2 + (y1 - y0) ** 2) ** 0.5
    n = max(1, int(seg / max_seg + 0.999))
    out = []
    for i in range(n + 1):
        t = i / n
        out.append(post(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, w))
    return out


def toolpath_polylines(result, max_seg=1.0, include_infill=True):
    """Liefert (perimeter_lines, infill_lines) als Listen von [(x,y,z), ...].

    Jeder Punkt ist bereits deformiert (echte 3D-Position)."""
    post = result.post_point
    peri_lines = []
    infill_lines = []
    for layer in result.layers:
        for poly in layer.perimeters:
            line = []
            for k in range(len(poly) - 1):
                (x0, y0), (x1, y1) = poly[k], poly[k + 1]
                seg = _resample_deform(post, x0, y0, x1, y1, layer.w, max_seg)
                if line and seg:
                    seg = seg[1:]
                line.extend(seg)
            if line:
                peri_lines.append(line)
        if include_infill:
            for (a, b) in layer.infill:
                infill_lines.append(_resample_deform(
                    post, a[0], a[1], b[0], b[1], layer.w, max_seg))
    return peri_lines, infill_lines


def zrange(lines):
    zs = [p[2] for ln in lines for p in ln]
    return (min(zs), max(zs)) if zs else (0.0, 0.0)


def mesh_wire_segments(tris):
    """Dreieckskanten als Linienpaare fuer eine dezente Mesh-Anzeige."""
    segs = []
    for (a, b, c) in tris:
        segs += [(a, b), (b, c), (c, a)]
    return segs
