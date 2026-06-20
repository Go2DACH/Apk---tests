"""Hauptfenster der GUI: Parameter konfigurieren, slicen, Vorschau, exportieren."""

import os
import sys

from PySide6 import QtWidgets, QtCore
from PySide6.QtWidgets import (
    QMainWindow, QWidget, QVBoxLayout, QHBoxLayout, QFormLayout, QGroupBox,
    QDoubleSpinBox, QSpinBox, QComboBox, QLineEdit, QPlainTextEdit, QPushButton,
    QLabel, QFileDialog, QMessageBox, QCheckBox, QScrollArea, QTabWidget,
    QInputDialog, QSlider)

from .. import APP_NAME, __version__, pipeline
from ..config import (AppConfig, list_profiles, profile_path)
from .. import preview_data


# --------------------------------------------------------------------------- #
#  Slicing im Hintergrund-Thread
# --------------------------------------------------------------------------- #

class SliceWorker(QtCore.QThread):
    done = QtCore.Signal(object, object, object)   # text, result, tune
    failed = QtCore.Signal(str)
    progress = QtCore.Signal(int, int)

    def __init__(self, stl_path, cfg):
        super().__init__()
        self.stl_path = stl_path
        self.cfg = cfg

    def run(self):
        try:
            def prog(i, n):
                self.progress.emit(i, n)
            text, result, tune = pipeline.run(self.stl_path, self.cfg, progress=prog)
            self.done.emit(text, result, tune)
        except Exception as e:               # noqa
            import traceback
            self.failed.emit(traceback.format_exc())


# --------------------------------------------------------------------------- #
#  Hauptfenster
# --------------------------------------------------------------------------- #

def _dspin(lo, hi, val, step=0.1, dec=2, suffix=''):
    s = QDoubleSpinBox()
    s.setRange(lo, hi); s.setValue(val); s.setSingleStep(step)
    s.setDecimals(dec)
    if suffix:
        s.setSuffix(' ' + suffix)
    return s


