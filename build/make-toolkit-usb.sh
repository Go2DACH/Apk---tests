#!/usr/bin/env bash
# make-toolkit-usb.sh – legt die IR-Pilot-App + alle Skripte auf eine USB-Datenpartition.
# Fuer den Fall, dass du eine fertige Forensik-Distro (CAINE/Tails) bootest und nur
# das Toolkit + die App offline dabei haben willst.
#
#   ./make-toolkit-usb.sh /media/USB        (Zielordner/-mountpoint)
set -eu
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="${1:?Zielordner/Mountpoint angeben, z.B. /media/USB}"
TARGET="$DEST/IR-Pilot"
mkdir -p "$TARGET"
echo "[*] Kopiere IR-Pilot nach $TARGET"
for d in index.html sw.js manifest.webmanifest css js data tools mobile desktop assets README.md; do
  [ -e "$ROOT/$d" ] && cp -a "$ROOT/$d" "$TARGET/"
done
chmod +x "$TARGET"/tools/*.sh "$TARGET"/mobile/*.sh "$TARGET"/desktop/*.sh 2>/dev/null || true
# Startseite/Verknuepfung
cat > "$TARGET/START.txt" <<'EOF'
IR-Pilot – Start
================
1) index.html im Browser oeffnen (Doppelklick / xdg-open).
2) Forensik-Skripte: tools/ (Triage), desktop/ (Offline-Platte), mobile/ (Termux).
3) Ergebnisse (ingest.json) in IR-Pilot unter "Bericht -> Daten importieren".
EOF
( cd "$TARGET" && find . -type f -exec sha256sum {} + > _MANIFEST.sha256 2>/dev/null ) || true
echo "[+] Fertig. Inhalt:"; ls -la "$TARGET"
