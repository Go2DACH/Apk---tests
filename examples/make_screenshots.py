#!/usr/bin/env python3
"""Erzeugt echte GUI-Screenshots (unter xvfb + Software-OpenGL) fuer die Anleitung.

Aufruf:
    LIBGL_ALWAYS_SOFTWARE=1 QT_QPA_PLATFORM=xcb xvfb-run -a -s "-screen 0 1400x900x24" \
        python3 examples/make_screenshots.py
"""

import os
import sys

from PySide6 import QtCore, QtGui, QtWidgets

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
sys.path.insert(0, HERE)

from prosthetic_slicer.gui.app import MainWindow
from prosthetic_slicer import pipeline
import make_breast_orthosis as gen


def composite(w):
    """Fenster-Screenshot mit eingesetztem Live-3D-Framebuffer."""
    full = w.grab()
    try:
        fb = w.preview.grabFramebuffer()
        pos = w.preview.mapTo(w, QtCore.QPoint(0, 0))
        p = QtGui.QPainter(full)
        p.drawImage(pos, fb)
        p.end()
    except Exception as e:
        print('  (kein GL-Framebuffer:', e, ')')
    return full


def configure(w, stl):
    w.in_field.setCurrentText('morph')
    w.in_pattern.setCurrentText('lines')
    w.in_infill.setValue(4.0)
    w.in_peri.setValue(2)
    w.in_maxangle.setValue(40)
    w.in_drain.setValue(1); w.in_drain_d.setValue(8.0)
    w.in_vents.setValue(4); w.in_vent_d.setValue(5.0)
    w.stl_path = stl
    w._ui_to_cfg()


def main():
    app = QtWidgets.QApplication(sys.argv)
    stl = os.path.join(HERE, 'breast_orthosis.stl')
    gen.write_binary_stl(stl, gen.build())

    w = MainWindow()
    w.resize(1340, 850)
    w.show()
    app.processEvents()

    # 1) Startzustand (leere Vorschau, Parameterpanel)
    configure(w, stl)
    w.lbl_status.setText('STL geladen: breast_orthosis.stl – bereit zum Slicen.')
    app.processEvents()
    composite(w).save(os.path.join(HERE, 'shot_start.png'))
    print('wrote shot_start.png')

    # 2) Nach dem Slicen (3D-Vorschau gefuellt)
    text, result, tune = pipeline.run(stl, w.cfg)
    w._on_sliced(text, result, tune)
    try:
        w.preview.setCameraPosition(elevation=20, azimuth=-60)
    except Exception:
        pass
    for _ in range(8):
        app.processEvents()
    composite(w).save(os.path.join(HERE, 'shot_sliced.png'))
    print('wrote shot_sliced.png  (Schichten=%d, max Neigung=%.1f)'
          % (result.meta['layers'], tune['max_surface_angle_deg']))

    # 3) Schicht-Slider auf ~55 % (Schnittansicht der unteren Schichten)
    w.sld_layer.setValue(int(w.sld_layer.maximum() * 0.55))
    for _ in range(8):
        app.processEvents()
    composite(w).save(os.path.join(HERE, 'shot_slider.png'))
    print('wrote shot_slider.png')

    # 4) Draufsicht (zeigt Ablaufloch + Entluefter in der Vorschau)
    w.sld_layer.setValue(w.sld_layer.maximum())
    try:
        w.preview.setCameraPosition(elevation=89, azimuth=-90)
    except Exception:
        pass
    for _ in range(8):
        app.processEvents()
    composite(w).save(os.path.join(HERE, 'shot_top.png'))
    print('wrote shot_top.png')


if __name__ == '__main__':
    main()
