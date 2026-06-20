#!/usr/bin/env python3
"""Erzeugt einfache Test-STLs (binaer): Wuerfel und Zylinder."""
import struct
import math


def write_binary_stl(path, tris):
    with open(path, 'wb') as f:
        f.write(b'\0' * 80)
        f.write(struct.pack('<I', len(tris)))
        for (a, b, c) in tris:
            # Normale grob berechnen
            ux, uy, uz = (b[0]-a[0], b[1]-a[1], b[2]-a[2])
            vx, vy, vz = (c[0]-a[0], c[1]-a[1], c[2]-a[2])
            nx, ny, nz = (uy*vz-uz*vy, uz*vx-ux*vz, ux*vy-uy*vx)
            f.write(struct.pack('<12fH', nx, ny, nz,
                                *a, *b, *c, 0))


def cube(size=20.0, cx=100, cy=100):
    s = size
    # Ecken: x,y in [cx-s/2, cx+s/2], z in [0, s]
    x0, x1 = cx - s/2, cx + s/2
    y0, y1 = cy - s/2, cy + s/2
    z0, z1 = 0.0, s
    v = [(x0,y0,z0),(x1,y0,z0),(x1,y1,z0),(x0,y1,z0),
         (x0,y0,z1),(x1,y0,z1),(x1,y1,z1),(x0,y1,z1)]
    q = [(0,1,2,3),(4,7,6,5),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)]
    tris = []
    for (a,b,c,d) in q:
        tris.append((v[a],v[b],v[c]))
        tris.append((v[a],v[c],v[d]))
    return tris


def cylinder(r=12.0, h=20.0, cx=100, cy=100, n=64):
    tris = []
    z0, z1 = 0.0, h
    pts = [(cx+r*math.cos(2*math.pi*i/n), cy+r*math.sin(2*math.pi*i/n)) for i in range(n)]
    cb, ct = (cx,cy,z0), (cx,cy,z1)
    for i in range(n):
        p, q = pts[i], pts[(i+1)%n]
        bp, bq = (p[0],p[1],z0), (q[0],q[1],z0)
        tp, tq = (p[0],p[1],z1), (q[0],q[1],z1)
        tris.append((bp, bq, tq))       # Wand
        tris.append((bp, tq, tp))
        tris.append((cb, bq, bp))       # Boden
        tris.append((ct, tp, tq))       # Deckel
    return tris


if __name__ == '__main__':
    write_binary_stl('cube.stl', cube())
    write_binary_stl('cylinder.stl', cylinder())
    print('wrote cube.stl, cylinder.stl')
