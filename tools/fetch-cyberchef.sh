#!/usr/bin/env bash
# Holt das CyberChef Standalone-HTML (offline).  ./fetch-cyberchef.sh [zielordner]
set -u; DEST="${1:-$(cd "$(dirname "$0")" && pwd)/cyberchef}"; mkdir -p "$DEST"
API='https://api.github.com/repos/gchq/CyberChef/releases/latest'
echo '[*] Ermittle neueste CyberChef-Version...'
URL="$(curl -fsSL "$API" | grep -oE 'https://[^"]+CyberChef_v[0-9.]+\.zip' | head -1)"
[ -z "${URL:-}" ] && { echo '[!] Download-URL nicht gefunden (Internet noetig).'; exit 1; }
TMP="$(mktemp -d)"; echo "[*] Lade $URL"
curl -fsSL "$URL" -o "$TMP/cc.zip" && unzip -o -q "$TMP/cc.zip" -d "$TMP"
HTML="$(find "$TMP" -name 'CyberChef_v*.html' | head -1)"
[ -z "${HTML:-}" ] && { echo '[!] HTML nicht gefunden.'; exit 1; }
cp "$HTML" "$DEST/CyberChef.html"; sha256sum "$DEST/CyberChef.html" | tee "$DEST/CyberChef.html.sha256"
rm -rf "$TMP"; echo "[+] Offline bereit: $DEST/CyberChef.html (im Browser oeffnen)."
