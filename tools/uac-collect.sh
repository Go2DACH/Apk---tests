#!/usr/bin/env bash
# UAC (https://github.com/tclahr/uac).  sudo ./uac-collect.sh /pfad/usb
set -u; OUT="${1:-.}"; DIR="$(cd "$(dirname "$0")" && pwd)"
UAC="$DIR/uac"; [ -x "$UAC" ] || UAC="$(command -v uac)"
[ -z "$UAC" ] && { echo '[!] uac fehlt (Release auf den Stick entpacken).'; exit 1; }
sudo "$UAC" -p ir_triage "$OUT" 2>>"$OUT/uac.log"
echo "[+] Fertig. UAC-Archiv (+ Hash) im Ausgabeordner."
