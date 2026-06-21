#!/usr/bin/env bash
# make-release.sh – baut ein self-contained Release-Bundle (offline, USB-tauglich).
#   bash build/make-release.sh
# Ergebnis: dist/release/IR-Pilot-<version>.zip (+ .sha256)
set -eu
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
VERSION="$(node -e "console.log(require('./package.json').version)")"
NAME="IR-Pilot-$VERSION"
STAGE="$ROOT/dist/release/$NAME"
OUT="$ROOT/dist/release"
echo "[*] Release $VERSION"

# 1) Tests muessen gruen sein
echo "[*] Tests..."
node tests/run.js >/dev/null && node tests/ui.js >/dev/null && echo "    OK"

# 2) Aktuelle Artefakte erzeugen (Tools materialisieren, Einsatzkarten-HTML)
node tools/export-tools.js >/dev/null
node build/make-cards.js >/dev/null

# 3) Staging zusammenstellen
rm -rf "$STAGE"; mkdir -p "$STAGE"
for item in index.html sw.js manifest.webmanifest css js data tools mobile desktop \
            build assets README.md CHANGELOG.md package.json; do
  [ -e "$ROOT/$item" ] && cp -a "$ROOT/$item" "$STAGE/"
done
# Doku/PDFs beilegen (sofern vorhanden)
mkdir -p "$STAGE/doku"
for f in dist/IR-Pilot_Einsatzkarten.pdf dist/IR-Pilot_Walkthrough.pdf \
         dist/einsatzkarten.html dist/playthrough-report.md; do
  [ -e "$ROOT/$f" ] && cp -a "$ROOT/$f" "$STAGE/doku/"
done
echo "$VERSION" > "$STAGE/VERSION"
chmod +x "$STAGE"/tools/*.sh "$STAGE"/mobile/*.sh "$STAGE"/desktop/*.sh "$STAGE"/build/*.sh 2>/dev/null || true

# Start-Hinweis
cat > "$STAGE/START_HIER.txt" <<EOF
IR-Pilot $VERSION – Start
=========================
1) index.html im Browser oeffnen (Doppelklick / "Oeffnen mit Browser").
   Laeuft komplett offline, auch vom USB-Stick und am Smartphone.
2) Gefuehrter Start (Assistent): Umgebung + Beobachtung waehlen -> Playbook.
3) Forensik-Skripte: tools/ (Triage), desktop/ (Offline-Platte), mobile/ (Termux).
   Ergebnisse (ingest.json) in der App unter "Bericht -> Daten importieren".
4) Bootbares Forensik-Linux + USB: build/build-live-iso.sh bzw. make-toolkit-usb.sh.
5) Einsatzkarten/Doku: doku/

Defensives Werkzeug fuer autorisierte Incident Response. Sammler sind read-only.
EOF

# Integritaets-Manifest
( cd "$STAGE" && find . -type f ! -name '_SHA256SUMS.txt' -exec sha256sum {} + > _SHA256SUMS.txt )

# 4) Zippen
cd "$OUT"
rm -f "$NAME.zip"
if command -v zip >/dev/null; then
  zip -rq "$NAME.zip" "$NAME"
else
  tar -czf "$NAME.tar.gz" "$NAME"; NAME="$NAME (tar.gz)"
fi
ARCHIVE="$(ls -1 "$OUT"/${NAME%% *}.zip 2>/dev/null || ls -1 "$OUT"/*.tar.gz | tail -1)"
sha256sum "$ARCHIVE" | tee "$ARCHIVE.sha256"
echo "[+] Release: $ARCHIVE"
du -h "$ARCHIVE" | cut -f1 | xargs echo "    Groesse:"
