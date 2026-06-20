#!/usr/bin/env python3
"""Erzeugt eine realistische Brustorthesen-STL (wasserdicht, binaer).

Druckorientierung: Brustwarze nach UNTEN (konvexe Aussenflaeche unten),
Narben-/Brustwand-Kontaktflaeche OBEN (konkav). Damit kruemmt sich das Teil
unten und oben in *entgegengesetzte* Richtungen -> idealer Morph-Fall.

Geometrie (alles in mm, zentriert auf 300er-Bett):
  Bodenflaeche  zb(r) = H_dome*(1 - sqrt(1-(r/R)^2))   konvex, Apex (Warze) unten
  Deckflaeche   zt(r) = H_total - C*(1-(r/R)^2)         konkav (Brustwand)
  Wandstaerke   zt-zb  variiert (Mitte dick, Rand duenn) -> variable Schichtdicke
"""
import struct
import math

R = 70.0          # Basisradius
H_DOME = 40.0     # Hoehe der konvexen Brustflaeche
H_TOTAL = 70.0    # Hoehe der Deckflaeche am Rand
C = 15.0          # Konkavitaet der Kontaktflaeche (Brustwand-Mulde)
CX, CY = 150.0, 150.0
NR, NS = 28, 64   # Ringe, Sektoren


def zb(r):
    r = min(r, R)
    return H_DOME * (1.0 - math.sqrt(max(0.0, 1.0 - (r / R) ** 2)))


def zt(r):
    r = min(r, R)
    return H_TOTAL - C * (1.0 - (r / R) ** 2)


def pt(r, ang, z):
    return (CX + r * math.cos(ang), CY + r * math.sin(ang), z)


def build():
    tris = []
    ring = lambda i: R * i / NR
    ang = lambda j: 2 * math.pi * j / NS

    # Boden (konvex, nach unten zeigend) – Fan + Quad-Ringe
    apex_b = (CX, CY, zb(0))
    for j in range(NS):
        a0, a1 = ang(j), ang(j + 1)
        # innerster Fan
        tris.append((apex_b, pt(ring(1), a1, zb(ring(1))), pt(ring(1), a0, zb(ring(1)))))
    for i in range(1, NR):
        ri, ro = ring(i), ring(i + 1)
        for j in range(NS):
            a0, a1 = ang(j), ang(j + 1)
            p00 = pt(ri, a0, zb(ri)); p01 = pt(ri, a1, zb(ri))
            p10 = pt(ro, a0, zb(ro)); p11 = pt(ro, a1, zb(ro))
            tris.append((p00, p11, p01))
            tris.append((p00, p10, p11))

    # Decke (konkav, nach oben) – umgekehrte Orientierung
    apex_t = (CX, CY, zt(0))
    for j in range(NS):
        a0, a1 = ang(j), ang(j + 1)
        tris.append((apex_t, pt(ring(1), a0, zt(ring(1))), pt(ring(1), a1, zt(ring(1)))))
    for i in range(1, NR):
        ri, ro = ring(i), ring(i + 1)
        for j in range(NS):
            a0, a1 = ang(j), ang(j + 1)
            p00 = pt(ri, a0, zt(ri)); p01 = pt(ri, a1, zt(ri))
            p10 = pt(ro, a0, zt(ro)); p11 = pt(ro, a1, zt(ro))
            tris.append((p00, p01, p11))
            tris.append((p00, p11, p10))

    # Rand-Wand zwischen Boden- und Deckrand (wasserdicht)
    for j in range(NS):
        a0, a1 = ang(j), ang(j + 1)
        b0 = pt(R, a0, zb(R)); b1 = pt(R, a1, zb(R))
        t0 = pt(R, a0, zt(R)); t1 = pt(R, a1, zt(R))
        tris.append((b0, b1, t1))
        tris.append((b0, t1, t0))
    return tris


def write_binary_stl(path, tris):
    with open(path, 'wb') as f:
        f.write(b'\0' * 80)
        f.write(struct.pack('<I', len(tris)))
        for (a, b, c) in tris:
            ux, uy, uz = (b[0]-a[0], b[1]-a[1], b[2]-a[2])
            vx, vy, vz = (c[0]-a[0], c[1]-a[1], c[2]-a[2])
            nx, ny, nz = (uy*vz-uz*vy, uz*vx-ux*vz, ux*vy-uy*vx)
            f.write(struct.pack('<12fH', nx, ny, nz, *a, *b, *c, 0))


if __name__ == '__main__':
    tris = build()
    write_binary_stl('breast_orthosis.stl', tris)
    print('wrote breast_orthosis.stl (%d tris)' % len(tris))
    print('Wandstaerke Mitte=%.1f mm, Rand=%.1f mm' % (zt(0)-zb(0), zt(R)-zb(R)))
