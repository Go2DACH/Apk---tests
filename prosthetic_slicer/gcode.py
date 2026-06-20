"""G-code-Ausgabe mit Resampling/Deformation und drei Dosier-Modi.

E-Modi:
  volumetric  -> E = abgelegtes Volumen in mm^3            (Spritzenpumpe)
  filament    -> E = mm "Filament" bei gegebenem Durchmesser
  pressure    -> kein E; konfigurierbare AN/AUS-Befehle um Extrusionsbahnen
"""

import math


def fmt(v):
    return ('%.4f' % v).rstrip('0').rstrip('.')


class GCodeWriter:
    def __init__(self, post_point, *, e_mode='volumetric', line_width=1.0,
                 layer_height=0.6, filament_d=1.75, flow=1.0, max_seg=1.0,
                 print_speed=25.0, travel_speed=40.0, z_lift=0.0,
                 pressure_on='M42 P0 S255', pressure_off='M42 P0 S0',
                 flavor='generic', start_gcode='', end_gcode=''):
        self.post = post_point
        self.e_mode = e_mode
        self.cross = line_width * layer_height
        self.area = math.pi * (filament_d * 0.5) ** 2
        self.flow = flow
        self.max_seg = max(0.2, max_seg)
        self.fp = print_speed * 60.0       # mm/min
        self.ft = travel_speed * 60.0
        self.z_lift = z_lift
        self.pon = pressure_on
        self.poff = pressure_off
        self.flavor = flavor
        self.start_gcode = start_gcode
        self.end_gcode = end_gcode
        self.out = []
        self.x = self.y = self.w = 0.0     # aktuelle nominale Position
        self.run_open = False

    # -- Helpers ---------------------------------------------------------- #
    def _e_for(self, length3d):
        if self.e_mode == 'volumetric':
            return self.cross * length3d * self.flow
        if self.e_mode == 'filament':
            return self.cross * length3d * self.flow / self.area
        return 0.0   # pressure: kein E

    def _p(self, x, y, w):
        return self.post(x, y, w)

    # -- Public ----------------------------------------------------------- #
    def header(self):
        self.out.append('; prosthetic_slicer non-planar gcode\n')
        if self.start_gcode.strip():
            self.out.append(self.start_gcode.rstrip('\n') + '\n')
        else:
            self.out += ['G21\n', 'G90\n']
            if self.e_mode != 'pressure':
                self.out.append('M83\n')      # relative Extrusion
        self.out.append('G92 E0\n' if self.e_mode != 'pressure' else '; pressure mode\n')

    def footer(self):
        self._end_run()
        if self.end_gcode.strip():
            self.out.append(self.end_gcode.rstrip('\n') + '\n')

    def comment(self, text):
        self.out.append('; ' + text + '\n')

    def travel(self, x, y, w):
        self._end_run()
        dx, dy, dz = self._p(x, y, w)
        if self.z_lift:
            self.out.append('G0 Z%s F%d\n' % (fmt(dz + self.z_lift), int(self.ft)))
        self.out.append('G0 X%s Y%s Z%s F%d\n'
                        % (fmt(dx), fmt(dy), fmt(dz), int(self.ft)))
        self.x, self.y, self.w = x, y, w

    def _begin_run(self):
        if not self.run_open and self.e_mode == 'pressure':
            self.out.append(self.pon + '\n')
        self.run_open = True

    def _end_run(self):
        if self.run_open and self.e_mode == 'pressure':
            self.out.append(self.poff + '\n')
        self.run_open = False

    def line_to(self, x, y, w):
        """Extrusionsbewegung mit Resampling + Deformation + Flussberechnung."""
        self._begin_run()
        x0, y0, w0 = self.x, self.y, self.w
        seg2d = math.hypot(x - x0, y - y0)
        n = max(1, int(seg2d / self.max_seg + 0.999))
        prev = self._p(x0, y0, w0)
        first = True
        for i in range(1, n + 1):
            t = i / n
            nx, ny, nw = x0 + (x - x0) * t, y0 + (y - y0) * t, w0 + (w - w0) * t
            dx, dy, dz = self._p(nx, ny, nw)
            l3d = math.sqrt((dx - prev[0]) ** 2 + (dy - prev[1]) ** 2
                            + (dz - prev[2]) ** 2)
            words = ['G1', 'X' + fmt(dx), 'Y' + fmt(dy), 'Z' + fmt(dz)]
            if self.e_mode != 'pressure':
                words.append('E' + fmt(self._e_for(l3d)))
            if first:
                words.append('F%d' % int(self.fp))
                first = False
            self.out.append(' '.join(words) + '\n')
            prev = (dx, dy, dz)
        self.x, self.y, self.w = x, y, w

    def polyline(self, pts, w):
        if not pts:
            return
        self.travel(pts[0][0], pts[0][1], w)
        for (x, y) in pts[1:]:
            self.line_to(x, y, w)

    def segment(self, a, b, w):
        self.travel(a[0], a[1], w)
        self.line_to(b[0], b[1], w)


def write_gcode(result, cfg):
    """Erzeugt G-code-Text aus SliceResult + RuntimeConfig (siehe config.py)."""
    gw = GCodeWriter(
        result.post_point,
        e_mode=cfg['e_mode'], line_width=cfg['line_width'],
        layer_height=cfg['layer_height'], filament_d=cfg['filament_d'],
        flow=cfg['flow'], max_seg=cfg['max_seg'],
        print_speed=cfg['print_speed'], travel_speed=cfg['travel_speed'],
        z_lift=cfg['z_lift'], pressure_on=cfg['pressure_on'],
        pressure_off=cfg['pressure_off'], flavor=cfg['flavor'],
        start_gcode=cfg['start_gcode'], end_gcode=cfg['end_gcode'])
    gw.header()
    for layer in result.layers:
        gw.comment('LAYER %d w=%.3f' % (layer.index, layer.w))
        for peri in layer.perimeters:
            gw.polyline(peri, layer.w)
        for (a, b) in layer.infill:
            gw.segment(a, b, layer.w)
    gw.footer()
    return ''.join(gw.out)
