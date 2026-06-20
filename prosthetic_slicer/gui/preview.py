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
        self._items = []

    def clear_paths(self):
        for it in getattr(self, '_items', []):
            self.removeItem(it)
        self._items = []

    def show_paths(self, peri_lines, solid_lines, sparse_lines,
                   show_infill=True):
        """Perimeter (nach Z eingefaerbt), Solid (orange), Sparse (cyan)."""
        self.clear_paths()
        self._items = getattr(self, '_items', [])
        for it in self._items:
            self.removeItem(it)
        self._items = []

        seg_p = _lines_to_segments(peri_lines)
        seg_s = _lines_to_segments(solid_lines) if show_infill else \
            np.zeros((0, 3), dtype=np.float32)
        seg_q = _lines_to_segments(sparse_lines) if show_infill else \
            np.zeros((0, 3), dtype=np.float32)
        parts = [v for v in (seg_p, seg_s, seg_q) if len(v)]
        if not parts:
            return
        allv = np.vstack(parts)
        zmin, zmax = float(allv[:, 2].min()), float(allv[:, 2].max())

        if len(seg_p):
            it = gl.GLLinePlotItem(pos=seg_p, color=_color_by_z(seg_p, zmin, zmax),
                                   width=2.0, mode='lines', antialias=True)
            self.addItem(it); self._items.append(it)
        if len(seg_s):
            cs = np.tile(np.array([1.0, 0.55, 0.1, 0.9], np.float32), (len(seg_s), 1))
            it = gl.GLLinePlotItem(pos=seg_s, color=cs, width=1.5,
                                   mode='lines', antialias=True)
            self.addItem(it); self._items.append(it)
        if len(seg_q):
            cq = np.tile(np.array([0.2, 0.8, 0.9, 0.5], np.float32), (len(seg_q), 1))
            it = gl.GLLinePlotItem(pos=seg_q, color=cq, width=1.0,
                                   mode='lines', antialias=True)
            self.addItem(it); self._items.append(it)

        cx, cy, cz = allv.mean(axis=0)
        self.opts['center'] = Vector(cx, cy, cz)
        span = float(np.linalg.norm(allv.max(axis=0) - allv.min(axis=0)))
        self.opts['distance'] = max(50.0, span * 1.6)
        self.update()
