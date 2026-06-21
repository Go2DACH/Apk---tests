#!/usr/bin/env bash
# Linux-Triage (read-only).  sudo ./linux-triage.sh /pfad/zum/usb
set -u
OUT="${1:-./triage-$(hostname)-$(date +%Y%m%d-%H%M%S)}"
mkdir -p "$OUT"; echo "[*] Triage -> $OUT"
{ uname -a; uptime; date -u; } > "$OUT/system.txt" 2>&1
ps auxww            > "$OUT/processes.txt" 2>&1
(ss -tupan || netstat -tupan) > "$OUT/sockets.txt" 2>&1
(lsof -nP || true)  > "$OUT/openfiles.txt" 2>&1
ip a; ip r; arp -an > "$OUT/network.txt" 2>&1
(crontab -l; ls -la /etc/cron*; cat /etc/crontab) > "$OUT/cron.txt" 2>&1
systemctl list-units --type=service --state=running > "$OUT/services.txt" 2>&1
(last -Faiw; lastb -Faiw 2>/dev/null) > "$OUT/logins.txt" 2>&1
cp -a /var/log/auth.log* /var/log/secure* "$OUT/" 2>/dev/null
cp -a /etc/passwd /etc/group "$OUT/" 2>/dev/null
(getent passwd | awk -F: '$3>=1000') > "$OUT/users.txt" 2>&1
find / -xdev -newermt "-2 days" -type f 2>/dev/null | head -2000 > "$OUT/recent-files.txt"
sha256sum $(find "$OUT" -type f) > "$OUT/_SHA256SUMS.txt" 2>/dev/null
echo "[+] Fertig. Manifest: $OUT/_SHA256SUMS.txt"