class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle('%s  v%s' % (APP_NAME, __version__))
        self.resize(1280, 820)
        self.cfg = AppConfig()
        self.stl_path = None
        self.gcode_text = None
        self.worker = None

        self._build_ui()
        self._cfg_to_ui()
        self._update_tuning()

    # ---- UI-Aufbau ----------------------------------------------------- #
    def _build_ui(self):
        central = QWidget()
        root = QHBoxLayout(central)

        # Linke Spalte: Parameter (scrollbar)
        panel = QWidget()
        pl = QVBoxLayout(panel)
        pl.addWidget(self._printer_box())
        pl.addWidget(self._material_box())
        pl.addWidget(self._process_box())
        pl.addStretch(1)

        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setWidget(panel)
        scroll.setMinimumWidth(420)
        scroll.setMaximumWidth(480)

        # Rechte Spalte: Vorschau + Aktionen
        right = QVBoxLayout()
        self.preview = self._make_preview()
        right.addWidget(self.preview, 1)

        actions = QHBoxLayout()
        self.btn_load = QPushButton('STL laden…')
        self.btn_slice = QPushButton('Slicen')
        self.btn_export = QPushButton('G-code exportieren…')
        self.chk_infill = QCheckBox('Infill anzeigen'); self.chk_infill.setChecked(True)
        self.btn_load.clicked.connect(self.on_load_stl)
        self.btn_slice.clicked.connect(self.on_slice)
        self.btn_export.clicked.connect(self.on_export)
        self.chk_infill.stateChanged.connect(self._refresh_preview)
        for w in (self.btn_load, self.btn_slice, self.btn_export, self.chk_infill):
            actions.addWidget(w)
        actions.addStretch(1)
        right.addLayout(actions)

        # Schicht-Slider (zeigt nur bis Schicht X)
        slrow = QHBoxLayout()
        slrow.addWidget(QLabel('Schichten bis:'))
        self.sld_layer = QSlider(QtCore.Qt.Horizontal)
        self.sld_layer.setMinimum(0); self.sld_layer.setMaximum(0)
        self.sld_layer.valueChanged.connect(self._on_layer_slider)
        self.lbl_layer = QLabel('—')
        slrow.addWidget(self.sld_layer, 1)
        slrow.addWidget(self.lbl_layer)
        right.addLayout(slrow)

        self.lbl_status = QLabel('Bereit.')
        self.lbl_status.setWordWrap(True)
        self.lbl_status.setStyleSheet('color:#ccc; padding:4px;')
        right.addWidget(self.lbl_status)

        rw = QWidget(); rw.setLayout(right)
        root.addWidget(scroll)
        root.addWidget(rw, 1)
        self.setCentralWidget(central)

        # Profilleiste
        tb = self.addToolBar('Profile')
        self.cmb_profile = QComboBox()
        self._reload_profiles()
        b_save = QPushButton('Profil speichern')
        b_load = QPushButton('Profil laden')
        b_save.clicked.connect(self.on_save_profile)
        b_load.clicked.connect(self.on_load_profile)
        tb.addWidget(QLabel(' Profil: '))
        tb.addWidget(self.cmb_profile)
        tb.addWidget(b_load)
        tb.addWidget(b_save)

        self._last_result = None

    def _make_preview(self):
        try:
            from .preview import PreviewWidget
            return PreviewWidget()
        except Exception as e:                       # OpenGL evtl. nicht da
            lbl = QLabel('3D-Vorschau nicht verfuegbar:\n%s' % e)
            lbl.setAlignment(QtCore.Qt.AlignCenter)
            return lbl

    # ---- Parameter-Boxen ---------------------------------------------- #
    def _printer_box(self):
        box = QGroupBox('Drucker'); f = QFormLayout(box)
        self.in_bed_x = _dspin(50, 1000, 300, 10, 0, 'mm')
        self.in_bed_y = _dspin(50, 1000, 300, 10, 0, 'mm')
        self.in_bed_z = _dspin(50, 1000, 300, 10, 0, 'mm')
        self.in_nozzle = _dspin(0.1, 5, 1.0, 0.1, 2, 'mm')
        self.in_flow = _dspin(0.1, 100, 15, 0.5, 1, 'mm³/s')
        self.in_speed = _dspin(1, 500, 40, 1, 0, 'mm/s')
        self.in_flavor = QComboBox(); self.in_flavor.addItems(['generic', 'marlin', 'klipper'])
        self.in_start = QPlainTextEdit(); self.in_start.setMaximumHeight(60)
        self.in_end = QPlainTextEdit(); self.in_end.setMaximumHeight(60)
        for w in (self.in_bed_x, self.in_bed_y, self.in_bed_z, self.in_nozzle,
                  self.in_flow, self.in_speed):
            w.valueChanged.connect(self._update_tuning)
        f.addRow('Bett X', self.in_bed_x)
        f.addRow('Bett Y', self.in_bed_y)
        f.addRow('Bett Z', self.in_bed_z)
        f.addRow('Düse Ø', self.in_nozzle)
        f.addRow('Max. Fluss', self.in_flow)
        f.addRow('Max. Geschw. (Biegung)', self.in_speed)
        f.addRow('Firmware', self.in_flavor)
        f.addRow('Start-G-code', self.in_start)
        f.addRow('End-G-code', self.in_end)
        return box

    def _material_box(self):
        box = QGroupBox('Material / Dosierung'); f = QFormLayout(box)
        self.in_emode = QComboBox()
        self.in_emode.addItems(['volumetric', 'filament', 'pressure'])
        self.in_fild = _dspin(0.1, 10, 1.75, 0.05, 2, 'mm')
        self.in_flowmul = _dspin(0.1, 5, 1.0, 0.05, 2)
        self.in_pon = QLineEdit('M42 P0 S255')
        self.in_poff = QLineEdit('M42 P0 S0')
        f.addRow('E-Modus', self.in_emode)
        f.addRow('Filament Ø (filament)', self.in_fild)
        f.addRow('Fluss-Faktor', self.in_flowmul)
        f.addRow('Druck AN (pressure)', self.in_pon)
        f.addRow('Druck AUS (pressure)', self.in_poff)
        return box

    def _process_box(self):
        box = QGroupBox('Prozess / Non-planar'); f = QFormLayout(box)
        self.in_lh = _dspin(0.05, 3, 0.6, 0.05, 2, 'mm')
        self.in_lw = _dspin(0.1, 5, 1.0, 0.05, 2, 'mm')
        self.in_peri = QSpinBox(); self.in_peri.setRange(0, 10); self.in_peri.setValue(2)
        self.in_infill = _dspin(0, 50, 3.0, 0.5, 1, 'mm')
        self.in_top = QSpinBox(); self.in_top.setRange(0, 50); self.in_top.setValue(3)
        self.in_bottom = QSpinBox(); self.in_bottom.setRange(0, 50); self.in_bottom.setValue(3)
        self.in_maxseg = _dspin(0.2, 10, 1.0, 0.1, 2, 'mm')
        self.in_field = QComboBox()
        self.in_field.addItems(['bottom', 'morph', 'top', 'reference',
                                'planar', 'wave', 'dome'])
        self.in_amp = _dspin(0, 100, 0, 0.5, 2, 'mm')
        self.in_wl = _dspin(1, 500, 30, 1, 1, 'mm')
        self.in_grid = _dspin(0.5, 20, 2.0, 0.5, 1, 'mm')
        self.in_smooth = QSpinBox(); self.in_smooth.setRange(0, 20); self.in_smooth.setValue(2)
        self.in_pattern = QComboBox(); self.in_pattern.addItems(['lines', 'gyroid'])
        self.in_maxangle = _dspin(5, 89, 45, 1, 0, '°')
        self.in_conf = _dspin(0, 1, 1.0, 0.05, 2)
        self.in_drain = QSpinBox(); self.in_drain.setRange(0, 20); self.in_drain.setValue(1)
        self.in_drain_d = _dspin(1, 30, 5.0, 0.5, 1, 'mm')
        self.in_drain_ch = QCheckBox('Durchgehender Kanal (oben+unten)')
        self.in_vents = QSpinBox(); self.in_vents.setRange(0, 20); self.in_vents.setValue(0)
        self.in_vent_d = _dspin(1, 30, 4.0, 0.5, 1, 'mm')
        self.in_center = QCheckBox('Auf Bett zentrieren'); self.in_center.setChecked(True)
        self.in_ref = QLineEdit(); self.in_ref.setPlaceholderText('Referenz-STL (field=reference)')
        b_ref = QPushButton('…'); b_ref.clicked.connect(self.on_pick_reference)
        refrow = QHBoxLayout(); refrow.addWidget(self.in_ref); refrow.addWidget(b_ref)
        refw = QWidget(); refw.setLayout(refrow)
        for w in (self.in_lh, self.in_lw):
            w.valueChanged.connect(self._update_tuning)
        f.addRow('Schichthöhe', self.in_lh)
        f.addRow('Bahnbreite', self.in_lw)
        f.addRow('Perimeter', self.in_peri)
        f.addRow('Infill-Abstand', self.in_infill)
        f.addRow('Bottom-Solid-Schichten', self.in_bottom)
        f.addRow('Top-Solid-Schichten', self.in_top)
        f.addRow('Resampling', self.in_maxseg)
        f.addRow('Non-planar-Feld', self.in_field)
        f.addRow('Infill-Muster', self.in_pattern)
        f.addRow('Ablauflöcher (oben)', self.in_drain)
        f.addRow('Lochdurchmesser', self.in_drain_d)
        f.addRow('', self.in_drain_ch)
        f.addRow('Entlüfter (seitlich)', self.in_vents)
        f.addRow('Entlüfter-Durchmesser', self.in_vent_d)
        f.addRow('Max. Bahnneigung (Nadel)', self.in_maxangle)
        f.addRow('Konformität', self.in_conf)
        f.addRow('Amplitude (analyt.)', self.in_amp)
        f.addRow('Wellenlänge', self.in_wl)
        f.addRow('Oberflächen-Raster', self.in_grid)
        f.addRow('Glättung', self.in_smooth)
        f.addRow('', self.in_center)
        f.addRow('Referenz-STL', refw)
        return box

    # ---- Cfg <-> UI ---------------------------------------------------- #
    def _ui_to_cfg(self):
        c = self.cfg
        c.printer.bed_x = self.in_bed_x.value()
        c.printer.bed_y = self.in_bed_y.value()
        c.printer.bed_z = self.in_bed_z.value()
        c.printer.nozzle_d = self.in_nozzle.value()
        c.printer.max_flow_mm3s = self.in_flow.value()
        c.printer.max_speed_mms = self.in_speed.value()
        c.printer.flavor = self.in_flavor.currentText()
        c.printer.start_gcode = self.in_start.toPlainText()
        c.printer.end_gcode = self.in_end.toPlainText()
        c.material.e_mode = self.in_emode.currentText()
        c.material.filament_d = self.in_fild.value()
        c.material.flow = self.in_flowmul.value()
        c.material.pressure_on = self.in_pon.text()
        c.material.pressure_off = self.in_poff.text()
        c.process.layer_height = self.in_lh.value()
        c.process.line_width = self.in_lw.value()
        c.process.perimeters = self.in_peri.value()
        c.process.infill_spacing = self.in_infill.value()
        c.process.top_layers = self.in_top.value()
        c.process.bottom_layers = self.in_bottom.value()
        c.process.max_seg = self.in_maxseg.value()
        c.process.field = self.in_field.currentText()
        c.process.amp = self.in_amp.value()
        c.process.wavelength = self.in_wl.value()
        c.process.surface_grid = self.in_grid.value()
        c.process.smooth = self.in_smooth.value()
        c.process.infill_pattern = self.in_pattern.currentText()
        c.process.max_surface_angle = self.in_maxangle.value()
        c.process.conformity = self.in_conf.value()
        c.process.drain_holes = self.in_drain.value()
        c.process.drain_diameter = self.in_drain_d.value()
        c.process.drain_full_channel = self.in_drain_ch.isChecked()
        c.process.vent_holes = self.in_vents.value()
        c.process.vent_diameter = self.in_vent_d.value()
        c.process.center_on_bed = self.in_center.isChecked()
        c.process.reference_stl = self.in_ref.text()
        return c

    def _cfg_to_ui(self):
        c = self.cfg
        self.in_bed_x.setValue(c.printer.bed_x)
        self.in_bed_y.setValue(c.printer.bed_y)
        self.in_bed_z.setValue(c.printer.bed_z)
        self.in_nozzle.setValue(c.printer.nozzle_d)
        self.in_flow.setValue(c.printer.max_flow_mm3s)
        self.in_speed.setValue(c.printer.max_speed_mms)
        self.in_flavor.setCurrentText(c.printer.flavor)
        self.in_start.setPlainText(c.printer.start_gcode)
        self.in_end.setPlainText(c.printer.end_gcode)
        self.in_emode.setCurrentText(c.material.e_mode)
        self.in_fild.setValue(c.material.filament_d)
        self.in_flowmul.setValue(c.material.flow)
        self.in_pon.setText(c.material.pressure_on)
        self.in_poff.setText(c.material.pressure_off)
        self.in_lh.setValue(c.process.layer_height)
        self.in_lw.setValue(c.process.line_width)
        self.in_peri.setValue(c.process.perimeters)
        self.in_infill.setValue(c.process.infill_spacing)
        self.in_top.setValue(c.process.top_layers)
        self.in_bottom.setValue(c.process.bottom_layers)
        self.in_maxseg.setValue(c.process.max_seg)
        self.in_field.setCurrentText(c.process.field)
        self.in_amp.setValue(c.process.amp)
        self.in_wl.setValue(c.process.wavelength)
        self.in_grid.setValue(c.process.surface_grid)
        self.in_smooth.setValue(c.process.smooth)
        self.in_pattern.setCurrentText(c.process.infill_pattern)
        self.in_maxangle.setValue(c.process.max_surface_angle)
        self.in_conf.setValue(c.process.conformity)
        self.in_drain.setValue(c.process.drain_holes)
        self.in_drain_d.setValue(c.process.drain_diameter)
        self.in_drain_ch.setChecked(c.process.drain_full_channel)
        self.in_vents.setValue(c.process.vent_holes)
        self.in_vent_d.setValue(c.process.vent_diameter)
        self.in_center.setChecked(c.process.center_on_bed)
        self.in_ref.setText(c.process.reference_stl)

    # ---- Aktionen ------------------------------------------------------ #
    def _update_tuning(self):
        self._ui_to_cfg()
        t = pipeline.compute_tuning(self.cfg)
        msg = ('Tuning: Druck %.1f mm/s · Reise %.1f mm/s · Querschnitt %.2f mm² · '
               'Fluss %.1f mm³/s' % (t['print_speed_mms'], t['travel_speed_mms'],
                                     t['cross_section_mm2'], t['effective_flow_mm3s']))
        warn = ' | '.join(t['warnings'][:2])
        self.lbl_status.setText(msg + ('\n⚠ ' + warn if warn else ''))

    def on_load_stl(self):
        path, _ = QFileDialog.getOpenFileName(self, 'STL laden', '', 'STL (*.stl)')
        if path:
            self.stl_path = path
            self.lbl_status.setText('Geladen: ' + os.path.basename(path))

    def on_pick_reference(self):
        path, _ = QFileDialog.getOpenFileName(self, 'Referenz-STL', '', 'STL (*.stl)')
        if path:
            self.in_ref.setText(path)

    def on_slice(self):
        if not self.stl_path:
            QMessageBox.warning(self, APP_NAME, 'Bitte zuerst ein STL laden.')
            return
        self._ui_to_cfg()
        tris = pipeline.prepare_mesh(self.stl_path, self.cfg)
        errs = pipeline.check_fits_bed(tris, self.cfg)
        if errs:
            QMessageBox.critical(self, APP_NAME, 'Passt nicht in den Bauraum:\n' +
                                 '\n'.join(errs))
            return
        self.btn_slice.setEnabled(False)
        self.lbl_status.setText('Slicen…')
        self.worker = SliceWorker(self.stl_path, self.cfg)
        self.worker.done.connect(self._on_sliced)
        self.worker.failed.connect(self._on_slice_failed)
        self.worker.progress.connect(
            lambda i, n: self.lbl_status.setText('Slicen… Schicht %d/%d' % (i, n)))
        self.worker.start()

    def _on_sliced(self, text, result, tune):
        self.gcode_text = text
        self._last_result = result
        self.btn_slice.setEnabled(True)
        from .. import preview_data
        nmax = preview_data.layer_count(result)
        self.sld_layer.blockSignals(True)
        self.sld_layer.setMaximum(nmax)
        self.sld_layer.setValue(nmax)
        self.sld_layer.blockSignals(False)
        self.lbl_layer.setText('%d / %d' % (nmax, nmax))
        self._refresh_preview()
        self.lbl_status.setText(
            'Fertig: %d Schichten · Druck %.1f mm/s · %s · max Neigung %.0f° '
            '(Limit %.0f°)\n%s'
            % (result.meta['layers'], tune['print_speed_mms'],
               result.meta['field'], tune.get('max_surface_angle_deg', 0.0),
               self.cfg.process.max_surface_angle,
               ' | '.join(tune['warnings'][:2])))

    def _on_slice_failed(self, tb):
        self.btn_slice.setEnabled(True)
        QMessageBox.critical(self, APP_NAME, 'Slicing-Fehler:\n' + tb)

    def _on_layer_slider(self, val):
        if self._last_result:
            self.lbl_layer.setText('%d / %d' % (val, self.sld_layer.maximum()))
            self._refresh_preview()

    def _refresh_preview(self):
        if not self._last_result or not hasattr(self.preview, 'show_paths'):
            return
        peri, solid, sparse = preview_data.toolpath_polylines(
            self._last_result, max_seg=self.cfg.process.max_seg,
            max_layer=self.sld_layer.value())
        self.preview.show_paths(peri, solid, sparse,
                                show_infill=self.chk_infill.isChecked())

    def on_export(self):
        if not self.gcode_text:
            QMessageBox.warning(self, APP_NAME, 'Bitte zuerst slicen.')
            return
        path, _ = QFileDialog.getSaveFileName(self, 'G-code speichern', '',
                                              'G-code (*.gcode)')
        if path:
            with open(path, 'w') as f:
                f.write(self.gcode_text)
            self.lbl_status.setText('Gespeichert: ' + os.path.basename(path))

    # ---- Profile ------------------------------------------------------- #
    def _reload_profiles(self):
        self.cmb_profile.clear()
        self.cmb_profile.addItems(list_profiles())

    def on_save_profile(self):
        name, ok = QInputDialog.getText(self, 'Profil speichern', 'Name:',
                                        text=self.cfg.name)
        if ok and name:
            self._ui_to_cfg()
            self.cfg.name = name
            self.cfg.save(profile_path(name))
            self._reload_profiles()
            self.cmb_profile.setCurrentText(name)
            self.lbl_status.setText('Profil gespeichert: ' + name)

    def on_load_profile(self):
        name = self.cmb_profile.currentText()
        if not name:
            return
        self.cfg = AppConfig.load(profile_path(name))
        self._cfg_to_ui()
        self._update_tuning()
        self.lbl_status.setText('Profil geladen: ' + name)


def main():
    app = QtWidgets.QApplication(sys.argv)
    win = MainWindow()
    win.show()
    sys.exit(app.exec())


if __name__ == '__main__':
    main()
