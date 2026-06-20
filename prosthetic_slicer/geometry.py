"""Geometrie: STL lesen, Bounding-Box, Oberflaechen-Hoehenkarten (Boden/Decke)."""

import struct
import math


def read_stl(path):
    """Liest binaeres oder ASCII-STL -> Liste von Dreiecken ((x,y,z)*3)."""
    with open(path, 'rb') as f:
        data = f.read()
    if len(data) >= 84:
        n = struct.unpack_from('<I', data, 80)[0]
        if len(data) == 84 + n * 50:
            return _read_binary(data, n)
    return _read_ascii(data.decode('utf-8', 'replace'))


def _read_binary(data, n):
    tris = []
    off = 84
    for _ in range(n):
        v = struct.unpack_from('<12f', data, off)
        tris.append(((v[3], v[4], v[5]), (v[6], v[7], v[8]), (v[9], v[10], v[11])))
        off += 50
    return tris


def _read_ascii(text):
    tris, verts = [], []
    for line in text.splitlines():
        s = line.strip()
        if s.startswith('vertex'):
            p = s.split()
            verts.append((float(p[1]), float(p[2]), float(p[3])))
            if len(verts) == 3:
                tris.append((verts[0], verts[1], verts[2]))
                verts = []
    return tris


def bounds(tris):
    xs = [v[0] for t in tris for v in t]
    ys = [v[1] for t in tris for v in t]
    zs = [v[2] for t in tris for v in t]
    return (min(xs), min(ys), min(zs), max(xs), max(ys), max(zs))


def translate(tris, dx, dy, dz):
    return [tuple((v[0] + dx, v[1] + dy, v[2] + dz) for v in t) for t in tris]


def center_on_bed(tris, bed_x, bed_y):
    """Zentriert das Modell in XY auf dem Bett und setzt zmin auf 0."""
    x0, y0, z0, x1, y1, z1 = bounds(tris)
    cx = (x0 + x1) / 2.0
    cy = (y0 + y1) / 2.0
    return translate(tris, bed_x / 2.0 - cx, bed_y / 2.0 - cy, -z0)


class SurfaceMap:
    """Raster der minimalen (Boden) oder maximalen (Decke) Z-Hoehe je X/Y-Zelle,
    mit bilinearer Abfrage und Glaettung."""

    def __init__(self, grid, mode='min'):
        self.grid = grid
        self.mode = mode
        self.cells = {}

    def _key(self, x, y):
        return (int(round(x / self.grid)), int(round(y / self.grid)))

    def _put(self, x, y, z):
        k = self._key(x, y)
        cur = self.cells.get(k)
        if cur is None:
            self.cells[k] = z
        elif self.mode == 'min':
            if z < cur:
                self.cells[k] = z
        else:
            if z > cur:
                self.cells[k] = z

    def add_triangle(self, a, b, c):
        # Dreiecksflaeche grob abtasten, damit die ganze Projektion erfasst wird.
        minx = min(a[0], b[0], c[0]); maxx = max(a[0], b[0], c[0])
        miny = min(a[1], b[1], c[1]); maxy = max(a[1], b[1], c[1])
        step = self.grid * 0.5
        nx = max(1, int((maxx - minx) / step))
        ny = max(1, int((maxy - miny) / step))
        for ix in range(nx + 1):
            for iy in range(ny + 1):
                px = minx + (maxx - minx) * ix / nx
                py = miny + (maxy - miny) * iy / ny
                z = _bary_z(a, b, c, px, py)
                if z is not None:
                    self._put(px, py, z)

    def smooth(self, iterations):
        for _ in range(max(0, iterations)):
            new = {}
            for (ix, iy), z in self.cells.items():
                tot, n = z, 1
                for dx in (-1, 0, 1):
                    for dy in (-1, 0, 1):
                        if dx == 0 and dy == 0:
                            continue
                        nb = self.cells.get((ix + dx, iy + dy))
                        if nb is not None:
                            tot += nb; n += 1
                new[(ix, iy)] = tot / n
            self.cells = new

    def min_value(self):
        return min(self.cells.values()) if self.cells else 0.0

    def query(self, x, y):
        fx, fy = x / self.grid, y / self.grid
        ix = int(fx) if fx >= 0 else int(fx) - 1
        iy = int(fy) if fy >= 0 else int(fy) - 1
        tx, ty = fx - ix, fy - iy
        c = [self.cells.get((ix, iy)), self.cells.get((ix + 1, iy)),
             self.cells.get((ix, iy + 1)), self.cells.get((ix + 1, iy + 1))]
        known = [v for v in c if v is not None]
        if not known:
            return None
        avg = sum(known) / len(known)
        c = [avg if v is None else v for v in c]
        a = c[0] * (1 - tx) + c[1] * tx
        b = c[2] * (1 - tx) + c[3] * tx
        return a * (1 - ty) + b * ty


def _bary_z(a, b, c, px, py):
    """Z-Hoehe der Dreiecksebene an (px,py), falls innerhalb des Dreiecks."""
    d = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1])
    if abs(d) < 1e-12:
        return None
    l1 = ((b[1] - c[1]) * (px - c[0]) + (c[0] - b[0]) * (py - c[1])) / d
    l2 = ((c[1] - a[1]) * (px - c[0]) + (a[0] - c[0]) * (py - c[1])) / d
    l3 = 1 - l1 - l2
    if l1 < -1e-6 or l2 < -1e-6 or l3 < -1e-6:
        return None
    return l1 * a[2] + l2 * b[2] + l3 * c[2]


def build_surface_map(tris, mode, grid, smooth=2):
    sm = SurfaceMap(grid, mode)
    for (a, b, c) in tris:
        sm.add_triangle(a, b, c)
    sm.smooth(smooth)
    return sm
