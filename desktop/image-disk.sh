#!/usr/bin/env bash
# image-disk.sh – Datentraeger forensisch sichern (raw via ddrescue oder E01 via ewfacquire)
# Nutzung:  sudo ./image-disk.sh /dev/sdb /pfad/usb [raw|ewf]
set -eu
DEV="${1:?Quell-Geraet, z.B. /dev/sdb}"; OUT="${2:?Ausgabeordner}"; FMT="${3:-ewf}"
mkdir -p "$OUT"; TS="$(date +%Y%m%d-%H%M%S)"; BASE="$OUT/image-$(basename "$DEV")-$TS"
echo "[*] Quelle: $DEV  Ziel: $BASE  Format: $FMT"
echo "[!] Sicherstellen, dass $DEV per Write-Blocker/ro angeschlossen ist."
if [ "$FMT" = ewf ] && command -v ewfacquire >/dev/null; then
  ewfacquire -u -t "$BASE" -f encase6 -c fast -S 2GiB "$DEV"
  ewfverify "$BASE.E01" | tee "$BASE.verify.txt"
elif command -v ddrescue >/dev/null; then
  ddrescue -f -n "$DEV" "$BASE.raw" "$BASE.map"
  echo "[*] Hash..."; sha256sum "$BASE.raw" | tee "$BASE.raw.sha256"
else
  dd if="$DEV" of="$BASE.raw" bs=4M conv=noerror,sync status=progress
  sha256sum "$BASE.raw" | tee "$BASE.raw.sha256"
fi
# Ingest-Stub fuer IR-Pilot
cat > "$OUT/ingest-image-$TS.json" <<EOF
{ "source":"image-disk","ts":"$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "evidence":[ {"name":"$(basename "$BASE")","type":"image","method":"$FMT ($DEV)",
    "location":"$OUT","volatility":"niedrig"} ],
  "timeline":[ {"kind":"forensik","text":"Disk-Image $DEV gesichert"} ] }
EOF
echo "[+] Fertig: $BASE*  (+ ingest-Datei zum Import)"
