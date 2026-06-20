#!/usr/bin/env python3
"""Erzeugt planaren Test-G-code: Zylinder mit gewoelbter (kugel-)Oberseite.

Dient nur zum Testen von nonplanar_warp.py. Jede Schicht ist ein Kreis-Perimeter
plus ein paar Zickzack-Infill-Linien. Die Oberseite ist eine Kuppel, sodass der
non-planare Warp etwas zum "Drapieren" hat.
"""
import math

LAYER_H = 0.4
R = 12.0          # Zylinderradius
H_CYL = 6.0       # Hoehe gerader Teil
R_DOME = R        # Kuppelradius
CX, CY = 100.0, 100.0
E_PER_MM = 0.05
FEED = 1200


def radius_at(z):
    if z <= H_CYL:
        return R
    dz = z - H_CYL
    if dz >= R_DOME:
        return 0.0
    return math.sqrt(max(0.0, R_DOME * R_DOME - dz * dz))


def circle_points(r, n=48):
    return [(CX + r * math.cos(2 * math.pi * i / n),
             CY + r * math.sin(2 * math.pi * i / n)) for i in range(n + 1)]


def main():
    lines = ['; non-planar test gcode (dome-capped cylinder)\n',
             'G21\n', 'G90\n', 'M83\n', 'G92 E0\n',
             'G1 Z0.2 F600\n']
    z = LAYER_H
    top = H_CYL + R_DOME
    while z <= top - 1e-9:
        r = radius_at(z)
        if r < 0.6:
            break
        lines.append('; LAYER z=%.3f\n' % z)
        lines.append('G1 Z%.3f F600\n' % z)
        pts = circle_points(r)
        px, py = pts[0]
        lines.append('G1 X%.3f Y%.3f F3000\n' % (px, py))
        for (x, y) in pts[1:]:
            seg = math.hypot(x - px, y - py)
            lines.append('G1 X%.3f Y%.3f E%.5f F%d\n' % (x, y, seg * E_PER_MM, FEED))
            px, py = x, y
        # einfaches Linien-Infill
        steps = int(2 * r / 2.0)
        for i in range(steps + 1):
            yy = CY - r + i * 2.0
            half = math.sqrt(max(0.0, r * r - (yy - CY) ** 2))
            if half < 0.5:
                continue
            x0, x1 = CX - half, CX + half
            lines.append('G1 X%.3f Y%.3f F3000\n' % (x0, yy))
            lines.append('G1 X%.3f Y%.3f E%.5f F%d\n'
                         % (x1, yy, (x1 - x0) * E_PER_MM, FEED))
        z += LAYER_H
    lines.append('; END\n')

    with open('test_planar.gcode', 'w') as f:
        f.writelines(lines)
    print('wrote test_planar.gcode (%d lines, top=%.2f)' % (len(lines), top))


if __name__ == '__main__':
    main()
