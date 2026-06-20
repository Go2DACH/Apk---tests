#!/usr/bin/env python3
"""Rendert Bilder zur Brustorthese: (1) STL-Mesh, (2) alle Schichten 3D,
(3) Montage von Schicht-Querschnitten (zeigt Ablaufloch + Entluefter)."""

import sys
import os
import math
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d.art3d import Poly3DCollection, Line3DCollection
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from prosthetic_slicer import pipeline, geometry, preview_data
from prosthetic_slicer.config import AppConfig
import make_breast_orthosis as gen


def render_stl(tris, path):
    fig = plt.figure(figsize=(12, 5))
    # 3D schräg
    ax = fig.add_subplot(1, 2, 1, projection='3d')
    polys = [[(a[0], a[1], a[2]), (b[0], b[1], b[2]), (c[0], c[1], c[2])]
             for (a, b, c) in tris]
    ax.add_collection3d(Poly3DCollection(polys, alpha=0.92, facecolor='#d98c8c',
                                         edgecolor='#a55', linewidth=0.05))
    xs = [v[0] for t in tris for v in t]; ys = [v[1] for t in tris for v in t]
    zs = [v[2] for t in tris for v in t]
    ax.set_xlim(min(xs), max(xs)); ax.set_ylim(min(ys), max(ys)); ax.set_zlim(min(zs), max(zs))
    ax.set_box_aspect((max(xs)-min(xs), max(ys)-min(ys), max(zs)-min(zs)))
    ax.view_init(elev=22, azim=-60)
    ax.set_title('STL 3D (schräg)'); ax.set_xlabel('X'); ax.set_ylabel('Y'); ax.set_zlabel('Z')

    # 2D Radialprofil (zeigt konvex unten / konkav oben + variable Dicke)
    ax2 = fig.add_subplot(1, 2, 2)
    rr = np.linspace(-gen.R, gen.R, 200)
    zb = [gen.zb(abs(r)) for r in rr]
    zt = [gen.zt(abs(r)) for r in rr]
    ax2.fill_between(rr, zb, zt, color='#e7b7b7', label='Silikon-Querschnitt')
    ax2.plot(rr, zb, color='#b03030', lw=2, label='Boden (konvex, Warze unten)')
    ax2.plot(rr, zt, color='#3030b0', lw=2, label='Kontaktfläche (konkav, oben)')
    ax2.annotate('Wand Mitte %.0f mm' % (gen.zt(0) - gen.zb(0)), (0, gen.zb(0) + 2),
                 ha='center', fontsize=8)
    ax2.annotate('Rand %.0f mm' % (gen.zt(gen.R) - gen.zb(gen.R)),
                 (gen.R * 0.75, gen.zb(gen.R * 0.75) + 2), fontsize=8)
    ax2.set_aspect('equal'); ax2.set_xlabel('Radius [mm]'); ax2.set_ylabel('Z [mm]')
    ax2.set_title('Schnittprofil'); ax2.legend(fontsize=8, loc='lower center')
    fig.suptitle('Brustorthese: Brustwarze unten (konvex) · Narben-/Brustwand-Kontakt oben (konkav)')
    fig.tight_layout()
    fig.savefig(path, dpi=110)
    plt.close(fig)
    print('wrote', path)


