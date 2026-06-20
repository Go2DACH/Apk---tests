#!/usr/bin/env python3
"""
nonplanar_slicer.py  --  Eigenstaendiger (non-planarer) STL-Slicer.

Im Gegensatz zu nonplanar_warp.py (das fertigen G-code verbiegt) schneidet
dieser Slicer das STL-Mesh selbst in Schichten und erzeugt Werkzeugbahnen.
Jeder ausgegebene Punkt laeuft durch eine Deformations-Funktion `deform(x,y,z)`:

    --field planar   ->  klassische flache Schichten (Identitaet)
    --field wave     ->  Schichten als Sinuswelle in Z  (echtes non-planares Slicing)
    --field dome     ->  Schichten als Kuppel ueber der Mitte gewoelbt

Da beim Silikon-Druck im Bad kein flaches erstes Layer noetig ist, sind global
gewoelbte Schichten physikalisch druckbar – der Deformations-Hook ist also kein
Trick, sondern direkt nutzbar.

Aufruf:
    python3 nonplanar_slicer.py modell.stl -o modell.gcode --field wave --amp 3

Stand: Slicer-Kern (Schritt A). Robust fuer konvexe/einfache Geometrien.
Polygon-Offset der Perimeter und Aussenhuellen-konforme Felder folgen als
naechster Ausbauschritt.
"""

import sys
import struct
import math
import argparse

EPS = 1e-9


# --------------------------------------------------------------------------- #
#  STL einlesen (binaer + ASCII)
# --------------------------------------------------------------------------- #

def read_stl(path):
    with open(path, 'rb') as f:
        data = f.read()
    # Binaeres STL erkennen: 84 + 50*n Bytes
    if len(data) >= 84:
        n = struct.unpack_from('<I', data, 80)[0]
        if len(data) == 84 + n * 50:
            return _read_binary(data, n)
    return _read_ascii(data.decode('utf-8', 'replace'))


def _read_binary(data, n):
    tris = []
    off = 84
    for _ in range(n):
        vals = struct.unpack_from('<12f', data, off)
        v0 = (vals[3], vals[4], vals[5])
        v1 = (vals[6], vals[7], vals[8])
        v2 = (vals[9], vals[10], vals[11])
        tris.append((v0, v1, v2))
        off += 50
    return tris


def _read_ascii(text):
    tris = []
    verts = []
    for line in text.splitlines():
        s = line.strip()
        if s.startswith('vertex'):
            parts = s.split()
            verts.append((float(parts[1]), float(parts[2]), float(parts[3])))
            if len(verts) == 3:
                tris.append((verts[0], verts[1], verts[2]))
                verts = []
    return tris


# --------------------------------------------------------------------------- #
#  Schneiden: Mesh x Ebene z = zc  ->  Segmente
# --------------------------------------------------------------------------- #

def slice_plane(tris, zc):
    segs = []
    for (a, b, c) in tris:
        pts = []
        for (p, q) in ((a, b), (b, c), (c, a)):
            dp = p[2] - zc
            dq = q[2] - zc
            if (dp < 0 and dq > 0) or (dp > 0 and dq < 0):
                t = dp / (dp - dq)
                pts.append((p[0] + (q[0] - p[0]) * t,
                            p[1] + (q[1] - p[1]) * t))
        if len(pts) == 2:
            segs.append((pts[0], pts[1]))
    return segs


# --------------------------------------------------------------------------- #
#  Segmente zu geschlossenen Konturen zusammensetzen
# --------------------------------------------------------------------------- #

def _key(p, q=1e4):
    return (round(p[0] * q), round(p[1] * q))


def stitch(segs):
    # Endpunkt -> Liste (seg_index, other_endpoint)
    adj = {}
    for i, (p0, p1) in enumerate(segs):
        adj.setdefault(_key(p0), []).append((i, p1, p0))
        adj.setdefault(_key(p1), []).append((i, p0, p1))
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
            cand = adj.get(_key(cur), [])
            nxt = None
            for (j, other, this) in cand:
                if not used[j]:
                    nxt = (j, other)
                    break
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
#  Infill: Scanlinien gegen alle Konturen (even-odd)
# --------------------------------------------------------------------------- #

