#!/usr/bin/env bash
# Passiver Mitschnitt ueber USB-Ethernet.  sudo ./ot-capture.sh eth1 /pfad/usb [minuten]
set -u
IFACE="${1:?Interface angeben, z.B. eth1}"; OUT="${2:-.}"; MIN="${3:-15}"
mkdir -p "$OUT"
ip link set "$IFACE" up; ip link set "$IFACE" promisc on
TS=$(date +%Y%m%d-%H%M%S); F="$OUT/capture-$IFACE-$TS.pcap"
echo "[*] Mitschnitt $IFACE -> $F (${MIN} min). Abbruch mit Ctrl-C."
timeout "${MIN}m" tcpdump -i "$IFACE" -s 0 -w "$F" -W 20 -C 100 2>>"$OUT/capture.log"
sha256sum "$F"* > "$F.sha256" 2>/dev/null
echo "[+] Fertig: $F  (Analyse: Wireshark/Zeek; Filter 'ip.addr==<C2>', tcp.port 102/2404)"
