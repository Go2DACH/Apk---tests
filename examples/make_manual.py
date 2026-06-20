#!/usr/bin/env python3
"""Baut die PDF-Bedienungsanleitung (mit Screenshots) zum Non-Planar Silicone
Slicer. Erwartet die zuvor erzeugten PNGs (render_breast.py + make_screenshots.py)."""

import os
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.image as mpimg
from matplotlib.backends.backend_pdf import PdfPages
from matplotlib.patches import FancyBboxPatch

HERE = os.path.dirname(os.path.abspath(__file__))
A4 = (8.27, 11.69)
BLUE = '#1f4e79'
GREY = '#444444'


def img(path):
    p = os.path.join(HERE, path)
    return mpimg.imread(p) if os.path.exists(p) else None


def new_page(pdf, title=None, subtitle=None):
    fig = plt.figure(figsize=A4)
    fig.patch.set_facecolor('white')
    if title:
        fig.text(0.07, 0.95, title, fontsize=20, fontweight='bold', color=BLUE)
    if subtitle:
        fig.text(0.07, 0.915, subtitle, fontsize=11, color=GREY)
        fig.add_artist(plt.Line2D([0.07, 0.93], [0.905, 0.905], color=BLUE, lw=1.2))
    elif title:
        fig.add_artist(plt.Line2D([0.07, 0.93], [0.935, 0.935], color=BLUE, lw=1.2))
    return fig


def add_image(fig, path, rect, caption=None):
    im = img(path)
    if im is None:
        return
    ax = fig.add_axes(rect)
    ax.imshow(im)
    ax.axis('off')
    if caption:
        ax.set_title(caption, fontsize=8, color=GREY)


def add_text(fig, x, y, text, size=10.5, color='black', weight='normal', va='top'):
    fig.text(x, y, text, fontsize=size, color=color, fontweight=weight,
             va=va, ha='left', wrap=True)


def bullets(fig, x, y, items, size=10.5, dy=0.026, color='black'):
    for it in items:
        fig.text(x, y, '•', fontsize=size, color=BLUE, va='top')
        fig.text(x + 0.022, y, it, fontsize=size, color=color, va='top')
        y -= dy * (1 + it.count('\n'))
    return y


