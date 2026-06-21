#!/usr/bin/env bash
# Super-Timeline.  ./make-timeline.sh /pfad/zu/image_oder_mount /pfad/usb
set -u; SRC="${1:?Image/Mount}"; OUT="${2:-.}"; TS=$(date +%Y%m%d-%H%M%S)
if command -v log2timeline.py >/dev/null; then
  log2timeline.py --status_view none "$OUT/plaso-$TS.dump" "$SRC" &&
  psort.py -o l2tcsv -w "$OUT/timeline-$TS.csv" "$OUT/plaso-$TS.dump"
elif command -v fls >/dev/null; then
  fls -r -m / "$SRC" > "$OUT/bodyfile-$TS.txt" && mactime -b "$OUT/bodyfile-$TS.txt" -d > "$OUT/timeline-$TS.csv"
else echo '[!] Weder plaso noch sleuthkit gefunden.'; exit 1; fi
sha256sum "$OUT"/timeline-$TS.csv > "$OUT/timeline-$TS.csv.sha256" 2>/dev/null
echo "[+] Timeline: $OUT/timeline-$TS.csv"
