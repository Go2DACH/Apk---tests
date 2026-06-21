#!/usr/bin/env bash
# collect-linux-offline.sh – Schlusselartefakte von einer GEMOUNTETEN (ro) Linux-Platte
# Nutzung:  sudo ./collect-linux-offline.sh /mnt/evidence /pfad/usb
set -u
MNT="${1:?Linux-Mount (ro)}"; OUT="${2:-./linux-offline-$(date +%Y%m%d-%H%M%S)}"
mkdir -p "$OUT"; echo "[*] Linux-Offline-Triage von $MNT -> $OUT"
copy(){ for p in "$@"; do [ -e "$MNT/$p" ] && { mkdir -p "$OUT/$(dirname "$p")"; cp -a "$MNT/$p" "$OUT/$p" 2>/dev/null && echo "  + $p"; }; done; }

copy etc/passwd etc/group etc/shadow etc/sudoers etc/hostname etc/hosts etc/crontab
copy etc/cron.d etc/cron.daily etc/cron.hourly etc/ssh/sshd_config
copy root/.bash_history root/.ssh/authorized_keys root/.ssh/known_hosts
[ -d "$MNT/var/log" ] && { mkdir -p "$OUT/var/log"; cp -a "$MNT"/var/log/{auth.log*,secure*,syslog*,messages*,wtmp,btmp} "$OUT/var/log/" 2>/dev/null && echo "  + var/log"; }
[ -d "$MNT/etc/systemd/system" ] && { cp -a "$MNT/etc/systemd/system" "$OUT/etc/systemd-system" 2>/dev/null && echo "  + systemd units"; }
for h in "$MNT"/home/*; do
  [ -d "$h" ] || continue; hn="$(basename "$h")"
  [ -f "$h/.bash_history" ] && cp -a "$h/.bash_history" "$OUT/home-$hn-bash_history" 2>/dev/null
  [ -f "$h/.ssh/authorized_keys" ] && cp -a "$h/.ssh/authorized_keys" "$OUT/home-$hn-authorized_keys" 2>/dev/null
done
( cd "$OUT" && find . -type f ! -name '_SHA256SUMS.txt' -exec sha256sum {} + ) > "$OUT/_SHA256SUMS.txt" 2>/dev/null
cat > "$OUT/ingest.json" <<EOF
{ "source":"linux-offline","ts":"$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "evidence":[ {"name":"Linux Offline-Triage","type":"datei","method":"ro-Mount Kopie",
    "location":"$OUT","volatility":"mittel"} ],
  "timeline":[ {"kind":"forensik","text":"Linux-Offline-Artefakte gesammelt"} ] }
EOF
echo "[+] Fertig: $OUT  (ingest.json in IR-Pilot importieren)"
