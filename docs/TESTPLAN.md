# Testplan — Non-Planar Silicone Slicer

Ziel: STL rein → non-planarer G-code raus, sicher gedruckt auf dem Voron-Umbau
(300×300×300 mm, 1,0 mm Nadel, 15 mm³/s, Nadel biegt > 50 mm/s) für
Silikon-Prothesenkissen (z. B. zwischen Narbe und Metall, Brust-/Fußprothesen).

> Sicherheitsgrundsatz: **Nadelgeschwindigkeit nie über 50 mm/s.** Der Slicer
> kappt automatisch auf 40 mm/s; bei den Trockentests trotzdem die real
> gefahrene Geschwindigkeit prüfen.

---

## A. Software-Validierung (automatisch, ohne Drucker)

| # | Test | Befehl | Erwartung |
|---|------|--------|-----------|
| A1 | Kerntests | `python tests/test_core.py` | 7/7 bestanden |
| A2 | CLI planar | `python -m prosthetic_slicer.cli examples/cube.stl -o out.gcode --field planar --report` | Z je Schicht konstant |
| A3 | CLI konform | `… --field bottom --report` | Bodenschichten folgen der Fläche, Außenmaße erhalten |
| A4 | E-Modi | je `--e-mode volumetric/filament/pressure` | volumetric/filament mit E; pressure mit M42-AN/AUS, ohne E |
| A5 | Bauraum-Check | STL > 300 mm laden | klare Fehlermeldung, kein G-code |
| A6 | Tuning | Düse/Fluss/Breite ändern | Druckgeschwindigkeit = min(Fluss-, Biegegrenze) |

**Abnahme A:** alle Zeilen grün, keine Tracebacks.

---

## B. GUI-Validierung (Windows, nach Installer)

| # | Test | Schritt | Erwartung |
|---|------|---------|-----------|
| B1 | Start | Installer ausführen, App starten | Fenster öffnet, 3D-Vorschau sichtbar |
| B2 | STL laden | „STL laden…“ → Beispiel | Statuszeile zeigt Dateinamen |
| B3 | Slicen | „Slicen“ | Fortschritt, danach Bahnen in 3D, Statuszeile mit Schichtzahl |
| B4 | Vorschau | Maus drehen/zoomen, Infill an/aus | flüssige Darstellung, Farbverlauf nach Z |
| B5 | Parameter | Feld auf `wave`, Amplitude 5 | Vorschau zeigt gewellte Schichten |
| B6 | Profil | „Profil speichern“ → Name; neu starten → „Profil laden“ | Werte exakt wiederhergestellt |
| B7 | Export | „G-code exportieren…“ | .gcode-Datei geschrieben |

**Abnahme B:** kein Absturz, Profile persistent (`%APPDATA%\ProstheticSlicer\profiles`).

---

## C. Drucker-Trockenlauf (ohne Material, ohne Bad)

> Nadel demontiert oder hoch genug, Extruder/Dispenser deaktiviert.

| # | Test | Erwartung |
|---|------|-----------|
| C1 | Start-/End-G-code passend zur Firmware eingetragen | Homing/Endsequenz korrekt |
| C2 | G-code an Drucker senden | keine Soft-Endstop-/Out-of-bounds-Fehler |
| C3 | Mit Stoppuhr/Log die **maximale Achsgeschwindigkeit** messen | ≤ 40 mm/s, nie > 50 mm/s |
| C4 | Non-planare Schicht beobachten | Z bewegt sich kontinuierlich mit (kein Treppen) |
| C5 | Z-Höhen prüfen | keine negativen Z über sicheren Bath-Nullpunkt hinaus |

**Abnahme C:** keine Grenzwertverletzung, Geschwindigkeit im sicheren Band.

---

## D. Material- & Fluss-Kalibrierung (Silikon)

| # | Test | Vorgehen | Erwartung |
|---|------|----------|-----------|
| D1 | E-Kalibrierung volumetric | In Klipper/Firmware `rotation_distance` so setzen, dass E=1 → 1 mm³ Silikon | gemessenes Volumen ≈ E-Wert ±5 % |
| D2 | Fluss-Limit | Einzellinie bei 25 mm/s (0,6 mm² → 15 mm³/s) | gleichmäßige Raupe, kein Reißen |
| D3 | Pressure-Modus (falls genutzt) | AN/AUS-Befehle prüfen, Vor-/Nachlauf abstimmen | sauberer Start/Stopp, kein Nachtropfen |
| D4 | Linienbreite | Testlinie messen | ≈ eingestellte Bahnbreite (1,0 mm) |

**Abnahme D:** Fluss kalibriert, Linienbreite maßhaltig.

---

## E. Erster non-planarer Druck im Bad

| # | Test | Erwartung |
|---|------|-----------|
| E1 | Einfaches Kissen (Platte auf Kuppel), `field=bottom` | Unterseite folgt der Kuppel, glatt, keine Stufen |
| E2 | Schichthaftung im Bad | Lagen verbinden trotz gekrümmter Bahnen |
| E3 | Maßhaltigkeit | Außenmaße ±0,5 mm zur STL |
| E4 | Kontaktfläche | Bodenfläche schmiegt sich an Referenz (Scan) an |
| E5 | Aushärtung | nach Cure formstabil, keine Delamination |

**Abnahme E:** druckbares, maßhaltiges, konform geschichtetes Kissen.

---

## F. Prothesen-spezifische Abnahme

| # | Kriterium | Erwartung |
|---|-----------|-----------|
| F1 | Konforme Kontaktfläche (Narbe/Metall) | gleichmäßige Wandstärke entlang Anatomie |
| F2 | Härte/Shore | wie spezifiziertes Silikon |
| F3 | Reproduzierbarkeit | zweiter Druck gleicher Datei < 0,5 mm Abweichung |
| F4 | Reinigung/Biokompatibilität | nach Protokoll (außerhalb Slicer-Scope) |

---

## Bekannte Grenzen (Stand 0.1.0)

- Polygon-Offset der Perimeter ist naiv (Kanten-Normalen); stark konkave/
  mehrfach gelochte Querschnitte können sich selbst schneiden → vor dem Druck
  in der Vorschau prüfen.
- Konforme Felder gehen von einer eindeutigen Boden-/Deckfläche je X/Y aus
  (kein Überhang, der dieselbe X/Y zweimal belegt).
- Keine automatische Stützstruktur (im Bad i. d. R. nicht nötig).
- Glättung der Oberflächenkarte kann Spitzen leicht abrunden (Parameter
  „Glättung“ = 0 für scharfe Konturen).
