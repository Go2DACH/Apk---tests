"""Selbst-Tuning: sichere Geschwindigkeiten/Flussgrenzen aus den Maschinendaten.

Bindende Grenze ist das Minimum aus:
  * Biegegrenze der Nadel  (max_speed_mms)
  * Flussgrenze            (max_flow_mm3s / Bahnquerschnitt)
"""


def cross_section(line_width, layer_height):
    # Rechteck-Naeherung; konservativ (real etwas groesser durch Rundungen).
    return line_width * layer_height


def autotune(printer, process):
    """printer: dict mit nozzle_d, max_flow_mm3s, max_speed_mms, bed_*.
    process: dict mit line_width, layer_height.
    Liefert empfohlene Geschwindigkeiten + Warnungen."""
    lw = process['line_width']
    lh = process['layer_height']
    nozzle = printer['nozzle_d']
    cs = cross_section(lw, lh)

    flow_speed = printer['max_flow_mm3s'] / cs if cs > 0 else printer['max_speed_mms']
    bend_speed = printer['max_speed_mms']
    print_speed = min(flow_speed, bend_speed)
    travel_speed = bend_speed                      # Nadel biegt auch bei Reise

    warnings = []
    if lw < nozzle * 0.9:
        warnings.append('Bahnbreite %.2f < Duesendurchmesser %.2f mm – '
                        'Unterextrusion moeglich.' % (lw, nozzle))
    if lw > nozzle * 2.0:
        warnings.append('Bahnbreite %.2f > 2x Duese %.2f mm – schlechte Haftung.'
                        % (lw, nozzle))
    if lh > nozzle * 0.85:
        warnings.append('Schichthoehe %.2f > 0.85x Duese %.2f mm – riskant.'
                        % (lh, nozzle))
    if flow_speed < bend_speed:
        warnings.append('Fluss begrenzt die Geschwindigkeit auf %.1f mm/s '
                        '(unter Biegegrenze %.1f mm/s).' % (flow_speed, bend_speed))
    else:
        warnings.append('Biegegrenze der Nadel begrenzt auf %.1f mm/s.'
                        % bend_speed)

    return {
        'cross_section_mm2': cs,
        'flow_limited_speed_mms': flow_speed,
        'bend_limited_speed_mms': bend_speed,
        'print_speed_mms': round(print_speed, 2),
        'travel_speed_mms': round(travel_speed, 2),
        'effective_flow_mm3s': round(print_speed * cs, 2),
        'warnings': warnings,
    }
