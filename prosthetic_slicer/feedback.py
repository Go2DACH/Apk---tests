"""Closed-Loop: die non-planare Basis-Schicht waehrend des Drucks anpassen.

Idee: Nach (oder waehrend) des Drucks die Ist-Hoehe der schon abgelegten
Oberflaeche messen (Taster/Kamera/Laser ueber den Drucker) und die Basiskarte
b(x,y) fuer die folgenden Schichten korrigieren. Damit gleicht der Slicer
Abweichungen (Schrumpf, Durchhang im Bad, Bett-/Nadeltoleranz) live aus.

Dieses Modul liefert:
  * HeightSource  – Schnittstelle, die Ist-Hoehen liefert
  * MockHeightSource – fuer Tests/Simulation
  * MoonrakerHeightSource – Skelett-Adapter fuer Klipper/Moonraker (Hardware)
  * adjust_base_map – wendet Messwerte gedaempft + begrenzt auf eine Basiskarte an

Die korrigierte Basiskarte kann via make_plan(..., base_override=karte) bzw.
slice_model(..., base_override=karte) wieder eingespeist und neu geslict werden.
"""

import math


class HeightSource:
    """Liefert die gemessene Ist-Hoehe an Position (x,y) oder None."""
    def sample(self, x, y):
        raise NotImplementedError


class MockHeightSource(HeightSource):
    """Simulierte Messung aus einer Funktion f(x,y)->z (fuer Tests)."""
    def __init__(self, fn):
        self.fn = fn

    def sample(self, x, y):
        return self.fn(x, y)


class MoonrakerHeightSource(HeightSource):
    """Skelett-Adapter: liest Sondenergebnisse von Klipper/Moonraker.

    Benoetigt einen laufenden Drucker; offline nicht nutzbar. Der konkrete
    Mechanismus (G-code PROBE an Position, Ergebnis aus /printer/objects/query
    bzw. /server/... ) haengt von der Maschinenkonfiguration ab.
    """
    def __init__(self, base_url, session=None):
        self.base_url = base_url.rstrip('/')
        self.session = session

    def sample(self, x, y):                      # pragma: no cover (Hardware)
        raise NotImplementedError(
            'MoonrakerHeightSource benoetigt einen laufenden Drucker/Moonraker. '
            'Implementiere hier den Tast-/Abfragezyklus fuer deine Maschine.')


def adjust_base_map(smap, source, gain=1.0, max_step=2.0):
    """Korrigiert die Basiskarte anhand gemessener Ist-Hoehen (closed-loop).

    gain: Daempfung (0..1) gegen Ueberschwingen; max_step: maximale Korrektur je
    Zelle und Durchlauf (mm). Liefert die Zahl korrigierter Zellen."""
    n = 0
    for k, v in list(smap.cells.items()):
        x = k[0] * smap.grid
        y = k[1] * smap.grid
        meas = source.sample(x, y)
        if meas is None:
            continue
        delta = gain * (meas - v)
        if delta > max_step:
            delta = max_step
        elif delta < -max_step:
            delta = -max_step
        if abs(delta) > 1e-9:
            smap.cells[k] = v + delta
            n += 1
    return n
