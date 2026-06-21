#!/usr/bin/env bash
# collect-windows-offline.sh – Schlusselartefakte von einer GEMOUNTETEN (ro) Windows-Platte
# Nutzung:  sudo ./collect-windows-offline.sh /mnt/evidence /pfad/usb
set -u
MNT="${1:?Windows-Mount (ro), z.B. /mnt/evidence}"; OUT="${2:-./win-offline-$(date +%Y%m%d-%H%M%S)}"
mkdir -p "$OUT"
echo "[*] Windows-Offline-Triage von $MNT -> $OUT"
copy(){ local src="$1"; [ -e "$src" ] && { mkdir -p "$OUT/$(dirname "${src#$MNT/}")"; cp -a "$src" "$OUT/${src#$MNT/}" 2>/dev/null && echo "  + ${src#$MNT/}"; }; }

# Registry-Hives
for h in SAM SYSTEM SECURITY SOFTWARE; do copy "$MNT/Windows/System32/config/$h"; done
# Event-Logs
mkdir -p "$OUT/Windows/System32/winevt/Logs"
cp -a "$MNT"/Windows/System32/winevt/Logs/*.evtx "$OUT/Windows/System32/winevt/Logs/" 2>/dev/null && echo "  + EVTX"
# Amcache / Prefetch / Tasks / hosts
copy "$MNT/Windows/AppCompat/Programs/Amcache.hve"
mkdir -p "$OUT/Windows/Prefetch"; cp -a "$MNT"/Windows/Prefetch/*.pf "$OUT/Windows/Prefetch/" 2>/dev/null && echo "  + Prefetch"
cp -a "$MNT/Windows/System32/Tasks" "$OUT/Windows/System32/" 2>/dev/null && echo "  + Tasks"
copy "$MNT/Windows/System32/drivers/etc/hosts"
# Pro-Nutzer: NTUSER.DAT, UsrClass, Startup, Downloads-Liste
for u in "$MNT"/Users/*; do
  [ -d "$u" ] || continue; un="$(basename "$u")"
  copy "$u/NTUSER.DAT"
  copy "$u/AppData/Local/Microsoft/Windows/UsrClass.dat"
  ls -la "$u/AppData/Roaming/Microsoft/Windows/Start Menu/Programs/Startup" > "$OUT/startup-$un.txt" 2>/dev/null
done
# Manifest
( cd "$OUT" && find . -type f ! -name '_SHA256SUMS.txt' -exec sha256sum {} + ) > "$OUT/_SHA256SUMS.txt" 2>/dev/null
cat > "$OUT/ingest.json" <<EOF
{ "source":"win-offline","ts":"$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "evidence":[ {"name":"Windows Offline-Triage","type":"datei","method":"ro-Mount Kopie",
    "location":"$OUT","volatility":"mittel"} ],
  "timeline":[ {"kind":"forensik","text":"Windows-Offline-Artefakte gesammelt"} ] }
EOF
echo "[+] Fertig: $OUT  (Hives -> RegRipper, EVTX -> Analyse, ingest.json importieren)"
