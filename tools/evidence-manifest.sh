#!/usr/bin/env bash
# Beweis-Manifest:  ./evidence-manifest.sh create|verify /pfad
set -u; CMD="${1:?create|verify}"; DIR="${2:?Pfad}"
MAN="$DIR/_SHA256SUMS.txt"
if [ "$CMD" = create ]; then
  ( cd "$DIR" && find . -type f ! -name '_SHA256SUMS.txt' -exec sha256sum {} + ) > "$MAN"
  echo "[+] Manifest: $MAN  ($(wc -l < "$MAN") Dateien)"
else
  ( cd "$DIR" && sha256sum -c _SHA256SUMS.txt ) && echo '[+] Integritaet OK' || echo '[!] ABWEICHUNG!'
fi