def render_layers_3d(result, path):
    peri, solid, sparse = preview_data.toolpath_polylines(result, max_seg=1.5)
    fig = plt.figure(figsize=(12, 6))
    for idx, (el, az) in enumerate([(22, -60), (78, -90)]):
        ax = fig.add_subplot(1, 2, idx + 1, projection='3d')

        def segs(lines):
            out = []
            for ln in lines:
                for i in range(len(ln) - 1):
                    out.append([ln[i], ln[i + 1]])
            return out

        psegs = segs(peri)
        zvals = np.array([(s[0][2] + s[1][2]) / 2 for s in psegs]) if psegs else np.array([])
        if psegs:
            lc = Line3DCollection(psegs, cmap='viridis', linewidths=0.6)
            lc.set_array(zvals)
            ax.add_collection3d(lc)
        ssegs = segs(sparse)[::2]
        if ssegs:
            ax.add_collection3d(Line3DCollection(ssegs, colors=[(0.2, 0.7, 0.85, 0.25)],
                                                 linewidths=0.3))
        osegs = segs(solid)
        if osegs:
            ax.add_collection3d(Line3DCollection(osegs, colors=[(1, 0.55, 0.1, 0.5)],
                                                 linewidths=0.4))
        allp = [p for ln in peri for p in ln]
        xs = [p[0] for p in allp]; ys = [p[1] for p in allp]; zs = [p[2] for p in allp]
        ax.set_xlim(min(xs), max(xs)); ax.set_ylim(min(ys), max(ys)); ax.set_zlim(min(zs), max(zs))
        ax.set_box_aspect((max(xs)-min(xs), max(ys)-min(ys), max(zs)-min(zs)))
        ax.view_init(elev=el, azim=az)
        ax.set_title('alle Schichten (%d) – %s' % (
            result.meta['layers'], 'schräg' if idx == 0 else 'von oben'))
    fig.suptitle('Generierte non-planare Schichten (Perimeter nach Höhe, '
                 'Solid orange, Sparse cyan)')
    fig.tight_layout()
    fig.savefig(path, dpi=110)
    plt.close(fig)
    print('wrote', path)


def render_layer_grid(result, path, n=12):
    layers = result.layers
    # bis zur vorletzten Schicht (letzte ist oft ein degenerierter Apex),
    # damit auch die Top-Solid-Schale mit Ablaufloch in der Auswahl ist
    idxs = sorted(set(int(round(k)) for k in np.linspace(0, len(layers) - 2, n)))
    fig, axes = plt.subplots(3, 4, figsize=(12, 9))
    for ax, li in zip(axes.flat, idxs):
        layer = layers[li]
        for poly in layer.perimeters:
            xs = [p[0] for p in poly]; ys = [p[1] for p in poly]
            ax.plot(xs, ys, color='#1f77b4', lw=0.8)
        for (a, b) in layer.solid_infill:
            ax.plot([a[0], b[0]], [a[1], b[1]], color='#ff8c1a', lw=0.4)
        for (a, b) in layer.sparse_infill:
            ax.plot([a[0], b[0]], [a[1], b[1]], color='#33b5cc', lw=0.3)
        ax.set_title('Schicht %d (w=%.1f)' % (layer.index, layer.w), fontsize=8)
        ax.set_aspect('equal'); ax.set_xticks([]); ax.set_yticks([])
    fig.suptitle('Schicht-Querschnitte (Draufsicht): Ablaufloch (Mitte) + '
                 'seitliche Entlüfter sichtbar')
    fig.tight_layout()
    fig.savefig(path, dpi=110)
    plt.close(fig)
    print('wrote', path)


def main():
    tris = gen.build()
    here = os.path.dirname(os.path.abspath(__file__))
    stl = os.path.join(here, 'breast_orthosis.stl')
    gen.write_binary_stl(stl, tris)

    cfg = AppConfig()
    cfg.process.field = 'morph'
    cfg.process.infill_pattern = 'lines'
    cfg.process.infill_spacing = 4.0
    cfg.process.perimeters = 2
    cfg.process.max_surface_angle = 40.0
    cfg.process.top_layers = 4
    cfg.process.bottom_layers = 4
    cfg.process.drain_holes = 1
    cfg.process.drain_diameter = 9.0
    cfg.process.vent_holes = 4
    cfg.process.vent_diameter = 5.0
    _, result, tune = pipeline.run(stl, cfg)
    print('Schichten=%d  max Neigung=%.1f°' % (
        result.meta['layers'], tune['max_surface_angle_deg']))
    for w in tune['warnings']:
        print('  !', w)

    centered = pipeline.prepare_mesh(stl, cfg)
    render_stl(centered, os.path.join(here, 'breast_stl.png'))
    render_layers_3d(result, os.path.join(here, 'breast_layers.png'))
    render_layer_grid(result, os.path.join(here, 'breast_layers_grid.png'))


if __name__ == '__main__':
    main()
