"""Kommandozeilen-Schnittstelle (headless): STL -> non-planarer G-code.

Nutzt dieselbe Pipeline wie die GUI. Ideal fuer Automatisierung und Tests.
"""

import argparse
import sys
from .config import AppConfig
from . import pipeline


def build_config(args):
    cfg = AppConfig.load(args.profile) if args.profile else AppConfig()
    # CLI-Overrides
    if args.field is not None:        cfg.process.field = args.field
    if args.layer_height is not None: cfg.process.layer_height = args.layer_height
    if args.line_width is not None:   cfg.process.line_width = args.line_width
    if args.perimeters is not None:   cfg.process.perimeters = args.perimeters
    if args.infill is not None:       cfg.process.infill_spacing = args.infill
    if args.top is not None:          cfg.process.top_layers = args.top
    if args.bottom is not None:       cfg.process.bottom_layers = args.bottom
    if args.amp is not None:          cfg.process.amp = args.amp
    if args.e_mode is not None:       cfg.material.e_mode = args.e_mode
    if args.reference is not None:    cfg.process.reference_stl = args.reference
    if args.pattern is not None:      cfg.process.infill_pattern = args.pattern
    if args.max_angle is not None:    cfg.process.max_surface_angle = args.max_angle
    if args.conformity is not None:   cfg.process.conformity = args.conformity
    if args.drain is not None:        cfg.process.drain_holes = args.drain
    if args.drain_d is not None:      cfg.process.drain_diameter = args.drain_d
    if args.drain_channel:            cfg.process.drain_full_channel = True
    if args.vents is not None:        cfg.process.vent_holes = args.vents
    if args.vent_d is not None:       cfg.process.vent_diameter = args.vent_d
    if args.drain_center:             cfg.process.drain_auto_position = False
    return cfg


def main(argv=None):
    ap = argparse.ArgumentParser(description='Non-planarer Silikon-Slicer (CLI).')
    ap.add_argument('stl')
    ap.add_argument('-o', '--out', required=True)
    ap.add_argument('--profile', help='Profil-JSON laden')
    ap.add_argument('--field', choices=['planar', 'bottom', 'morph', 'top',
                                        'reference', 'wave', 'dome'])
    ap.add_argument('--e-mode', dest='e_mode',
                    choices=['volumetric', 'filament', 'pressure'])
    ap.add_argument('--layer-height', type=float, dest='layer_height')
    ap.add_argument('--line-width', type=float, dest='line_width')
    ap.add_argument('--perimeters', type=int)
    ap.add_argument('--infill', type=float)
    ap.add_argument('--top', type=int, help='Anzahl Top-Solid-Schichten')
    ap.add_argument('--bottom', type=int, help='Anzahl Bottom-Solid-Schichten')
    ap.add_argument('--amp', type=float)
    ap.add_argument('--reference', help='Referenz-STL fuer field=reference')
    ap.add_argument('--pattern', choices=['lines', 'gyroid'],
                    help='Sparse-Infill-Muster')
    ap.add_argument('--max-angle', type=float, dest='max_angle',
                    help='max. Bahnneigung in Grad (Nadel-Krummungsgrenze)')
    ap.add_argument('--conformity', type=float,
                    help='globaler Konformitaets-Multiplikator 0..1')
    ap.add_argument('--drain', type=int, help='Anzahl Ablaufloecher (Gel)')
    ap.add_argument('--drain-d', type=float, dest='drain_d',
                    help='Durchmesser der Ablaufloecher in mm')
    ap.add_argument('--drain-channel', action='store_true', dest='drain_channel',
                    help='durchgehender Ablaufkanal (oben+unten) statt nur oben')
    ap.add_argument('--vents', type=int, help='seitliche Entlueftungsloecher')
    ap.add_argument('--vent-d', type=float, dest='vent_d',
                    help='Durchmesser der Entluefter in mm')
    ap.add_argument('--drain-center', action='store_true', dest='drain_center',
                    help='Ablaufloch fix in die Mitte statt auto an die Gel-Mulde')
    ap.add_argument('--report', action='store_true')
    args = ap.parse_args(argv)

    cfg = build_config(args)
    tris = pipeline.prepare_mesh(args.stl, cfg)
    errs = pipeline.check_fits_bed(tris, cfg)
    if errs:
        for e in errs:
            sys.stderr.write('FEHLER: ' + e + '\n')
        return 2

    text, result, tune = pipeline.run(args.stl, cfg)
    with open(args.out, 'w') as f:
        f.write(text)

    if args.report:
        sys.stderr.write(
            '[slicer] Feld=%s Schichten=%d | Druck %.1f mm/s, Reise %.1f mm/s, '
            'Fluss %.1f mm^3/s | max Neigung %.1f° (Limit %.0f°) -> %s\n' % (
                result.meta['field'], result.meta['layers'],
                tune['print_speed_mms'], tune['travel_speed_mms'],
                tune['effective_flow_mm3s'],
                tune.get('max_surface_angle_deg', 0.0),
                cfg.process.max_surface_angle, args.out))
        for w in tune['warnings']:
            sys.stderr.write('  ! ' + w + '\n')
    return 0


if __name__ == '__main__':
    sys.exit(main())
