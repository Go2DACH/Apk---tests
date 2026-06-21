#!/usr/bin/env bash
# RAM-Abbild.  sudo ./memory-acquire.sh /pfad/usb
# Linux: benoetigt 'avml' (https://github.com/microsoft/avml) auf dem Stick.
# Windows: winpmem  ->  winpmem.exe -o E:\\evidence\\mem.raw   (separat ausfuehren)
set -u; OUT="${1:-.}"; TS=$(date +%Y%m%d-%H%M%S); F="$OUT/mem-$(hostname)-$TS.lime"
DIR="$(cd "$(dirname "$0")" && pwd)"
AVML="$DIR/avml"; [ -x "$AVML" ] || AVML="$(command -v avml)"
if [ -z "$AVML" ]; then echo '[!] avml nicht gefunden – auf den Stick legen.'; exit 1; fi
echo "[*] RAM -> $F"; "$AVML" "$F" && sha256sum "$F" | tee "$F.sha256"
echo "[+] Fertig. Analyse mit Volatility3 (vol -f $F windows.pslist / linux.bash)."
