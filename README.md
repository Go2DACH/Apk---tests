# Non-Planar Silicone Slicer

Windows-Anwendung (mit 3D-Vorschau) und Slicer-Engine, die ein **STL direkt in
non-planaren G-code** für Silikon-Druck im Bad umwandelt — gedacht für
Prothesenkissen (z. B. zwischen Narbe und Metall, Brust-/Fußprothesen) auf einem
Voron-Umbau (300×300×300 mm, 1,0 mm Nadel, 15 mm³/s, Nadel biegt > 50 mm/s).

> **Ziel:** STL rein → non-planarer G-code raus. Die Schichten folgen der
> **Bodenfläche** des Bauteils (konforme Schichtung, Außenform bleibt exakt
> erhalten), sodass die Kontaktfläche der Anatomie folgt.

## Komponenten

| Teil | Zweck |
|------|-------|
| **GUI-App** (`prosthetic_slicer/`) | STL laden, alle Parameter konfigurieren + als Profil speichern, slicen, 3D-Vorschau, G-code exportieren. Start: `python -m prosthetic_slicer` oder über den Windows-Installer. |
| **CLI** (`prosthetic_slicer.cli`) | Headless: `python -m prosthetic_slicer.cli modell.stl -o out.gcode --field bottom --report` |
| **Slicer-Kern** | Reines Python (keine schweren Abhängigkeiten): STL→Konturen→Perimeter/Infill→3D-G-code mit Deformations-Hook. |
| `nonplanar_warp.py` | Älteres Post-Processing-Skript für OrcaSlicer/PrusaSlicer (siehe unten). |
| `nonplanar_slicer.py` | Früherer eigenständiger Slicer-Prototyp (siehe unten). |

## Wichtige Eigenschaften

- **Selbst-Tuning:** Druckgeschwindigkeit = min(Flussgrenze, Biegegrenze). Bei
  1,0 mm × 0,6 mm Querschnitt → 15 ÷ 0,6 = **25 mm/s** (unter der 40-mm/s-Kappung
  für die biegende Nadel). Reisewege ebenfalls gekappt.
- **Drei Dosier-Modi:** `volumetric` (mm³, Spritzenpumpe), `filament` (mm),
  `pressure` (Druck/Zeit über konfigurierbare AN/AUS-Befehle).
- **Konforme & analytische Felder:** `bottom`/`top`/`reference` (formerhaltend),
  `morph` (Schichten morphen von Boden- zu Deckform → multidirektionale Krümmung
  + variable Schichtdicke mit Flusskorrektur), `wave`/`dome`, `planar`.
  Mathematik/Fahrplan: siehe [docs/DESIGN_nonplanar.md](docs/DESIGN_nonplanar.md).
- **3D-Vorschau:** Schicht-Slider (nur bis Schicht X) und Farbtrennung
  Perimeter / Solid (orange) / Sparse (cyan).
- **Nadel-Krümmungsbegrenzung:** die Basisfläche wird auf `max. Bahnneigung`
  (Nadelgrenze) neigungsbegrenzt — steile Formen (z. B. Brustrand) werden
  automatisch druckbar, Außenform bleibt erhalten.
- **3D-Infill:** Linien (mit Phasenversatz) oder **Gyroid/TPMS** (`infill_pattern`).
- **Closed-Loop (`feedback.py`):** Ist-Höhen einlesen und die non-planare Basis
  für die Folgeschichten live korrigieren (Mock + Moonraker-Skelett).
- **Top/Bottom-Solid-Layer:** geschlossene Deck-/Bodenflächen über echte
  Boolean-Operationen (Clipper) — erfasst auch schräge Deckflächen und
  Überhänge, nicht nur die ersten/letzten N Schichten. Für dichte
  Kontaktflächen an der Anatomie (Narbe/Metall).
- **Profile** werden als JSON unter `%APPDATA%\ProstheticSlicer\profiles` abgelegt.
- **Robuster Polygon-Offset** (Clipper/pyclipper): orientierungs- und lochsichere
  Perimeter ohne Selbstüberschneidung, maßhaltig (Wand-Außenkante = Modellmaß);
  reiner-Python-Fallback ohne pyclipper.
- **Bauraum-Check**, **Resampling** langer Bahnen für glatte Kurven, **korrekte
  Flussberechnung entlang der echten 3D-Pfadlänge**.

## Installation (Windows)

Der **Windows-Installer wird per GitHub Actions automatisch gebaut** (Workflow
`.github/workflows/build-windows.yml`): bei jedem Push auf den Branch entsteht
ein Setup unter *Actions → Artifacts → NonPlanarSiliconeSlicer-Setup*.

