#!/usr/bin/env bash
# Velociraptor Offline-Collection.  ./velociraptor-collect.sh /pfad/usb
# Binary von https://github.com/Velocidex/velociraptor auf den Stick legen (velociraptor).
set -u; OUT="${1:-.}"; DIR="$(cd "$(dirname "$0")" && pwd)"
VR="$DIR/velociraptor"; [ -x "$VR" ] || VR="$(command -v velociraptor)"
[ -z "$VR" ] && { echo '[!] velociraptor-Binary fehlt (auf den Stick legen).'; exit 1; }
# Windows-Beispielartefakte; fuer Linux: Linux.Search.FileFinder / Linux.Sys.* 
"$VR" artifacts collect Windows.KapeFiles.Targets \
  --args Device=C: --args _SANS_Triage=Y \
  --output "$OUT/velociraptor-$(hostname)-$(date +%Y%m%d-%H%M%S).zip" 2>>"$OUT/vr.log"
echo "[+] Fertig. ZIP im Ausgabeordner. (Linux: passende Linux.* Artefakte nutzen.)"
