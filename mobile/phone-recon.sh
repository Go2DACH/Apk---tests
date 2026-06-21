#!/usr/bin/env bash
# phone-recon.sh – schnelle Netz-Lage am Smartphone (Termux) -> ingest.json
# Nutzung:  ./phone-recon.sh [subnetz z.B. 10.0.0.0/24] [out.json]
set -u
OUT="${2:-ingest.json}"
TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

# Interface/Gateway/Subnetz bestimmen
if command -v ip >/dev/null 2>&1; then
  GW="$(ip route 2>/dev/null | awk '/default/{print $3; exit}')"
  IFACE="$(ip route 2>/dev/null | awk '/default/{print $5; exit}')"
  MYIP="$(ip -4 addr show "$IFACE" 2>/dev/null | awk '/inet /{print $2; exit}')"
else
  MYIP="$(ifconfig 2>/dev/null | awk '/inet /{print $2; exit}')"
fi
SUBNET="${1:-}"
if [ -z "$SUBNET" ] && [ -n "${MYIP:-}" ]; then
  SUBNET="$(echo "$MYIP" | sed 's#\.[0-9]*\(/[0-9]*\)\?$#.0/24#')"
fi
[ -z "${SUBNET:-}" ] && { echo "[!] Subnetz nicht erkannt – als Argument angeben."; exit 1; }
echo "[*] IF=$IFACE IP=$MYIP GW=$GW Subnetz=$SUBNET"

ARP="$( (ip neigh 2>/dev/null || arp -an 2>/dev/null) | tr '\n' ';' )"

# Ping-Sweep (nmap bevorzugt)
HOSTS_JSON=""
add_host() { # ip name
  local ip="$1" name="$2"
  [ -n "$HOSTS_JSON" ] && HOSTS_JSON="$HOSTS_JSON,"
  HOSTS_JSON="$HOSTS_JSON{\"ip\":\"$ip\",\"name\":\"${name//\"/}\",\"note\":\"recon\"}"
}
if command -v nmap >/dev/null 2>&1; then
  echo "[*] nmap -sn $SUBNET ..."
  while read -r ip name; do [ -n "$ip" ] && add_host "$ip" "${name:-}"; done < <(
    nmap -sn -n "$SUBNET" 2>/dev/null | awk '/Nmap scan report/{print $NF}' | sed 's/[()]//g' | awk '{print $1" "}'
  )
else
  echo "[*] nmap fehlt – nutze /bin-Ping (langsam)"
  base="$(echo "$SUBNET" | sed 's#0/.*##')"
  for i in $(seq 1 254); do ( ping -c1 -W1 "${base}${i}" >/dev/null 2>&1 && echo "${base}${i}" ) & done | while read -r ip; do add_host "$ip" ""; done
fi

# JSON schreiben (Ingest-Bundle fuer IR-Pilot)
{
  echo "{"
  echo "  \"source\": \"phone-recon\","
  echo "  \"ts\": \"$TS\","
  echo "  \"hosts\": [${HOSTS_JSON}],"
  echo "  \"notes\": ["
  echo "    \"Interface=$IFACE IP=$MYIP Gateway=$GW Subnetz=$SUBNET\","
  echo "    \"ARP/Neighbors: ${ARP//\"/}\""
  echo "  ],"
  echo "  \"timeline\": [ {\"ts\":\"$TS\",\"kind\":\"recon\",\"text\":\"phone-recon $SUBNET\"} ]"
  echo "}"
} > "$OUT"
echo "[+] $OUT geschrieben ($(grep -c '"ip"' "$OUT") Hosts). In IR-Pilot importieren."