Lokal entwickeln/starten:

```bash
pip install -r requirements.txt
python -m prosthetic_slicer
```

## Tests

```bash
python tests/test_core.py        # 7 Kerntests (headless, ohne GUI)
```

Vollständiger manueller Ablauf: siehe [docs/TESTPLAN.md](docs/TESTPLAN.md).

---

# nonplanar_warp — Post-Processor für OrcaSlicer / PrusaSlicer (älter)

Ein Post-Processing-Skript, das flach geslicten G-code so **verbiegt, dass die
oberen Schichten der gekrümmten Außenhülle des Modells folgen** (non-planares /
konformes Slicing). Gedacht für **Silikon-Druck in einem Flüssig-/Gelbad** (FRESH-
artig, Nadel-Extrusion): Weil das Material im Bad schwebt und gestützt wird, ist
man nicht an horizontale Schichten gebunden — echte 3D-Bahnen sind möglich.

## Warum überhaupt ein Skript und kein „Plugin"?

OrcaSlicer und PrusaSlicer haben **keine Laufzeit-Plugin-Schnittstelle**. Der
offizielle Erweiterungspunkt ist das **Post-Processing-Skript**: Der Slicer ruft
nach dem Slicen ein externes Programm mit der G-code-Datei auf, das die Datei
beliebig verändern darf. Genau das macht dieses Tool.

## Wie es funktioniert

