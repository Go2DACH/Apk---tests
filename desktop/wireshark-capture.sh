#!/usr/bin/env bash
# wireshark-capture.sh – Mitschnitt mit tshark (Wireshark CLI), one-click vom
# Smartphone. Fallback auf tcpdump. Ergebnis (pcapng + Kurzstatistik) -> EVIDENCE.
#   sudo ./wireshark-capture.sh [iface] [out] [minuten] [capture-filter]
set -u
IFACE="${1:-eth1}"; OUT="${2:-.}"; MIN="${3:-5}"; FILTER="${4:-}"
mkdir -p "$OUT"
ip link set "$IFACE" up 2>/dev/null || true
ip link set "$IFACE" promisc on 2>/dev/null || true
TS=$(date +%Y%m%d-%H%M%S); F="$OUT/wireshark-$IFACE-$TS.pcapng"
SECS=$(( MIN * 60 ))
echo "[*] Wireshark/tshark Mitschnitt $IFACE -> $F (${MIN} min, Filter='${FILTER:-alle}')"
if command -v tshark >/dev/null 2>&1; then
  if [ -n "$FILTER" ]; then
    tshark -i "$IFACE" -a duration:"$SECS" -w "$F" -f "$FILTER" 2>>"$OUT/wireshark.log" || true
  else
    tshark -i "$IFACE" -a duration:"$SECS" -w "$F" 2>>"$OUT/wireshark.log" || true
  fi
  # Kurzstatistik fuer schnelle Lagebewertung am Smartphone
  tshark -r "$F" -q -z conv,tcp 2>/dev/null | head -40 > "$F.conv.txt" || true
  tshark -r "$F" -q -z io,phs   2>/dev/null | head -60 >> "$F.conv.txt" || true
elif command -v tcpdump >/dev/null 2>&1; then
  echo "[i] tshark fehlt – nutze tcpdump"
  timeout "${SECS}s" tcpdump -i "$IFACE" -s 0 ${FILTER:+$FILTER} -w "$F" 2>>"$OUT/wireshark.log" || true
else
  echo "[!] weder tshark noch tcpdump vorhanden"; exit 1
fi
sha256sum "$F"* > "$F.sha256" 2>/dev/null || true
echo "[+] Fertig: $F  (Analyse in Wireshark; Statistik: $F.conv.txt)"
