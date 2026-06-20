#!/usr/bin/env python3
"""
nonplanar_warp.py  --  Non-planar / konformer Post-Processor fuer OrcaSlicer (& PrusaSlicer).

Idee
----
Ein klassischer Slicer erzeugt nur flache (planare) Schichten. Wenn man aber
Silikon durch eine Nadel in ein Fluessig-/Gelbad druckt, schwebt das Material
und braucht keine darunterliegende Schicht als Auflage. Damit darf der Druckkopf
echte 3D-Bahnen fahren.

Dieses Skript nimmt den fertigen, flach geslicten G-code und *verbiegt* die
oberen Schichten so, dass sie der gekruemmten Aussenhuelle des Modells folgen
(non-planares / konformes Slicing). Die Zielflaeche wird direkt aus dem G-code
abgeleitet: pro X/Y-Rasterzelle die hoechste extrudierte Z-Hoehe -> das ist die
gedruckte Oberkante des Objekts. Die obersten Schichten werden dann sanft auf
diese Flaeche "drapiert", sodass Treppenstufen verschwinden.

Einsatz in OrcaSlicer
---------------------
Print Settings -> Output options -> Post-processing scripts:

    /usr/bin/python3 /pfad/zu/nonplanar_warp.py --band 5 --max-seg 1.0;

OrcaSlicer/PrusaSlicer rufen das Skript mit der G-code-Datei als letztem
Argument auf; die Datei wird in-place ueberschrieben.

Parameter (alle optional)
-------------------------
  --band MM        Hoehe des Uebergangsbandes ab Oberkante, das verbogen wird.
                   0 oder negativ = gesamtes Objekt (vollkonform).  (Default 5.0)
  --grid MM        Rasterzellengroesse der Hoehenkarte.              (Default 1.0)
  --max-seg MM     Lange Bahnen werden in Stuecke <= MM zerlegt,
                   damit der Warp der Kurve glatt folgt.             (Default 1.0)
  --smooth N       Glaettungsdurchlaeufe der Hoehenkarte.            (Default 2)
  --flow MODE      conform  = E-Menge an laengeren 3D-Pfad anpassen (Default)
                   preserve = E-Menge unveraendert lassen.
  --out FILE       Ausgabe in separate Datei (Default: in-place).
  --report         Statistik nach stderr ausgeben.
"""

import sys
import os
import argparse
import tempfile

# --------------------------------------------------------------------------- #
#  G-code Parsing-Helfer
# --------------------------------------------------------------------------- #

def split_code_comment(line):
    """Zerlegt eine Zeile in (code, comment_inkl_strichpunkt)."""
    idx = line.find(';')
    if idx == -1:
        return line, ''
    return line[:idx], line[idx:]


def parse_words(code):
    """Parst G-code-Woerter wie G1/X/Y/Z/E/F in ein dict. Erstes Wort = Befehl."""
    parts = code.split()
    if not parts:
        return None, {}
    cmd = parts[0].upper()
    params = {}
    for p in parts[1:]:
        if len(p) < 1:
            continue
        letter = p[0].upper()
        try:
            params[letter] = float(p[1:])
        except ValueError:
            params[letter] = None
    return cmd, params


# --------------------------------------------------------------------------- #
#  Hoehenkarte (Zielflaeche)
# --------------------------------------------------------------------------- #

