"""Konfiguration: Profile (Drucker/Material/Prozess), Speichern/Laden, Defaults.

Alle Parameter sind konfigurierbar und werden als JSON gespeichert. Die
Default-Werte spiegeln die beschriebene Maschine wider:
  Voron-Umbau, 300x300x300 mm, 1.0 mm Nadel, 15 mm^3/s, Nadel biegt > 50 mm/s.
"""

import json
import os
from dataclasses import dataclass, asdict, field


@dataclass
class PrinterProfile:
    name: str = "Voron Silikon-Umbau"
    bed_x: float = 300.0
    bed_y: float = 300.0
    bed_z: float = 300.0
    nozzle_d: float = 1.0
    max_flow_mm3s: float = 15.0
    max_speed_mms: float = 40.0          # sicher unter Biegegrenze 50 mm/s
    flavor: str = "generic"              # generic | marlin | klipper
    start_gcode: str = ""
    end_gcode: str = ""


@dataclass
class MaterialProfile:
    name: str = "Silikon (Spritzenpumpe)"
    e_mode: str = "volumetric"           # volumetric | filament | pressure
    filament_d: float = 1.75             # nur fuer e_mode=filament
    flow: float = 1.0
    pressure_on: str = "M42 P0 S255"     # nur fuer e_mode=pressure
    pressure_off: str = "M42 P0 S0"


@dataclass
class ProcessProfile:
    name: str = "Prothese non-planar"
    layer_height: float = 0.6
    line_width: float = 1.0
    perimeters: int = 2
    infill_spacing: float = 3.0
    top_layers: int = 3
    bottom_layers: int = 3
    max_seg: float = 1.0                 # Resampling-Laenge fuer Kurven
    z_lift: float = 0.0
    infill_pattern: str = "lines"        # lines | gyroid (3D, durchlaessig)
    # Ablauf des Bad-Gels: Loecher durch die Solid-Schale + poroeses Inneres
    drain_holes: int = 1                 # Anzahl Ablaufloecher oben (0 = aus)
    drain_diameter: float = 5.0          # Durchmesser je Loch (mm)
    drain_full_channel: bool = False     # True: durchgehender Kanal (oben+unten)
    drain_auto_position: bool = True     # Loch automatisch an die tiefste
    #                                      Stelle der Kontaktflaeche (Gel-Mulde)
    vent_holes: int = 0                  # seitliche Entluefter (vertikale Schlitze)
    vent_diameter: float = 4.0           # Durchmesser je Entluefter (mm)
    min_pore_mm: float = 1.0             # Warnschwelle Porengroesse (Durchlaessigkeit)
    # Non-planar
    field: str = "bottom"                # planar|bottom|morph|top|reference|wave|dome
    amp: float = 0.0                     # nur analytisch
    wavelength: float = 30.0
    reference_stl: str = ""
    surface_grid: float = 2.0
    smooth: int = 2
    center_on_bed: bool = True
    # Nadel-Krummungsbegrenzung
    conformity: float = 1.0              # 0..1, Schichten Richtung planar entspannen
    max_surface_angle: float = 45.0      # max. Bahnneigung in Grad (Nadelgrenze)
    auto_conformity: bool = True         # conformity automatisch anpassen


@dataclass
class AppConfig:
    name: str = "Standard"
    printer: PrinterProfile = field(default_factory=PrinterProfile)
    material: MaterialProfile = field(default_factory=MaterialProfile)
    process: ProcessProfile = field(default_factory=ProcessProfile)

    # -- Serialisierung -------------------------------------------------- #
    def to_dict(self):
        return {
            'name': self.name,
            'printer': asdict(self.printer),
            'material': asdict(self.material),
            'process': asdict(self.process),
        }

    @classmethod
    def from_dict(cls, d):
        return cls(
            name=d.get('name', 'Standard'),
            printer=PrinterProfile(**d.get('printer', {})),
            material=MaterialProfile(**d.get('material', {})),
            process=ProcessProfile(**d.get('process', {})),
        )

    def save(self, path):
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(self.to_dict(), f, indent=2, ensure_ascii=False)

    @classmethod
    def load(cls, path):
        with open(path, 'r', encoding='utf-8') as f:
            return cls.from_dict(json.load(f))

    # -- Laufzeit-Dict fuer den G-code-Writer ---------------------------- #
    def runtime(self, print_speed, travel_speed):
        return {
            'e_mode': self.material.e_mode,
            'line_width': self.process.line_width,
            'layer_height': self.process.layer_height,
            'filament_d': self.material.filament_d,
            'flow': self.material.flow,
            'max_seg': self.process.max_seg,
            'print_speed': print_speed,
            'travel_speed': travel_speed,
            'z_lift': self.process.z_lift,
            'pressure_on': self.material.pressure_on,
            'pressure_off': self.material.pressure_off,
            'flavor': self.printer.flavor,
            'start_gcode': self.printer.start_gcode,
            'end_gcode': self.printer.end_gcode,
        }


def config_dir():
    """Plattformabhaengiger Profilordner."""
    if os.name == 'nt':
        base = os.environ.get('APPDATA', os.path.expanduser('~'))
    else:
        base = os.environ.get('XDG_CONFIG_HOME', os.path.expanduser('~/.config'))
    d = os.path.join(base, 'ProstheticSlicer', 'profiles')
    os.makedirs(d, exist_ok=True)
    return d


def list_profiles():
    d = config_dir()
    return [f[:-5] for f in os.listdir(d) if f.endswith('.json')]


def profile_path(name):
    return os.path.join(config_dir(), name + '.json')
