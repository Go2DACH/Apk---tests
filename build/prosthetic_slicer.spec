# -*- mode: python ; coding: utf-8 -*-
# PyInstaller-Spezifikation fuer den Non-Planar Silicone Slicer.
#
# Build:  pyinstaller build/prosthetic_slicer.spec
# Ergebnis: dist/NonPlanarSiliconeSlicer/  (One-Folder)

from PyInstaller.utils.hooks import collect_all

datas, binaries, hiddenimports = [], [], []
for pkg in ('pyqtgraph', 'OpenGL'):
    d, b, h = collect_all(pkg)
    datas += d; binaries += b; hiddenimports += h

hiddenimports += [
    'pyqtgraph.opengl',
    'PySide6.QtOpenGL',
    'PySide6.QtOpenGLWidgets',
]

block_cipher = None

a = Analysis(
    ['..\\app_main.py'],
    pathex=['..'],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    runtime_hooks=[],
    excludes=['tkinter', 'matplotlib', 'pytest'],
    cipher=block_cipher,
    noarchive=False,
)
pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz, a.scripts, [],
    exclude_binaries=True,
    name='NonPlanarSiliconeSlicer',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,        # GUI-App, kein Konsolenfenster
)
coll = COLLECT(
    exe, a.binaries, a.zipfiles, a.datas,
    strip=False, upx=True, upx_exclude=[],
    name='NonPlanarSiliconeSlicer',
)
