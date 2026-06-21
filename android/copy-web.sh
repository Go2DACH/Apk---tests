#!/usr/bin/env bash
# Kopiert die Web-App (PWA) in die APK-Assets (gebuendelte Offline-Version).
set -eu
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DST="$ROOT/android/app/src/main/assets/www"
rm -rf "$DST"; mkdir -p "$DST"
for d in index.html dashboard.html sw.js manifest.webmanifest css js data assets tools mobile desktop windows cloud README.md; do
  [ -e "$ROOT/$d" ] && cp -a "$ROOT/$d" "$DST/"
done
echo "[+] Web-App -> $DST"