def build(pdf):
    # ---------- Titelseite ----------
    fig = new_page(pdf)
    fig.text(0.5, 0.72, 'Non-Planar Silicone Slicer', fontsize=30,
             fontweight='bold', color=BLUE, ha='center')
    fig.text(0.5, 0.675, 'Bedienungsanleitung', fontsize=17, color=GREY, ha='center')
    add_image(fig, 'breast_stl.png', [0.1, 0.30, 0.8, 0.32])
    fig.text(0.5, 0.25, 'STL rein  →  non-planarer G-code raus', fontsize=13,
             color=BLUE, ha='center', style='italic')
    fig.text(0.5, 0.14, 'Silikon-Prothesen im Flüssig-/Gelbad · Voron-Umbau '
             '300×300×300 mm · 1,0 mm Nadel', fontsize=10, color=GREY, ha='center')
    fig.text(0.5, 0.115, 'Version 0.1.0', fontsize=10, color=GREY, ha='center')
    pdf.savefig(fig); plt.close(fig)

    # ---------- Überblick ----------
    fig = new_page(pdf, 'Überblick', 'Was das Programm macht')
    y = bullets(fig, 0.08, 0.86, [
        'Wandelt ein STL direkt in non-planaren G-code um – die Schichten folgen\n'
        'der gekrümmten Form statt flacher Ebenen.',
        'Gedacht für Silikon-Druck im Gel-Bad (FRESH-artig, Nadel-Extrusion):\n'
        'das Material schwebt, daher sind echte 3D-Bahnen möglich.',
        'Konforme Schichtung erhält die Außenform und legt die Schichtlinien\n'
        'entlang der Kontaktfläche (z. B. Narbe/Brustwand) – für Prothesenkissen.',
        '„morph"-Feld: Schichten morphen von der Boden- zur (anders gekrümmten)\n'
        'Deckform → Krümmung in verschiedene Richtungen + variable Schichtdicke.',
        'Nadel-Krümmungsbegrenzung: zu steile Bereiche werden automatisch\n'
        'druckbar gemacht (Bahnneigung ≤ eingestellte Nadelgrenze).',
        'Gel-Ablauf: durchlässiges Infill (Gyroid/Linien) + Ablaufloch oben\n'
        '(automatisch an der Gel-Mulde) + seitliche Entlüfter.',
        'Drei Dosier-Modi: volumetrisch (mm³), Filament-mm, Druck/Zeit.',
        'Selbst-Tuning: sichere Geschwindigkeit aus Fluss- und Biegegrenze.',
        '3D-Vorschau mit Schicht-Slider, speicherbare Profile.',
    ], dy=0.0455)
    add_text(fig, 0.08, y - 0.01, 'Sicherheits-Hinweis: Die Nadel (40 cm) biegt '
             'über 50 mm/s – das Programm kappt automatisch auf ~40 mm/s.',
             size=10, color='#a33', weight='bold')
    pdf.savefig(fig); plt.close(fig)

    # ---------- Installation ----------
    fig = new_page(pdf, 'Installation & Start')
    add_text(fig, 0.08, 0.88, 'Variante A – Windows-Installer (empfohlen)', size=13,
             color=BLUE, weight='bold')
    bullets(fig, 0.08, 0.845, [
        'Der Installer wird per GitHub Actions automatisch gebaut.',
        'GitHub → Actions → letzter Lauf → Artifacts → „NonPlanarSiliconeSlicer-Setup".',
        'Setup ausführen, danach „Non-Planar Silicone Slicer" über das Startmenü öffnen.',
    ], dy=0.03)
    add_text(fig, 0.08, 0.71, 'Variante B – aus dem Quellcode', size=13,
             color=BLUE, weight='bold')
    add_text(fig, 0.08, 0.675, 'In einer Konsole im Projektordner:', size=10.5)
    fig.text(0.10, 0.64, 'pip install -r requirements.txt\npython -m prosthetic_slicer',
             fontsize=11, family='monospace',
             bbox=dict(boxstyle='round', fc='#f0f0f0', ec='#ccc'), va='top')
    add_text(fig, 0.08, 0.55, 'Voraussetzungen', size=13, color=BLUE, weight='bold')
    bullets(fig, 0.08, 0.515, [
        'Windows 10/11 (Installer) bzw. Python 3.11+ (Quellcode).',
        'Der Slicer-Kern läuft ohne Zusatzpakete; die GUI nutzt PySide6,\n'
        'pyqtgraph, PyOpenGL, numpy, pyclipper (per requirements.txt installiert).',
    ], dy=0.04)
    add_text(fig, 0.08, 0.40, 'Profile speichern', size=13, color=BLUE, weight='bold')
    add_text(fig, 0.08, 0.365, 'Alle Einstellungen lassen sich als Profil (JSON) '
             'speichern/laden – über die Profilleiste oben.\nAblage unter '
             '%APPDATA%\\ProstheticSlicer\\profiles.', size=10.5)
    pdf.savefig(fig); plt.close(fig)

    # ---------- Oberfläche ----------
    fig = new_page(pdf, 'Die Oberfläche')
    add_image(fig, 'shot_sliced.png', [0.06, 0.46, 0.88, 0.46])
    add_text(fig, 0.08, 0.42, 'Aufbau des Fensters', size=12, color=BLUE, weight='bold')
    bullets(fig, 0.08, 0.39, [
        'Profilleiste (oben): Profil laden/speichern.',
        'Parameterpanel (links): Drucker, Material/Dosierung, Prozess/Non-planar.',
        '3D-Vorschau (rechts): Perimeter nach Höhe eingefärbt, Solid orange,\n'
        'Sparse cyan. Mit der Maus drehen/zoomen.',
        'Aktionsleiste (unten): STL laden · Slicen · G-code exportieren · Infill an/aus.',
        'Schicht-Slider: zeigt nur Schichten bis zur gewählten Höhe.',
        'Statuszeile: Geschwindigkeiten, erreichte Bahnneigung, Warnungen.',
    ], dy=0.035)
    pdf.savefig(fig); plt.close(fig)

    # ---------- Parameter-Referenz ----------
    fig = new_page(pdf, 'Parameter-Referenz')
    add_text(fig, 0.08, 0.88, 'Drucker', size=13, color=BLUE, weight='bold')
    bullets(fig, 0.08, 0.85, [
        'Bett X/Y/Z, Düse Ø, Max. Fluss (mm³/s), Max. Geschw. (Biegegrenze der Nadel).',
        'Firmware (generic/marlin/klipper), Start-/End-G-code (für Standalone-Druck).',
    ], dy=0.03)
    add_text(fig, 0.08, 0.76, 'Material / Dosierung', size=13, color=BLUE, weight='bold')
    bullets(fig, 0.08, 0.73, [
        'E-Modus: volumetric (mm³, Spritzenpumpe) · filament (mm) · pressure (Druck/Zeit).',
        'Filament Ø, Fluss-Faktor, Druck-AN/AUS-Befehle (für pressure).',
    ], dy=0.03)
    add_text(fig, 0.08, 0.64, 'Prozess / Non-planar', size=13, color=BLUE, weight='bold')
    bullets(fig, 0.08, 0.61, [
        'Schichthöhe, Bahnbreite, Perimeter, Infill-Abstand.',
        'Bottom-/Top-Solid-Schichten (dichte Kontaktflächen).',
        'Non-planar-Feld: planar · bottom · morph · top · reference · wave · dome.',
        'Infill-Muster: lines · gyroid (3D, durchlässig).',
        'Ablauflöcher (oben, auto an Gel-Mulde), Entlüfter (seitlich).',
        'Max. Bahnneigung (Nadelgrenze), Konformität.',
        'Oberflächen-Raster, Glättung, Resampling, auf Bett zentrieren.',
    ], dy=0.03)
    add_text(fig, 0.08, 0.36, 'Selbst-Tuning', size=12, color=BLUE, weight='bold')
    add_text(fig, 0.08, 0.33, 'Druckgeschwindigkeit = min(Flussgrenze, Biegegrenze).\n'
             'Beispiel 1,0 mm × 0,6 mm = 0,6 mm² → 15 ÷ 0,6 = 25 mm/s (unter der '
             '40-mm/s-Nadelkappung).', size=10.5)
    pdf.savefig(fig); plt.close(fig)

    # ---------- Non-planar & Krümmung ----------
    fig = new_page(pdf, 'Non-planare Schichtung & Krümmungsbegrenzung')
    add_image(fig, 'breast_layers.png', [0.06, 0.50, 0.88, 0.40])
    add_text(fig, 0.08, 0.46, 'Konform & morph', size=12, color=BLUE, weight='bold')
    bullets(fig, 0.08, 0.43, [
        'bottom: Schichten folgen der Bodenfläche (konstante Dicke).',
        'morph: Schichten morphen von Boden- zu Deckform → multidirektionale\n'
        'Krümmung, variable Schichtdicke (Fluss skaliert automatisch mit).',
        'Die Außenform bleibt exakt erhalten – nur die Schichtung wird gekrümmt.',
    ], dy=0.038)
    add_text(fig, 0.08, 0.27, 'Nadel-Krümmungsbegrenzung', size=12, color=BLUE,
             weight='bold')
    add_text(fig, 0.08, 0.235,
             'Steile Bereiche (z. B. der Brustrand, fast senkrecht) würden eine '
             'Bahnneigung von ~81° erfordern.\nDie Basisfläche wird so '
             'neigungsbegrenzt, dass die Bahnneigung die eingestellte Nadelgrenze '
             '(z. B. 40°)\neinhält – im Beispiel exakt 40,1° erreicht.', size=10.5)
    pdf.savefig(fig); plt.close(fig)

    # ---------- Gel-Ablauf ----------
    fig = new_page(pdf, 'Gel-Ablauf: durchlässig + Löcher')
    add_image(fig, 'shot_top.png', [0.05, 0.50, 0.52, 0.40],
              'Draufsicht: Entlüfter-Kerben am Rand')
    add_image(fig, 'breast_layers_grid.png', [0.55, 0.46, 0.42, 0.46],
              'Schicht 79: Ablaufloch in der Top-Schale')
    add_text(fig, 0.08, 0.40, 'Warum?', size=12, color=BLUE, weight='bold')
    add_text(fig, 0.08, 0.37, 'Im Bad sitzt Gel im Bauteil und muss nach dem Druck '
             'heraus.', size=10.5)
    bullets(fig, 0.08, 0.33, [
        'Durchlässiges Infill: Gyroid (offenes Gitter) oder Linien mit Abstand.',
        'Ablaufloch oben: Loch durch die Solid-Schale, automatisch an der tiefsten\n'
        'Stelle der Kontaktfläche (Gel-Mulde). Der Boden bleibt geschlossen.',
        'Entlüfter: seitliche vertikale Schlitze für schnelleren Ablauf.',
        'Durchlässigkeits-Warnung, falls Poren zu eng oder kein Loch gesetzt ist.',
    ], dy=0.038)
    pdf.savefig(fig); plt.close(fig)

    # ---------- Arbeitsablauf ----------
    fig = new_page(pdf, 'Arbeitsablauf & Druck vom USB-Stick')
    steps = [
        '1.  STL laden  (Aktionsleiste → „STL laden…").',
        '2.  Profil wählen/anpassen – Feld z. B. „morph", Infill „gyroid",\n'
        '     Ablaufloch + Entlüfter, Nadelgrenze (z. B. 40°).',
        '3.  „Slicen" – die 3D-Vorschau zeigt das Ergebnis; Statuszeile prüfen\n'
        '     (Schichten, erreichte Bahnneigung, Warnungen).',
        '4.  Mit dem Schicht-Slider die Schichten kontrollieren.',
        '5.  „G-code exportieren…" – die .gcode-Datei direkt auf den USB-Stick\n'
        '     speichern (oder speichern und kopieren).',
        '6.  USB-Stick an den Drucker, Datei im Menü auswählen, Druck starten.',
    ]
    y = 0.86
    for s in steps:
        fig.text(0.09, y, s, fontsize=11, va='top')
        y -= 0.052 * (1 + s.count('\n'))
    add_text(fig, 0.08, y - 0.01, 'Wichtig für Standalone-Druck', size=12,
             color=BLUE, weight='bold')
    add_text(fig, 0.08, y - 0.045, 'Im Drucker-Profil Start-/End-G-code eintragen '
             '(z. B. G28 Homing, Pumpe vorbereiten / abschalten),\ndamit die Datei '
             'ohne Host eigenständig läuft. Die Datei enthält bereits '
             'G21/G90/M83 + Start/End + Bahnen.', size=10.5)
    add_text(fig, 0.08, y - 0.12, 'Sicherheit & erste Tests', size=12, color=BLUE,
             weight='bold')
    bullets(fig, 0.08, y - 0.155, [
        'Erst Trockenlauf ohne Material: max. Achsgeschwindigkeit prüfen (≤ 50 mm/s).',
        'Fluss/Dosierung kalibrieren (E = mm³ Silikon).',
        'Erst einfaches Kissen drucken, Maßhaltigkeit und Ablauf prüfen.',
    ], dy=0.033)
    pdf.savefig(fig); plt.close(fig)


def main():
    out = os.path.join(HERE, 'Anleitung_NonPlanarSiliconeSlicer.pdf')
    with PdfPages(out) as pdf:
        build(pdf)
    print('wrote', out)


if __name__ == '__main__':
    main()