def infill(loops, spacing, axis, bbox):
    xmin, ymin, xmax, ymax = bbox
    lines = []
    if axis == 'x':            # Linien parallel zu X, variierendes Y
        lo, hi, fix_lo, fix_hi = ymin, ymax, xmin, xmax
    else:                      # parallel zu Y, variierendes X
        lo, hi, fix_lo, fix_hi = xmin, xmax, ymin, ymax
    c = lo + spacing * 0.5
    while c < hi:
        xs = []
        for loop in loops:
            n = len(loop)
            for i in range(n):
                p = loop[i]
                q = loop[(i + 1) % n]
                if axis == 'x':
                    y0, y1 = p[1], q[1]
                    if (y0 <= c < y1) or (y1 <= c < y0):
                        t = (c - y0) / (y1 - y0)
                        xs.append(p[0] + (q[0] - p[0]) * t)
                else:
                    x0, x1 = p[0], q[0]
                    if (x0 <= c < x1) or (x1 <= c < x0):
                        t = (c - x0) / (x1 - x0)
                        xs.append(p[1] + (q[1] - p[1]) * t)
        xs.sort()
        for i in range(0, len(xs) - 1, 2):
            a, b = xs[i], xs[i + 1]
            if b - a < 1e-4:
                continue
            if axis == 'x':
                lines.append(((a, c), (b, c)))
            else:
                lines.append(((c, a), (c, b)))
        c += spacing
    return lines


# --------------------------------------------------------------------------- #
#  Deformationsfelder (der non-planare Kern)
# --------------------------------------------------------------------------- #

def make_deform(field, amp, wavelength, center):
    cx, cy = center
    if field == 'planar' or amp == 0.0:
        return lambda x, y, z: (x, y, z)
    if field == 'wave':
        k = 2 * math.pi / max(1e-6, wavelength)
        return lambda x, y, z: (x, y, z + amp * math.sin(k * (x - cx)))
    if field == 'dome':
        # Kuppel: in der Mitte am hoechsten, faellt mit Radius/wavelength ab.
        w = max(1e-6, wavelength)
        return lambda x, y, z: (
            x, y,
            z + amp * math.cos(min(math.pi / 2,
                                   math.hypot(x - cx, y - cy) / w * (math.pi / 2))))
    raise ValueError('unbekanntes Feld: %s' % field)


# --------------------------------------------------------------------------- #
#  G-code-Ausgabe
# --------------------------------------------------------------------------- #

def fmt(v):
    return ('%.4f' % v).rstrip('0').rstrip('.')


class GWriter:
    def __init__(self, deform, e_mode, line_w, layer_h, filament_d, flow):
        self.deform = deform
        self.e_mode = e_mode
        self.line_w = line_w
        self.layer_h = layer_h
        self.flow = flow
        area = math.pi * (filament_d * 0.5) ** 2
        self.e_per_mm = (line_w * layer_h / area * flow if e_mode == 'filament'
                         else line_w * layer_h * flow)   # volumetric: mm^3
        self.out = []
        self.x = self.y = self.z = 0.0

    def header(self):
        self.out += ['; nonplanar_slicer\n', 'G21\n', 'G90\n', 'M83\n',
                     'G92 E0\n']

    def _xyz(self, x, y, z):
        return self.deform(x, y, z)

    def travel(self, x, y, z, f=4500):
        dx, dy, dz = self._xyz(x, y, z)
        self.out.append('G0 X%s Y%s Z%s F%d\n' % (fmt(dx), fmt(dy), fmt(dz), f))
        self.x, self.y, self.z = x, y, z

    def extrude_to(self, x, y, z, f=1200):
        length = math.hypot(x - self.x, y - self.y)   # XY-Laenge der Bahn
        # Tatsaechliche 3D-Laenge nach Deformation fuer korrekten Fluss:
        sx, sy, sz = self._xyz(self.x, self.y, self.z)
        dx, dy, dz = self._xyz(x, y, z)
        l3d = math.sqrt((dx - sx) ** 2 + (dy - sy) ** 2 + (dz - sz) ** 2)
        e = l3d * self.e_per_mm
        self.out.append('G1 X%s Y%s Z%s E%s F%d\n'
                        % (fmt(dx), fmt(dy), fmt(dz), fmt(e), f))
        self.x, self.y, self.z = x, y, z

    def polyline(self, pts, z, f=1200):
        if not pts:
            return
        self.travel(pts[0][0], pts[0][1], z)
        for (x, y) in pts[1:]:
            self.extrude_to(x, y, z, f)

    def segments(self, segs, z, f=1200):
        for (a, b) in segs:
            self.travel(a[0], a[1], z)
            self.extrude_to(b[0], b[1], z, f)