1. **Zielfläche aus dem G-code ableiten** — pro X/Y-Rasterzelle wird die höchste
   extrudierte Z-Höhe gesammelt. Das ergibt die gedruckte Oberkante des Objekts
   (die „Außenhülle" oben). Keine separate STL nötig.
2. **Oberes Band verbiegen** — die obersten `--band` Millimeter werden sanft auf
   diese Fläche drapiert. Ein Punkt in Höhe `z` an Position `(x,y)` wandert nach
   `z + t·(H(x,y) − z_top)`, wobei `t` von 0 (Bandunterkante) auf 1 (oben) steigt.
   Unterhalb des Bandes bleibt alles exakt planar.
3. **Lange Bahnen resampeln** — gerade Strecken werden in kurze Stücke (`--max-seg`)
   zerlegt, damit die Bahn der Krümmung glatt folgt statt eine Sehne zu schneiden.
4. **Materialfluss anpassen** — die Extrusionsmenge `E` wird pro Teilstück neu auf
   die tatsächliche **3D-Länge** verteilt (`--flow conform`), damit gleich viel
   Material pro Wegstrecke abgelegt wird.

## Voraussetzungen

Nur **Python 3** (Standardbibliothek, keine `pip`-Pakete).

## Einrichtung in OrcaSlicer / PrusaSlicer

*Print Settings → Output options → Post-processing scripts*:

```
/usr/bin/python3 /pfad/zu/nonplanar_warp.py --band 5 --max-seg 1.0;
```

- Unter Windows den vollen Pfad zu `python.exe` und zum Skript angeben.
- Mehrere Skripte: je eines pro Zeile.
- Der Slicer hängt den G-code-Pfad automatisch als letztes Argument an.

## Parameter

| Option        | Default   | Bedeutung |
|---------------|-----------|-----------|
| `--band MM`   | `5.0`     | Höhe des Übergangsbands ab Oberkante, das verbogen wird. `0` = ganzes Objekt (vollkonform). |
| `--grid MM`   | `1.0`     | Rasterzellengröße der Höhenkarte. Kleiner = feiner, langsamer. |
| `--max-seg MM`| `1.0`     | Lange Bahnen werden in Stücke ≤ MM zerlegt. |
| `--smooth N`  | `2`       | Glättungsdurchläufe der Höhenkarte. `0` = scharfe Spitzen. |
| `--flow MODE` | `conform` | `conform` = E an längeren 3D-Pfad anpassen, `preserve` = E unverändert. |
| `--out FILE`  | in-place  | Ausgabe in separate Datei (zum Testen). |
| `--report`    | —         | Statistik nach stderr. |

## Selbst testen (ohne Slicer)

```bash
cd examples
python3 make_test_gcode.py                 # erzeugt test_planar.gcode (Kuppel)
python3 ../nonplanar_warp.py test_planar.gcode --out test_warped.gcode --band 6 --report
```

Im Ergebnis ist die Gesamt-`E`-Menge erhalten, alles unterhalb des Bands bleibt
unverändert, und die obersten Schichten folgen non-planar der Kuppel.

## Grenzen & nächste Schritte

- Dieser erste Stand drapiert die **Oberseite** auf die Außenhülle. Für seitlich
  überhängende oder geschlossene Freiformen (Bahnen, die in Z wieder nach oben
  laufen) braucht es echtes Slicing entlang gekrümmter Flächen — der nächste
  Ausbaustufe (eigener non-planarer Slicer).
- Die Firmware muss kombinierte `G1 X Y Z E`-Bewegungen verarbeiten (Klipper/
  Marlin tun das). Für Silikon ggf. Druckvorlauf/Volumetrie separat abstimmen.
- Im Bad sind Kollisionen unkritisch, daher darf `--band` groß gewählt werden.

---

# nonplanar_slicer — Eigenständiger non-planarer STL-Slicer

Während `nonplanar_warp.py` fertigen G-code verbiegt, schneidet
`nonplanar_slicer.py` das **STL-Mesh direkt** in Schichten und erzeugt die
Werkzeugbahnen selbst. Damit sind echte gekrümmte Schichten durch das ganze
Bauteil möglich — nicht nur ein verbogener Deckel.

## Kernidee: Deformations-Hook

Jeder ausgegebene Punkt läuft durch eine Funktion `deform(x, y, z)`:

```
--field planar   klassische flache Schichten (Identität)
--field wave     Schichten als Sinuswelle in Z   (echtes non-planares Slicing)
--field dome     Schichten über der Mitte gewölbt
```

Da beim Silikon-Druck im Bad **kein flaches erstes Layer** nötig ist, sind
global gewölbte Schichten direkt druckbar — der Hook ist also kein Trick,
sondern physikalisch nutzbar. Die Extrusionsmenge wird entlang der echten
**3D-Pfadlänge** nach der Deformation berechnet, der Materialfluss stimmt also.

## Aufruf

```bash
python3 nonplanar_slicer.py modell.stl -o modell.gcode --field wave --amp 3 --wavelength 18 --report
```

| Option              | Default      | Bedeutung |
|---------------------|--------------|-----------|
| `-o FILE`           | —            | Ausgabe-G-code (Pflicht). |
| `--layer-height MM` | `0.4`        | Schichthöhe. |
| `--line-width MM`   | `0.6`        | Bahnbreite (für Flussberechnung). |
| `--infill-spacing MM`| `3.0`       | Abstand der Infill-Linien. |
| `--field`           | `planar`     | `planar` / `wave` / `dome`. |
| `--amp MM`          | `0.0`        | Amplitude der Deformation. |
| `--wavelength MM`   | `20.0`       | Wellenlänge (wave) bzw. Abfallradius (dome). |
| `--e-mode`          | `volumetric` | `volumetric` (E = mm³, für Spritzenpumpe) oder `filament`. |
| `--filament-d MM`   | `1.75`       | nur bei `--e-mode filament`. |
| `--flow`            | `1.0`        | Fluss-Multiplikator. |

## Selbst testen

```bash
cd examples
python3 make_test_stl.py                                   # cube.stl, cylinder.stl
python3 ../nonplanar_slicer.py cube.stl -o cube.gcode --field planar --report
python3 ../nonplanar_slicer.py cylinder.stl -o cyl.gcode --field wave --amp 3 --wavelength 18 --report
```

Verifiziert: planar = konstantes Z pro Schicht & exakte Konturmaße; wave =
Z folgt der Sinusfläche mit < 0,001 mm Abweichung, Fluss korrekt.

## Stand & nächste Schritte

Dieser Stand ist der **Slicer-Kern (Schritt A)**: STL einlesen, Mesh×Ebene
schneiden, Konturen zusammensetzen, Perimeter + Infill, 3D-Ausgabe mit
Deformations-Hook. Robust für konvexe/einfache Geometrien.

Noch offen (nächste Ausbaustufen):
- **Außenhüllen-konformes Feld** (Schritt B): `deform` an die echte
  Modelloberfläche koppeln statt analytische Wellen.
- **Polygon-Offset** der Perimeter (aktuell wird die Schnittkontur direkt
  gedruckt → Teil ist um ~Bahnbreite/2 größer).
- Mehrere Wände, Top/Bottom-Solid-Layer, Stützstruktur-freies Bad-Handling,
  robustes Stitching für konkave/mehrteilige Querschnitte.

---

## Lizenz

Frei verwendbar. Ohne Gewähr — vor dem ersten echten Druck im Vorschau-Viewer
(z. B. den warped G-code in Orca/Prusa erneut laden) prüfen.
