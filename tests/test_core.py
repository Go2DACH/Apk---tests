"""Headless-Tests des Slicer-Kerns (ohne GUI). Mit pytest oder direkt lauffaehig."""

import os
import sys
import struct
import math
import tempfile
import re

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from prosthetic_slicer import geometry, slicer, gcode, tuning, pipeline
from prosthetic_slicer.config import AppConfig


# --------------------------------------------------------------------------- #
#  Test-STL-Helfer
# --------------------------------------------------------------------------- #

def _write_stl(path, tris):
    with open(path, 'wb') as f:
        f.write(b'\0' * 80)
        f.write(struct.pack('<I', len(tris)))
        for (a, b, c) in tris:
            f.write(struct.pack('<12fH', 0, 0, 0, *a, *b, *c, 0))


def cube(size=20.0, cx=0.0, cy=0.0, z0=0.0):
    s = size
    x0, x1 = cx - s / 2, cx + s / 2
    y0, y1 = cy - s / 2, cy + s / 2
    z1 = z0 + s
    v = [(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0),
         (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)]
    q = [(0, 1, 2, 3), (4, 7, 6, 5), (0, 4, 5, 1),
         (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)]
    t = []
    for (a, b, c, d) in q:
        t += [(v[a], v[b], v[c]), (v[a], v[c], v[d])]
    return t


def square_tube(outer=40.0, inner=16.0, h=20.0):
    """Hohles Quadratrohr (Aussen- + Innenwand) -> gelochter Querschnitt."""
    def walls(s, ccw):
        o = s / 2
        c = [(-o, -o), (o, -o), (o, o), (-o, o)]
        if not ccw:
            c = c[::-1]
        t = []
        for i in range(4):
            x0, y0 = c[i]
            x1, y1 = c[(i + 1) % 4]
            t.append(((x0, y0, 0.0), (x1, y1, 0.0), (x1, y1, h)))
            t.append(((x0, y0, 0.0), (x1, y1, h), (x0, y0, h)))
        return t
    return walls(outer, True) + walls(inner, False)


def slab_on_dome(size=40.0, thick=8.0, dome=6.0, n=20):
    """Wasserdichte Platte konstanter Dicke auf einer Kuppel-Unterseite
    (Prothesenkissen-Analogon: gekruemmte Kontaktflaeche unten)."""
    def zb(x, y):
        r = math.hypot(x, y) / (size / 2)
        return dome * max(0.0, 1 - r * r)        # Kuppel-Unterseite
    tris = []
    step = size / n
    for i in range(n):
        for j in range(n):
            x0 = -size / 2 + i * step
            y0 = -size / 2 + j * step
            x1, y1 = x0 + step, y0 + step
            for (ax, ay), (bx, by), (cx, cy) in (
                    ((x0, y0), (x1, y0), (x1, y1)),
                    ((x0, y0), (x1, y1), (x0, y1))):
                tris.append(((ax, ay, zb(ax, ay)), (bx, by, zb(bx, by)),
                             (cx, cy, zb(cx, cy))))
                tris.append(((ax, ay, zb(ax, ay) + thick),
                             (cx, cy, zb(cx, cy) + thick),
                             (bx, by, zb(bx, by) + thick)))
    # Seitenwaende entlang des Aussenrands -> wasserdicht
    h = size / 2
    edge = []
    for k in range(n + 1):
        t = -h + k * step
        edge.append((t, -h));
    for walk in (
            [(-h + k * step, -h) for k in range(n + 1)],
            [(h, -h + k * step) for k in range(n + 1)],
            [(h - k * step, h) for k in range(n + 1)],
            [(-h, h - k * step) for k in range(n + 1)]):
        for k in range(len(walk) - 1):
            (xa, ya), (xb, yb) = walk[k], walk[k + 1]
            ba, bb = zb(xa, ya), zb(xb, yb)
            tris.append(((xa, ya, ba), (xb, yb, bb), (xb, yb, bb + thick)))
            tris.append(((xa, ya, ba), (xb, yb, bb + thick), (xa, ya, ba + thick)))
    return tris


# --------------------------------------------------------------------------- #
#  Tests
# --------------------------------------------------------------------------- #

