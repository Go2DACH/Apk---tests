"""Verbindet Geometrie -> Slicing -> G-code unter Beruecksichtigung von Tuning.

Diese Schicht wird von CLI und GUI gemeinsam genutzt, damit beide identisch
arbeiten (STL rein, non-planarer G-code raus)."""

from . import geometry, slicer, gcode, tuning, analysis, deform


def prepare_mesh(stl_path, cfg):
    tris = geometry.read_stl(stl_path)
    if cfg.process.center_on_bed:
        tris = geometry.center_on_bed(tris, cfg.printer.bed_x, cfg.printer.bed_y)
    return tris


def compute_tuning(cfg):
    return tuning.autotune(
        {'nozzle_d': cfg.printer.nozzle_d,
         'max_flow_mm3s': cfg.printer.max_flow_mm3s,
         'max_speed_mms': cfg.printer.max_speed_mms,
         'bed_x': cfg.printer.bed_x, 'bed_y': cfg.printer.bed_y},
        {'line_width': cfg.process.line_width,
         'layer_height': cfg.process.layer_height})


def _lowest_points(smap, n, min_sep):
    """n tiefste, ausreichend getrennte Punkte einer Hoehenkarte -> [(x,y),...]."""
    import math
    picked = []
    for (ix, iy), v in sorted(smap.cells.items(), key=lambda kv: kv[1]):
        x, y = ix * smap.grid, iy * smap.grid
        if all(math.hypot(x - px, y - py) >= min_sep for (px, py) in picked):
            picked.append((x, y))
            if len(picked) >= n:
                break
    return picked


def drain_positions(tris, cfg):
    """Automatische Lochpositionen an der tiefsten Stelle der Kontaktflaeche
    (Gel-Mulde). None -> Slicer nutzt die Standard-Mittenplatzierung."""
    p = cfg.process
    if p.drain_holes <= 0 or not p.drain_auto_position:
        return None
    tmap = geometry.build_surface_map(tris, 'max', p.surface_grid, p.smooth)
    vals = tmap.cells.values()
    if not vals or (max(vals) - min(vals)) < 1.0:      # ~flach -> Mitte
        return None
    sep = max(p.drain_diameter * 1.5, p.surface_grid * 3)
    return _lowest_points(tmap, p.drain_holes, sep)


def slice_mesh(tris, cfg, progress=None):
    p = cfg.process
    ref = p.reference_stl or None
    return slicer.slice_model(
        tris, p.layer_height, p.line_width, p.perimeters, p.infill_spacing,
        field=p.field, amp=p.amp, wavelength=p.wavelength, reference_stl=ref,
        surface_grid=p.surface_grid, smooth=p.smooth,
        top_layers=p.top_layers, bottom_layers=p.bottom_layers,
        conformity=p.conformity, max_angle=p.max_surface_angle,
        infill_pattern=p.infill_pattern, drain_holes=p.drain_holes,
        drain_diameter=p.drain_diameter, drain_full_channel=p.drain_full_channel,
        vent_holes=p.vent_holes, vent_diameter=p.vent_diameter,
        drain_positions=drain_positions(tris, cfg), progress=progress)


def permeability_check(cfg):
    """Warnt, wenn das Gel nicht ablaufen kann (zu enges Infill / kein Loch)."""
    p = cfg.process
    warns = []
    if p.infill_pattern == 'gyroid':
        pore = p.infill_spacing - p.line_width        # ~ Kanalweite
    else:
        pore = p.infill_spacing - p.line_width        # Spalt zwischen Linien
    if p.infill_spacing <= 0:
        warns.append('Infill-Abstand 0 -> dichtes Inneres, Gel kann nicht ablaufen.')
    elif pore < p.min_pore_mm:
        warns.append('Porengroesse ~%.1f mm < %.1f mm – Infill zu eng, Gel laeuft '
                     'schlecht ab (Infill-Abstand erhoehen).' % (pore, p.min_pore_mm))
    if p.drain_holes <= 0 and p.vent_holes <= 0 and \
            (p.top_layers > 0 or p.bottom_layers > 0):
        warns.append('Keine Ablauf-/Entlueftungsloecher – Solid-Schalen '
                     'versiegeln das poroese Innere, Gel bleibt eingeschlossen.')
    return warns


def run(stl_path, cfg, progress=None):
    """Voller Lauf -> (gcode_text, slice_result, tune). tune enthaelt zusaetzlich
    'max_surface_angle_deg' (erreichte Bahnneigung nach Krummungsbegrenzung)."""
    tris = prepare_mesh(stl_path, cfg)
    tune = compute_tuning(cfg)
    result = slice_mesh(tris, cfg, progress=progress)
    rt = cfg.runtime(tune['print_speed_mms'], tune['travel_speed_mms'])
    text = gcode.write_gcode(result, rt)
    ang = analysis.result_max_slope_deg(result)
    tune['max_surface_angle_deg'] = round(ang, 1)
    tune['warnings'].extend(permeability_check(cfg))
    if ang > cfg.process.max_surface_angle + 5:
        tune['warnings'].append(
            'Bahnneigung %.0f° ueber Ziel %.0f° – Oberflaechen-Raster/Glaettung '
            'erhoehen.' % (ang, cfg.process.max_surface_angle))
    return text, result, tune


def check_fits_bed(tris, cfg):
    x0, y0, z0, x1, y1, z1 = geometry.bounds(tris)
    errs = []
    if (x1 - x0) > cfg.printer.bed_x:
        errs.append('Modell zu breit (X %.1f > %.1f mm)' % (x1 - x0, cfg.printer.bed_x))
    if (y1 - y0) > cfg.printer.bed_y:
        errs.append('Modell zu tief (Y %.1f > %.1f mm)' % (y1 - y0, cfg.printer.bed_y))
    if (z1 - z0) > cfg.printer.bed_z:
        errs.append('Modell zu hoch (Z %.1f > %.1f mm)' % (z1 - z0, cfg.printer.bed_z))
    return errs
