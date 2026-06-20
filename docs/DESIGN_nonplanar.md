# Design: Non-planare Schichtung, variable Schichtdicke, 3D-Infill

Dieses Dokument erklärt, wie der Slicer Teile baut, die **in verschiedene
Richtungen gekrümmt** sind, und wie die **non-planare Basis-Schicht intelligent
angepasst** wird. Es trennt klar: *bereits umgesetzt* vs. *Fahrplan*.

---

## 1. Grundprinzip: Slicing in einem deformierten Raum

Statt das Mesh direkt entlang gekrümmter Flächen zu schneiden (numerisch hart),
arbeiten wir mit einer **Koordinaten-Verformung** Φ:

1. **Rektifizieren** – das Mesh per Φ⁻¹ in einen Raum verziehen, in dem die
   gewünschten Schichten *flache Ebenen* sind.
2. **Planar slicen** – robustes, bekanntes Slicing im rektifizierten Raum.
3. **Zurückbiegen** – jeden Bahnpunkt per Φ in den echten Raum abbilden.

Vorteil: Die Außenform bleibt exakt erhalten (Hin- und Rück-Abbildung), und wir
nutzen den ausgereiften planaren Pfad (Offset, Infill, Solid-Layer).

Implementiert in `deform.py` (`DeformPlan`: `pre_vertex`, `post_point`,
`thickness_scale`) und `slicer.py` (Pass A/B).

---

## 2. Felder (Φ) – wovon die Schichten geführt werden

| Feld | Φ / Iso-Schicht | Zweck | Status |
|------|------------------|-------|--------|
| `planar` | h = z | flache Schichten | ✅ |
| `bottom` | h = z − b(x,y) | parallel zur **Bodenfläche** (konstante Dicke) | ✅ |
| `top` | h = z − t(x,y) (von oben) | parallel zur Deckfläche | ✅ |
| `reference` | b aus separatem Scan-STL | Schichten folgen Körper-Scan | ✅ |
| `morph` | **h = (z − b)/(t − b)** | Schichten **morphen von Boden- zu Deckform** | ✅ |
| `wave`/`dome` | analytische Nachverformung | Tests | ✅ |

### Das Morph-Feld (Kern deines Ziels)

Mit Bodenfläche `b(x,y)` und Deckfläche `t(x,y)`:

```
h(x,y,z) = (z − b(x,y)) / (t(x,y) − b(x,y))      ∈ [0,1]
```

- Iso-Fläche `h=0` = Boden (Krümmung A), `h=1` = Decke (Krümmung B),
  dazwischen **interpoliert** – damit kann ein Teil unten *anders* gekrümmt sein
  als oben (multidirektionale Krümmung, Sattelflächen).
- **Rektifizierung:** `w = h · T₀` (T₀ = mittlere Bauteildicke) → Slab konstanter
  Höhe, planar slicebar.
- **Rückbildung:** `z = b + (w/T₀)·(t − b)`.

Implementiert in `deform.make_plan(field='morph')`.

---

## 3. Variable Schichtdicke (fällt beim Morph automatisch an)

Beim Morph ist die **reale** Schichtdicke an (x,y):

```
d(x,y) = layer_height · (t(x,y) − b(x,y)) / T₀
```

Wo das Teil dicker ist, werden die Schichten proportional dicker. Damit das
Volumen stimmt, skaliert der **Materialfluss** mit der lokalen Dicke:

```
E ∝ line_width · layer_height · thickness_scale(x,y) · 3D-Pfadlänge
thickness_scale(x,y) = (t − b)/T₀
```

Umgesetzt: `DeformPlan.thickness_scale` → `SliceResult.thickness_scale` →
`GCodeWriter._e_for(..., ts)`. (Test: `test_morph_variable_thickness_and_flow`.)

**Fahrplan – adaptive Schichtdicke nach Krümmung:** zusätzlich dünnere Schichten
in Zonen hoher Oberflächenkrümmung (bessere Auflösung), dickere in flachen Zonen
(Tempo). Realisierbar über nicht-uniforme `w`-Stützstellen statt konstanter
`layer_height`-Schritte. *Noch offen.*

---

## 4. 3D-Infill

Da die Schichten bereits **gekrümmt** sind, ist das Infill schon non-planar im
echten Raum. Für echte **3D-Vernetzung über Schichten hinweg**:

- **Umgesetzt (Stufe 1):** Sparse-Infill bekommt pro Schicht einen
  **Phasenversatz** (`infill(..., phase=…)`) und alternierende Richtung. Über die
  gekrümmten Schichten entsteht so ein verschränktes Gitter statt deckungsgleicher
  Linien → bessere Z-Anbindung. (`slicer.py`)
- **Fahrplan (Stufe 2): Gyroid/TPMS.** Ein 3D-Skalarfeld
  `g(x,y,z) = sin x·cos y + sin y·cos z + sin z·cos x` auswerten und je Schicht
  die Iso-Kontur `g = 0` als Infill nehmen. Da unsere Schichten im rektifizierten
  Raum flach sind, wird Gyroid dort einfach pro Ebene ausgewertet und mit
  zurückgebogen → **kontinuierliches 3D-Infill, das den gekrümmten Schichten
  folgt.** Sauber in die bestehende Architektur einsetzbar.
- **Fahrplan (Stufe 3):** spannungs-/lastorientiertes Infill (Dichte aus einer
  Belastungs-Map, z. B. dort dichter, wo die Prothese drückt).

---

## 5. „Basis-Schicht intelligent anpassen"

Die Basisfläche `b(x,y)` ist **nicht starr**, sondern wird aus dem Modell (oder
einem Scan) abgeleitet und aufbereitet:

- **Umgesetzt:** `b`/`t` als geglättete Höhenkarten (`geometry.SurfaceMap`,
  Parameter `surface_grid`, `smooth`), bilinear interpoliert. Über `reference`
  kann `b` aus einem **separaten Körper-Scan** kommen.
- **Fahrplan – adaptiv/„unter dem Druck":**
  1. **Mischen zweier Basen** (z. B. Scan + Soll-Geometrie) mit Gewicht α(x,y).
  2. **Krümmungsbegrenzung:** `b` so glätten/limitieren, dass die nötige
     Nadelneigung druckbar bleibt (Kollision/Erreichbarkeit der 40-cm-Nadel).
  3. **Closed-Loop:** Ist-Höhe aus Sensor/Kamera einlesen und `b` für die
     folgenden Schichten **live korrigieren** (echte „intelligente Anpassung
     während des Drucks"). Benötigt eine Rückkanal-Schnittstelle (Klipper-API),
     daher eigener Ausbauschritt.

---

## 6. Grenzen der aktuellen Umsetzung

- `b(x,y)`/`t(x,y)` sind **eindeutige** Flächen je X/Y: echte Überhänge, die
  dieselbe X/Y doppelt belegen, werden als Außenhülle genähert.
- Morph braucht überall positive Dicke `t − b > 0` (dünne Ränder mit ε geklemmt).
- Φ-Verformung darf die Bahnen nicht so stark neigen, dass die Nadel kollidiert
  bzw. ihre Biegegrenze überschreitet – Krümmungsbegrenzung ist Fahrplan.
- Echtes Gyroid-Infill und Closed-Loop-Anpassung sind noch nicht implementiert.