class HeightMap:
    """Raster der hoechsten extrudierten Z-Hoehe je X/Y-Zelle."""

    def __init__(self, grid):
        self.grid = grid
        self.cells = {}          # (ix, iy) -> max_z
        self.ix_min = self.ix_max = None
        self.iy_min = self.iy_max = None

    def _key(self, x, y):
        return (int(round(x / self.grid)), int(round(y / self.grid)))

    def add(self, x, y, z):
        k = self._key(x, y)
        if k not in self.cells or z > self.cells[k]:
            self.cells[k] = z
        ix, iy = k
        if self.ix_min is None:
            self.ix_min = self.ix_max = ix
            self.iy_min = self.iy_max = iy
        else:
            self.ix_min = min(self.ix_min, ix)
            self.ix_max = max(self.ix_max, ix)
            self.iy_min = min(self.iy_min, iy)
            self.iy_max = max(self.iy_max, iy)

    def add_segment(self, x0, y0, x1, y1, z):
        """Tastet eine Extrusionsbahn ab, damit die ganze Flaeche erfasst wird."""
        dx, dy = x1 - x0, y1 - y0
        length = (dx * dx + dy * dy) ** 0.5
        steps = max(1, int(length / (self.grid * 0.5)))
        for s in range(steps + 1):
            t = s / steps
            self.add(x0 + dx * t, y0 + dy * t, z)

    def smooth(self, iterations):
        """Einfache Nachbarschaftsglaettung (nur ueber bekannte Zellen)."""
        for _ in range(max(0, iterations)):
            new = {}
            for (ix, iy), z in self.cells.items():
                total, n = z, 1
                for dx in (-1, 0, 1):
                    for dy in (-1, 0, 1):
                        if dx == 0 and dy == 0:
                            continue
                        nb = self.cells.get((ix + dx, iy + dy))
                        if nb is not None:
                            total += nb
                            n += 1
                new[(ix, iy)] = total / n
            self.cells = new

    def query(self, x, y):
        """Bilineare Interpolation der Flaechenhoehe. None wenn unbekannt."""
        fx = x / self.grid
        fy = y / self.grid
        ix = int(fx) if fx >= 0 else int(fx) - 1
        iy = int(fy) if fy >= 0 else int(fy) - 1
        tx = fx - ix
        ty = fy - iy
        c00 = self.cells.get((ix, iy))
        c10 = self.cells.get((ix + 1, iy))
        c01 = self.cells.get((ix, iy + 1))
        c11 = self.cells.get((ix + 1, iy + 1))
        # Fehlende Ecken durch den Mittelwert der vorhandenen ersetzen.
        known = [c for c in (c00, c10, c01, c11) if c is not None]
        if not known:
            return None
        avg = sum(known) / len(known)
        c00 = avg if c00 is None else c00
        c10 = avg if c10 is None else c10
        c01 = avg if c01 is None else c01
        c11 = avg if c11 is None else c11
        a = c00 * (1 - tx) + c10 * tx
        b = c01 * (1 - tx) + c11 * tx
        return a * (1 - ty) + b * ty


# --------------------------------------------------------------------------- #
#  Pass 1: Hoehenkarte aufbauen
# --------------------------------------------------------------------------- #

def build_height_map(lines, grid):
    hm = HeightMap(grid)
    abs_xyz = True
    x = y = z = 0.0
    z_top = None
    z_min_print = None

    for raw in lines:
        code, _ = split_code_comment(raw)
        cmd, p = parse_words(code)
        if cmd is None:
            continue
        if cmd == 'G90':
            abs_xyz = True
            continue
        if cmd == 'G91':
            abs_xyz = False
            continue
        if cmd in ('G0', 'G1'):
            nx = p['X'] if 'X' in p else (x if abs_xyz else 0.0)
            ny = p['Y'] if 'Y' in p else (y if abs_xyz else 0.0)
            nz = p['Z'] if 'Z' in p else (z if abs_xyz else 0.0)
            if abs_xyz:
                tx, ty, tz = nx, ny, nz
            else:
                tx, ty, tz = x + nx, y + ny, z + nz
            extruding = ('E' in p and p['E'] is not None and
                         (p['E'] > 0 if not abs_xyz else True))
            # Extrusion erkennen: E vorhanden; bei absolutem E ohne Vorwert
            # nehmen wir an, dass ein E in einer XY-Bewegung Extrusion ist.
            if 'E' in p and ('X' in p or 'Y' in p):
                hm.add_segment(x, y, tx, ty, tz)
                if z_top is None or tz > z_top:
                    z_top = tz
                if z_min_print is None or tz < z_min_print:
                    z_min_print = tz
            x, y, z = tx, ty, tz

    return hm, z_top, z_min_print


# --------------------------------------------------------------------------- #
#  Warp-Funktion
# --------------------------------------------------------------------------- #

class Warper:
    def __init__(self, hm, z_top, band):
        self.hm = hm
        self.z_top = z_top
        self.band = band
        self.band_bottom = z_top - band

    def warp_z(self, x, y, z):
        if z <= self.band_bottom:
            return z
        h = self.hm.query(x, y)
        if h is None:
            return z
        t = (z - self.band_bottom) / self.band
        if t < 0.0:
            t = 0.0
        elif t > 1.0:
            t = 1.0
        return z + t * (h - self.z_top)