# --------------------------------------------------------------------------- #
#  Slicing-Hauptlauf
# --------------------------------------------------------------------------- #

def slice_model(tris, args):
    zs = [v[2] for tri in tris for v in tri]
    xs = [v[0] for tri in tris for v in tri]
    ys = [v[1] for tri in tris for v in tri]
    zmin, zmax = min(zs), max(zs)
    bbox = (min(xs), min(ys), max(xs), max(ys))
    center = ((bbox[0] + bbox[2]) * 0.5, (bbox[1] + bbox[3]) * 0.5)

    deform = make_deform(args.field, args.amp, args.wavelength, center)
    gw = GWriter(deform, args.e_mode, args.line_width, args.layer_height,
                 args.filament_d, args.flow)
    gw.header()

    n_layers = 0
    z = zmin + args.layer_height * 0.5    # erste Schicht in Schichtmitte
    li = 0
    while z < zmax:
        segs = slice_plane(tris, z)
        if segs:
            loops = stitch(segs)
            if loops:
                gw.out.append('; LAYER %d z=%.3f\n' % (li, z))
                for loop in loops:
                    pts = loop + [loop[0]]
                    gw.polyline(pts, z)
                axis = 'x' if (li % 2 == 0) else 'y'
                fill = infill(loops, args.infill_spacing, axis, bbox)
                gw.segments(fill, z)
                n_layers += 1
        z += args.layer_height
        li += 1

    return gw.out, n_layers


def main(argv=None):
    ap = argparse.ArgumentParser(description='Non-planarer STL-Slicer.')
    ap.add_argument('stl')
    ap.add_argument('-o', '--out', required=True)
    ap.add_argument('--layer-height', type=float, default=0.4, dest='layer_height')
    ap.add_argument('--line-width', type=float, default=0.6, dest='line_width')
    ap.add_argument('--infill-spacing', type=float, default=3.0, dest='infill_spacing')
    ap.add_argument('--field', choices=['planar', 'wave', 'dome'], default='planar')
    ap.add_argument('--amp', type=float, default=0.0)
    ap.add_argument('--wavelength', type=float, default=20.0)
    ap.add_argument('--e-mode', choices=['volumetric', 'filament'],
                    default='volumetric', dest='e_mode')
    ap.add_argument('--filament-d', type=float, default=1.75, dest='filament_d')
    ap.add_argument('--flow', type=float, default=1.0)
    ap.add_argument('--report', action='store_true')
    args = ap.parse_args(argv)

    tris = read_stl(args.stl)
    if not tris:
        sys.stderr.write('Keine Dreiecke im STL gefunden.\n')
        return 1
    lines, n = slice_model(tris, args)
    with open(args.out, 'w') as f:
        f.writelines(lines)
    if args.report:
        sys.stderr.write('[nonplanar_slicer] Dreiecke=%d Schichten=%d Feld=%s '
                         'amp=%.2f -> %s (%d Zeilen)\n'
                         % (len(tris), n, args.field, args.amp,
                            args.out, len(lines)))
    return 0


if __name__ == '__main__':
    sys.exit(main())