def _gcode_points(text):
    pts = []
    curz = None
    for ln in text.splitlines():
        c = ln.split(';', 1)[0]
        d = dict(re.findall(r'([XYZEF])(-?\d+\.?\d*)', c))
        if 'Z' in d:
            curz = float(d['Z'])
        if ('X' in d or 'Y' in d) and curz is not None:
            pts.append((float(d.get('X', 'nan')), float(d.get('Y', 'nan')),
                        curz, float(d.get('E', '0') or 0)))
    return pts


def test_stl_roundtrip():
    with tempfile.TemporaryDirectory() as d:
        p = os.path.join(d, 'cube.stl')
        _write_stl(p, cube())
        tris = geometry.read_stl(p)
        assert len(tris) == 12
        x0, y0, z0, x1, y1, z1 = geometry.bounds(tris)
        assert abs((x1 - x0) - 20) < 1e-4 and abs((z1 - z0) - 20) < 1e-4


def test_planar_cube_dimensions():
    cfg = AppConfig()
    cfg.process.field = 'planar'
    cfg.process.perimeters = 1
    with tempfile.TemporaryDirectory() as d:
        p = os.path.join(d, 'cube.stl')
        _write_stl(p, cube(size=20.0))
        text, result, tune = pipeline.run(p, cfg)
    pts = _gcode_points(text)
    assert len(result.layers) > 25
    # eine Schicht in der Mitte: Z konstant (planar)
    mid_z = sorted(set(round(p[2], 3) for p in pts))[len(set(p[2] for p in pts)) // 2]
    layer_pts = [p for p in pts if abs(p[2] - mid_z) < 1e-6]
    assert layer_pts, "keine Punkte in mittlerer Schicht"
    zs = set(round(p[2], 4) for p in layer_pts)
    assert len(zs) == 1, "planare Schicht muss konstantes Z haben"


def test_bottom_conformal_preserves_outer_shape_and_curves_layers():
    """Konformes Slicing: Aussenform bleibt, untere Schichten folgen der Kuppel."""
    cfg = AppConfig()
    cfg.process.field = 'bottom'
    cfg.process.perimeters = 1
    cfg.process.layer_height = 0.6
    cfg.process.surface_grid = 2.0
    with tempfile.TemporaryDirectory() as d:
        p = os.path.join(d, 'slab.stl')
        _write_stl(p, slab_on_dome())
        text, result, tune = pipeline.run(p, cfg)
    pts = _gcode_points(text)
    assert pts, "keine Bahnen erzeugt"
    # Die unterste Schicht muss in Z variieren (folgt der Kuppel) -> non-planar
    zmin_layer = min(p[2] for p in pts)
    bottom_pts = [p for p in pts if p[2] < zmin_layer + 4.0]
    z_spread = max(p[2] for p in bottom_pts) - min(p[2] for p in bottom_pts)
    assert z_spread > 1.0, "Bodenschichten sollten der Kuppel folgen (non-planar)"
    # Aussenform erhalten: XY-Ausdehnung ~ 40 mm (zentriert auf Bett 300)
    xs = [p[0] for p in pts]
    assert (max(xs) - min(xs)) > 35.0


def test_offset_holes_no_infill_in_hole():
    """Robuster Offset: Infill darf nicht ins Loch eines Querschnitts laufen."""
    from prosthetic_slicer import slicer, offset
    cfg = AppConfig()
    cfg.process.field = 'planar'
    cfg.process.perimeters = 2
    cfg.process.line_width = 1.0
    cfg.process.infill_spacing = 2.0
    inner = 16.0
    with tempfile.TemporaryDirectory() as d:
        p = os.path.join(d, 'tube.stl')
        _write_stl(p, square_tube(outer=40.0, inner=inner))
        tris = pipeline.prepare_mesh(p, cfg)
        result = pipeline.slice_mesh(tris, cfg)
    cx = cy = 150.0    # auf Bett zentriert
    half = inner / 2.0
    assert result.layers, "keine Schichten"
    bad = 0
    for layer in result.layers:
        # Perimeter: pro Schicht mindestens Aussen- und Innenwand
        assert len(layer.perimeters) >= 2
        for (a, b) in layer.infill:
            mx, my = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2
            # Mittelpunkt eines Infill-Segments darf nicht tief im Loch liegen
            if abs(mx - cx) < half - 1.0 and abs(my - cy) < half - 1.0:
                bad += 1
    assert bad == 0, "Infill laeuft ins Loch (%d Segmente)" % bad


def test_offset_module_available():
    """Offset-Modul nutzbar; mit pyclipper robuster Pfad, sonst Fallback."""
    from prosthetic_slicer import offset
    square = [[(0, 0), (10, 0), (10, 10), (0, 10)]]
    inner = offset.inset(offset.normalize_loops(square), 1.0)
    assert inner, "Offset lieferte kein Polygon"
    if not offset.HAVE_CLIPPER:
        sys.stderr.write('  (Hinweis: pyclipper fehlt -> naeherungsweiser Fallback)\n')


def test_top_bottom_solid_layers():
    """Boden-/Deckschichten werden solide, Mitte bleibt sparse."""
    cfg = AppConfig()
    cfg.process.field = 'planar'
    cfg.process.perimeters = 1
    cfg.process.line_width = 1.0
    cfg.process.infill_spacing = 8.0
    cfg.process.bottom_layers = 3
    cfg.process.top_layers = 3
    with tempfile.TemporaryDirectory() as d:
        p = os.path.join(d, 'cube.stl')
        _write_stl(p, cube(size=20.0))
        text, result, tune = pipeline.run(p, cfg)
    n = len(result.layers)
    assert n > 20
    bottom = result.layers[0]
    mid = result.layers[n // 2]
    top = result.layers[-1]
    # solide Schichten haben viel dichtere Fuellung als die sparse Mitte
    assert len(bottom.infill) > 10, "Bodenschicht nicht solide"
    assert len(top.infill) > 10, "Deckschicht nicht solide"
    assert len(mid.infill) < len(bottom.infill) / 2, "Mitte ist nicht sparse"


def wedge(size=40.0, h0=4.0, h1=16.0, n=20):
    """Keil: Dicke variiert linear ueber X (h0..h1) -> variable Schichtdicke."""
    def zt(x):
        return h0 + (h1 - h0) * (x + size / 2) / size
    tris = []
    step = size / n
    h = size / 2
    # Boden (z=0) und Decke (z=zt(x))
    for i in range(n):
        x0 = -h + i * step; x1 = x0 + step
        for y0 in (-h,):
            pass
    for i in range(n):
        x0 = -h + i * step; x1 = x0 + step
        # Boden + Decke als zwei Dreiecke ueber volle Y-Breite
        b00 = (x0, -h, 0.0); b10 = (x1, -h, 0.0); b11 = (x1, h, 0.0); b01 = (x0, h, 0.0)
        t00 = (x0, -h, zt(x0)); t10 = (x1, -h, zt(x1))
        t11 = (x1, h, zt(x1)); t01 = (x0, h, zt(x0))
        tris += [(b00, b11, b10), (b00, b01, b11)]      # Boden
        tris += [(t00, t10, t11), (t00, t11, t01)]      # Decke
        tris += [(b00, b10, t10), (b00, t10, t00)]      # Seite y=-h
        tris += [(b01, t01, t11), (b01, t11, b11)]      # Seite y=+h
    # Endkappen x=-h und x=+h
    tris += [((-h, -h, 0), (-h, h, 0), (-h, h, zt(-h))),
             ((-h, -h, 0), (-h, h, zt(-h)), (-h, -h, zt(-h)))]
    tris += [((h, -h, 0), (h, h, zt(h)), (h, h, 0)),
             ((h, -h, 0), (h, -h, zt(h)), (h, h, zt(h)))]
    return tris


def test_morph_variable_thickness_and_flow():
    """Morph-Feld: Schichtdicke variiert mit Bauteildicke; Fluss skaliert mit."""
    from prosthetic_slicer import deform, geometry
    cfg = AppConfig()
    cfg.process.field = 'morph'
    cfg.process.perimeters = 1
    cfg.process.layer_height = 0.6
    with tempfile.TemporaryDirectory() as d:
        p = os.path.join(d, 'wedge.stl')
        _write_stl(p, wedge())
        tris = pipeline.prepare_mesh(p, cfg)
        result = pipeline.slice_mesh(tris, cfg)
    # thickness_scale muss ueber X variieren (duenn vorne, dick hinten)
    ts = result.thickness_scale
    x0, y0, z0, x1, y1, z1 = geometry.bounds(tris)
    cy = (y0 + y1) / 2
    left = ts(x0 + 5, cy)
    right = ts(x1 - 5, cy)
    assert right > left * 1.5, "Schichtdicke skaliert nicht mit Bauteildicke (%.2f vs %.2f)" % (left, right)
    # G-code laeuft und enthaelt E
    text = __import__('prosthetic_slicer.gcode', fromlist=['write_gcode']).write_gcode(
        result, cfg.runtime(25.0, 40.0))
    assert ' E' in text and result.meta['layers'] > 5


def test_preview_categories_and_layer_filter():
    from prosthetic_slicer import preview_data
    cfg = AppConfig()
    cfg.process.field = 'planar'
    cfg.process.bottom_layers = 3
    cfg.process.top_layers = 3
    cfg.process.infill_spacing = 8.0
    with tempfile.TemporaryDirectory() as d:
        p = os.path.join(d, 'cube.stl')
        _write_stl(p, cube(size=20.0))
        _, result, _ = pipeline.run(p, cfg)
    peri, solid, sparse = preview_data.toolpath_polylines(result)
    assert peri and solid and sparse, "Kategorien fehlen (peri/solid/sparse)"
    nmax = preview_data.layer_count(result)
    # Filter: nur untere Haelfte -> weniger Perimeter-Linien
    p_half, _, _ = preview_data.toolpath_polylines(result, max_layer=nmax // 2)
    assert len(p_half) < len(peri)


def test_tuning_flow_limit():
    t = tuning.autotune(
        {'nozzle_d': 1.0, 'max_flow_mm3s': 15.0, 'max_speed_mms': 40.0,
         'bed_x': 300, 'bed_y': 300},
        {'line_width': 1.0, 'layer_height': 0.6})
    # cross 0.6 mm^2 -> flow speed 25 mm/s < bend 40 -> print speed 25
    assert abs(t['cross_section_mm2'] - 0.6) < 1e-6
    assert abs(t['print_speed_mms'] - 25.0) < 0.01
    assert t['travel_speed_mms'] == 40.0
    assert t['effective_flow_mm3s'] <= 15.0 + 1e-6


def test_e_modes():
    cfg = AppConfig()
    cfg.process.field = 'planar'
    with tempfile.TemporaryDirectory() as d:
        p = os.path.join(d, 'cube.stl')
        _write_stl(p, cube(size=16.0))
        for mode in ('volumetric', 'filament', 'pressure'):
            cfg.material.e_mode = mode
            text, _, _ = pipeline.run(p, cfg)
            if mode == 'pressure':
                assert cfg.material.pressure_on in text
                assert ' E' not in text  # keine E-Werte
            else:
                assert ' E' in text


def test_config_roundtrip():
    cfg = AppConfig()
    cfg.process.field = 'bottom'
    cfg.printer.max_flow_mm3s = 15.0
    with tempfile.TemporaryDirectory() as d:
        p = os.path.join(d, 'prof.json')
        cfg.save(p)
        cfg2 = AppConfig.load(p)
    assert cfg2.process.field == 'bottom'
    assert cfg2.printer.max_flow_mm3s == 15.0
    assert cfg2.printer.bed_x == 300.0


def test_bed_check():
    cfg = AppConfig()
    with tempfile.TemporaryDirectory() as d:
        p = os.path.join(d, 'big.stl')
        _write_stl(p, cube(size=400.0))
        tris = pipeline.prepare_mesh(p, cfg)
        errs = pipeline.check_fits_bed(tris, cfg)
    assert any('hoch' in e or 'breit' in e for e in errs)


if __name__ == '__main__':
    fns = [v for k, v in sorted(globals().items()) if k.startswith('test_')]
    failed = 0
    for fn in fns:
        try:
            fn()
            print('PASS', fn.__name__)
        except Exception as e:
            failed += 1
            print('FAIL', fn.__name__, '->', repr(e))
    print('\n%d/%d Tests bestanden' % (len(fns) - failed, len(fns)))
    sys.exit(1 if failed else 0)