# --------------------------------------------------------------------------- #
#  Pass 2: G-code neu schreiben (warpen + resampeln)
# --------------------------------------------------------------------------- #

def fmt(v):
    """Kompakte Zahlenformatierung."""
    return ('%.5f' % v).rstrip('0').rstrip('.')


def process(lines, warper, max_seg, flow_conform):
    out = []
    abs_xyz = True
    abs_e = True
    x = y = z = e = 0.0
    stats = {'moves': 0, 'resampled': 0, 'warped': 0}

    for raw in lines:
        code, comment = split_code_comment(raw)
        cmd, p = parse_words(code)

        if cmd is None:
            out.append(raw)
            continue
        if cmd == 'G90':
            abs_xyz = True
            out.append(raw); continue
        if cmd == 'G91':
            abs_xyz = False
            out.append(raw); continue
        if cmd == 'M82':
            abs_e = True
            out.append(raw); continue
        if cmd == 'M83':
            abs_e = False
            out.append(raw); continue
        if cmd == 'G92':
            if 'E' in p and p['E'] is not None:
                e = p['E']
            if 'X' in p and p['X'] is not None: x = p['X']
            if 'Y' in p and p['Y'] is not None: y = p['Y']
            if 'Z' in p and p['Z'] is not None: z = p['Z']
            out.append(raw); continue
        if cmd not in ('G0', 'G1'):
            out.append(raw); continue

        # --- Bewegungsbefehl ---
        has_x = 'X' in p and p['X'] is not None
        has_y = 'Y' in p and p['Y'] is not None
        has_z = 'Z' in p and p['Z'] is not None
        has_e = 'E' in p and p['E'] is not None
        has_f = 'F' in p and p['F'] is not None

        if abs_xyz:
            tx = p['X'] if has_x else x
            ty = p['Y'] if has_y else y
            tz = p['Z'] if has_z else z
        else:
            tx = x + (p['X'] if has_x else 0.0)
            ty = y + (p['Y'] if has_y else 0.0)
            tz = z + (p['Z'] if has_z else 0.0)

        # Extrusionsdelta (absolut) bestimmen
        if has_e:
            if abs_e:
                delta_e = p['E'] - e
                e_after = p['E']
            else:
                delta_e = p['E']
                e_after = e + p['E']
        else:
            delta_e = 0.0
            e_after = e

        feed = p['F'] if has_f else None
        stats['moves'] += 1

        # Komplett unterhalb des Uebergangsbandes: nichts zu tun, 1:1 durchreichen.
        if max(z, tz) <= warper.band_bottom:
            out.append(raw)
            x, y, z, e = tx, ty, tz, e_after
            continue

        xy_len = ((tx - x) ** 2 + (ty - y) ** 2) ** 0.5

        # Schneller Pfad: nichts oben passiert -> nur Z warpen, kein Resample.
        # (Pure-Z-Bewegungen, Retraktionen, Bewegungen unterhalb des Bandes.)
        warped_tz = warper.warp_z(tx, ty, tz)
        if xy_len < 1e-9 or xy_len <= max_seg:
            if abs(warped_tz - tz) > 1e-9:
                stats['warped'] += 1
            out.append(_emit(cmd, has_x, tx, has_y, ty,
                             (has_z or abs(warped_tz - tz) > 1e-9), warped_tz,
                             has_e, delta_e, abs_e, e, feed, comment, abs_xyz, x, y, z))
            x, y, z, e = tx, ty, warped_tz, e_after
            continue

        # --- Lange Bahn: in Teilstuecke zerlegen und jeden Punkt warpen ---
        n = max(1, int(xy_len / max_seg + 0.999))
        # Gewarpte Polylinie samt 3D-Laengen berechnen
        pts = []
        px, py, pz = x, y, z
        seg_lens = []
        prev = (x, y, warper.warp_z(x, y, z))
        for i in range(1, n + 1):
            t = i / n
            ix_ = x + (tx - x) * t
            iy_ = y + (ty - y) * t
            iz_ = z + (tz - z) * t
            wz = warper.warp_z(ix_, iy_, iz_)
            pts.append((ix_, iy_, wz))
            seg_lens.append((((ix_ - prev[0]) ** 2 + (iy_ - prev[1]) ** 2 +
                              (wz - prev[2]) ** 2) ** 0.5))
            prev = (ix_, iy_, wz)

        total_3d = sum(seg_lens) or 1e-9
        planar_len = xy_len or 1e-9

        if flow_conform:
            e_total = delta_e * (total_3d / planar_len)
        else:
            e_total = delta_e

        stats['resampled'] += 1
        stats['warped'] += 1

        run_e = e
        first = True
        for (ix_, iy_, wz), seglen in zip(pts, seg_lens):
            seg_e = e_total * (seglen / total_3d) if delta_e != 0.0 else 0.0
            if abs_e:
                run_e += seg_e
                e_val = run_e
            else:
                e_val = seg_e
            words = [cmd]
            words.append('X' + fmt(ix_))
            words.append('Y' + fmt(iy_))
            words.append('Z' + fmt(wz))
            if delta_e != 0.0:
                words.append('E' + fmt(e_val))
            if first and feed is not None:
                words.append('F' + fmt(feed))
            line = ' '.join(words)
            if first and comment:
                line += ' ' + comment
            out.append(line + '\n')
            first = False

        x, y, z = tx, ty, warper.warp_z(tx, ty, tz)
        e = e_after

    return out, stats


