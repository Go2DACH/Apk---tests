#!/usr/bin/env bash
# make-kit.sh – schnuert das "Werkzeug-Kit" als EINE ZIP, die in die APK
# eingebettet und im Web zum Download angeboten wird. Enthaelt alles, um
# Boot-Stick + Windows-Sammler + die App selbst on-site bereitzustellen –
# damit es nur EINE App/Quelle gibt, kein separates Download-Paket.
#
#   bash build/make-kit.sh            -> dist/ir-pilot-kit.zip (+ .sha256)
set -eu
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; cd "$ROOT"
VER="$(node -e "console.log(require('./package.json').version)" 2>/dev/null || echo 1.0.0)"
STAGE="$ROOT/dist/_kit"; OUT="$ROOT/dist/ir-pilot-kit.zip"
rm -rf "$STAGE"; mkdir -p "$STAGE"

# 1) App (damit der Stick die volle App offline ausliefern kann)
for d in index.html dashboard.html sw.js manifest.webmanifest css js data assets cloud docs README.md; do
  [ -e "$ROOT/$d" ] && cp -a "$ROOT/$d" "$STAGE/"
done
# 2) Host-/Asset-Komponenten + Provisionierung
for d in desktop windows mobile tools; do [ -e "$ROOT/$d" ] && cp -a "$ROOT/$d" "$STAGE/"; done
mkdir -p "$STAGE/build"
for f in build/build-live-iso.sh build/packages.list build/make-toolkit-usb.sh; do
  [ -e "$ROOT/$f" ] && cp -a "$ROOT/$f" "$STAGE/build/"
done

cat > "$STAGE/START_HIER.txt" <<EOF
IR-Pilot Werkzeug-Kit $VER
==========================
Eine Quelle fuer alles On-Site:

1) App offline starten:   index.html im Browser oeffnen (auch am Smartphone/Stick).
2) Boot-Stick bauen:      build/build-live-iso.sh  (Debian live-build, Forensik-Linux).
   - Auf dem Stick startet control-server.py automatisch (Smartphone-Fernsteuerung).
3) Windows-Sammler:       windows/IR-Collect.cmd  (read-only Triage -> Upload ans Handy).
4) Steuern/auswerten:     in der App unter "Forensik-Hosts" + "Cloud" + "Dashboard".

Endbild:
  - Web-Dashboard (Internet) = alle Daten + Playbook-Stand (dashboard.html / Pages).
  - On-Site-App (APK)        = verwaltet alles vor Ort, exportiert dieses Kit.
  - Host/Asset (Stick/Win)   = sammeln Forensik, liefern an die App.
EOF
echo "$VER" > "$STAGE/VERSION"

( cd "$STAGE" && find . -type f ! -name _SHA256SUMS.txt -exec sha256sum {} + > _SHA256SUMS.txt )

rm -f "$OUT"
if command -v zip >/dev/null; then ( cd "$STAGE" && zip -rq "$OUT" . ); else
  ( cd "$ROOT/dist" && tar -czf "${OUT%.zip}.tar.gz" -C "$STAGE" . ); OUT="${OUT%.zip}.tar.gz"; fi
rm -rf "$STAGE"
sha256sum "$OUT" | tee "$OUT.sha256"
echo "[+] Kit: $OUT ($(du -h "$OUT" | cut -f1))"
