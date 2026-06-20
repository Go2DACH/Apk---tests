# nonplanar_warp — Non-planarer Post-Processor für OrcaSlicer / PrusaSlicer

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

## Lizenz

Frei verwendbar. Ohne Gewähr — vor dem ersten echten Druck im Vorschau-Viewer
(z. B. den warped G-code in Orca/Prusa erneut laden) prüfen.