def _emit(cmd, has_x, tx, has_y, ty, emit_z, tz,
          has_e, delta_e, abs_e, e_prev, feed, comment, abs_xyz, x, y, z):
    """Baut eine einzelne (nicht resampelte) Bewegungszeile mit gewarptem Z neu."""
    words = [cmd]
    if has_x:
        words.append('X' + fmt(tx if abs_xyz else tx - x))
    if has_y:
        words.append('Y' + fmt(ty if abs_xyz else ty - y))
    if emit_z:
        words.append('Z' + fmt(tz if abs_xyz else tz - z))
    if has_e:
        if abs_e:
            words.append('E' + fmt(e_prev + delta_e))
        else:
            words.append('E' + fmt(delta_e))
    if feed is not None:
        words.append('F' + fmt(feed))
    line = ' '.join(words)
    if comment:
        line += ' ' + comment
    return line + '\n'


# --------------------------------------------------------------------------- #
#  Main
# --------------------------------------------------------------------------- #

def main(argv=None):
    ap = argparse.ArgumentParser(description='Non-planarer G-code Post-Processor.')
    ap.add_argument('gcode', help='G-code-Datei (von Orca/Prusa als letztes Arg).')
    ap.add_argument('--band', type=float, default=5.0)
    ap.add_argument('--grid', type=float, default=1.0)
    ap.add_argument('--max-seg', type=float, default=1.0, dest='max_seg')
    ap.add_argument('--smooth', type=int, default=2)
    ap.add_argument('--flow', choices=['conform', 'preserve'], default='conform')
    ap.add_argument('--out', default=None)
    ap.add_argument('--report', action='store_true')
    args = ap.parse_args(argv)

    with open(args.gcode, 'r') as f:
        lines = f.readlines()

    hm, z_top, z_min = build_height_map(lines, args.grid)
    if z_top is None:
        sys.stderr.write('[nonplanar_warp] Keine Extrusion gefunden – unveraendert.\n')
        return 0

    band = args.band if args.band and args.band > 0 else (z_top - (z_min or 0.0))
    if band <= 0:
        band = 1e-6
    hm.smooth(args.smooth)

    warper = Warper(hm, z_top, band)
    out_lines, stats = process(lines, warper, args.max_seg, args.flow == 'conform')

    target = args.out or args.gcode
    # Sicher schreiben: erst temp, dann ersetzen.
    d = os.path.dirname(os.path.abspath(target))
    fd, tmp = tempfile.mkstemp(dir=d, suffix='.tmp')
    with os.fdopen(fd, 'w') as f:
        f.writelines(out_lines)
    os.replace(tmp, target)

    if args.report:
        sys.stderr.write(
            '[nonplanar_warp] z_top=%.3f band=%.3f cells=%d | '
            'moves=%d warped=%d resampled=%d\n' % (
                z_top, band, len(hm.cells),
                stats['moves'], stats['warped'], stats['resampled']))
    return 0


if __name__ == '__main__':
    sys.exit(main())
