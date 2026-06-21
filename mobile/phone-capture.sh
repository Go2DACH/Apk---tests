#!/usr/bin/env bash
# phone-capture.sh – passiver Mitschnitt ueber USB-Ethernet am Smartphone (Termux, root)
# Nutzung:  sudo ./phone-capture.sh <iface> [minuten] [out_dir]
# Hinweis: benoetigt root (tsu) und tcpdump. Karte NUR an SPAN/TAP.
set -u
IFACE="${1:?Interface angeben (ip link)}"; MIN="${2:-10}"; OUT="${3:-.}"
TS="$(date -u +%Y%m%d-%H%M%SZ)"; F="$OUT/capture-$IFACE-$TS.pcap"
command -v tcpdump >/dev/null 2>&1 || { echo "[!] tcpdump fehlt: pkg install tcpdump"; exit 1; }
ip link set "$IFACE" up 2>/dev/null; ip link set "$IFACE" promisc on 2>/dev/null
echo "[*] Mitschnitt $IFACE -> $F (${MIN} min, Ctrl-C bricht ab)"
timeout "${MIN}m" tcpdump -i "$IFACE" -s0 -w "$F" 2>>"$OUT/capture.log"
sha256sum "$F" 2>/dev/null | tee "$F.sha256"
# Ingest-Notiz fuer IR-Pilot (als Beweis erfassen)
cat > "$OUT/ingest-capture.json" <<EOF
{ "source":"phone-capture", "ts":"$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "evidence":[ {"name":"$(basename "$F")","type":"netzwerk","method":"tcpdump USB-Ethernet",
    "hash":"$(cut -d' ' -f1 "$F.sha256" 2>/dev/null)","location":"USB","volatility":"hoch"} ],
  "timeline":[ {"kind":"forensik","text":"pcap $IFACE ${MIN}min gesichert"} ] }
EOF
echo "[+] $F + ingest-capture.json (in IR-Pilot importieren). Analyse: Wireshark/tshark."
