"""OpenGL-3D-Vorschau der Werkzeugbahnen (PySide6 + pyqtgraph)."""

import numpy as np
import pyqtgraph.opengl as gl
from pyqtgraph import Vector


def _color_by_z(verts, zmin, zmax):
    if zmax - zmin < 1e-6:
        t = np.zeros(len(verts))
    else:
        t = (verts[:, 2] - zmin) / (zmax - zmin)
    # blau (unten) -> rot (oben)
    cols = np.zeros((len(verts), 4), dtype=np.float32)
    cols[:, 0] = t
    cols[:, 2] = 1.0 - t
    cols[:, 1] = 0.3
    cols[:, 3] = 1.0
    return cols


def _lines_to_segments(lines):
    """Polylinien -> (N*2, 3)-Array aus Segment-Endpunkten (mode='lines')."""
    seg = []
    for ln in lines:
        for i in range(len(ln) - 1):
            seg.append(ln[i]); seg.append(ln[i + 1])
    if not seg:
        return np.zeros((0, 3), dtype=np.float32)
    return np.array(seg, dtype=np.float32)


class PreviewWidget(gl.GLViewWidget):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setBackgroundColor('#1e1e1e')
        self.opts['distance'] = 250
        self.grid = gl.GLGridItem()
        self.grid.setSize(300, 300)
        self.grid.setSpacing(20, 20)
        self.addItem(self.grid)
        self._peri = None
        self._infill = None

    def clear_paths(self):
        for it in (self._peri, self._infill):
            if it is not None:
                self.removeItem(it)
        self._peri = self._infill = None

    def show_paths(self, peri_lines, infill_lines, show_infill=True):
        self.clear_paths()
        seg_p = _lines_to_segments(peri_lines)
        seg_i = _lines_to_segments(infill_lines) if show_infill else \
            np.zeros((0, 3), dtype=np.float32)
        allv = np.vstack([v for v in (seg_p, seg_i) if len(v)]) \
            if (len(seg_p) or len(seg_i)) else np.zeros((0, 3), dtype=np.float32)
        if not len(allv):
            return
        zmin, zmax = float(allv[:, 2].min()), float(allv[:, 2].max())
        if len(seg_p):
            self._peri = gl.GLLinePlotItem(
                pos=seg_p, color=_color_by_z(seg_p, zmin, zmax),
                width=2.0, mode='lines', antialias=True)
            self.addItem(self._peri)
        if len(seg_i):
            ci = _color_by_z(seg_i, zmin, zmax)
            ci[:, 3] = 0.45
            self._infill = gl.GLLinePlotItem(
                pos=seg_i, color=ci, width=1.0, mode='lines', antialias=True)
            self.addItem(self._infill)
        # Kamera auf Modellmitte
        cx, cy, cz = allv.mean(axis=0)
        self.opts['center'] = Vector(cx, cy, cz)
        span = float(np.linalg.norm(allv.max(axis=0) - allv.min(axis=0)))
        self.opts['distance'] = max(50.0, span * 1.6)
        self.update()
