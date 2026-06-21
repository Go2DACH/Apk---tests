#!/usr/bin/env bash
# discover.sh – aktive Hosts im Subnetz finden (one-click vom Smartphone).
#   sudo ./discover.sh [iface] [out]
# Schreibt hosts-<ts>.txt + .json nach OUT (EVIDENCE). Nutzt arp-scan, sonst
# nmap, sonst Ping-Sweep. Ergebnis landet im Dashboard/Beweisordner.
set -u
IFACE="${1:-}"; OUT="${2:-.}"; mkdir -p "$OUT"
TS=$(date +%Y%m%d-%H%M%S)
# Interface automatisch waehlen, wenn nicht angegeben (erstes mit IPv4, nicht lo).
if [ -z "$IFACE" ]; then
  IFACE=$(ip -o -4 addr show up 2>/dev/null | awk '$2!="lo"{print $2; exit}')
fi
[ -z "$IFACE" ] && { echo "[!] kein Interface mit IPv4 gefunden"; exit 1; }
ip link set "$IFACE" up 2>/dev/null || true
CIDR=$(ip -o -4 addr show "$IFACE" 2>/dev/null | awk '{print $4; exit}')
TXT="$OUT/hosts-$IFACE-$TS.txt"; JSON="$OUT/hosts-$IFACE-$TS.json"
echo "[*] Discover auf $IFACE ($CIDR) -> $TXT"
{ echo "# IR-Pilot Discover $TS  iface=$IFACE  net=$CIDR"; } > "$TXT"
if command -v arp-scan >/dev/null 2>&1; then
  arp-scan --interface="$IFACE" --localnet 2>/dev/null | tee -a "$TXT"
elif command -v nmap >/dev/null 2>&1 && [ -n "$CIDR" ]; then
  nmap -sn "$CIDR" 2>/dev/null | tee -a "$TXT"
elif [ -n "$CIDR" ]; then
  base=$(echo "$CIDR" | cut -d/ -f1 | cut -d. -f1-3)
  for i in $(seq 1 254); do ( ping -c1 -W1 "$base.$i" >/dev/null 2>&1 && echo "$base.$i up" >>"$TXT" ) & done; wait
  sort -V -o "$TXT" "$TXT"
else
  echo "[!] keine IPv4/CIDR – Discover nicht moeglich" | tee -a "$TXT"
fi
# einfache JSON-Liste der gefundenen IPs (fuer App/Dashboard)
ips=$(grep -oE '([0-9]{1,3}\.){3}[0-9]{1,3}' "$TXT" | sort -u -V | grep -v '^0\.' || true)
{ printf '{"iface":"%s","cidr":"%s","ts":"%s","hosts":[' "$IFACE" "$CIDR" "$TS"
  first=1; for ip in $ips; do [ $first = 1 ] || printf ','; printf '"%s"' "$ip"; first=0; done
  printf ']}\n'; } > "$JSON"
sha256sum "$TXT" "$JSON" > "$OUT/$(basename "$TXT").sha256" 2>/dev/null || true
echo "[+] Fertig: $(echo "$ips" | grep -c . ) Hosts. $JSON"
