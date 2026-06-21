#!/usr/bin/env bash
# netup.sh – bringt das Smartphone und den Boot-Stick automatisch zusammen.
# Pro Daten-Interface: erst DHCP-Lease versuchen; klappt das nicht (kein DHCP im
# Vorfall-Netz / direkte USB-Ethernet-Strecke zum Handy), dann eigene statische
# IP vergeben und einen kleinen DHCP-Server starten, damit das Smartphone
# automatisch eine passende Adresse bekommt = gegenseitige Kopplung ohne Tippen.
#
#   sudo ./netup.sh            # alle Daten-Interfaces automatisch
#   sudo ./netup.sh eth1       # nur dieses Interface
#
# Default-Netz fuer die Direktstrecke: 10.13.37.0/24 (Stick = .1).
set -u
NET="${IR_NET:-10.13.37}"; SELF="${NET}.1"; RANGE_LO="${NET}.50"; RANGE_HI="${NET}.150"
LEASE="/run/ir-dnsmasq"; mkdir -p "$LEASE"

candidates() {
  if [ "$#" -ge 1 ] && [ -n "${1:-}" ]; then echo "$1"; return; fi
  # alle Ethernet-/USB-NICs ausser lo und dem Interface der Default-Route
  defif=$(ip route show default 2>/dev/null | awk '{print $5; exit}')
  for i in $(ls /sys/class/net 2>/dev/null); do
    [ "$i" = "lo" ] && continue
    [ "$i" = "$defif" ] && continue
    case "$i" in eth*|enp*|enx*|usb*) echo "$i";; esac
  done
}

dhcp_try() {  # kurze DHCP-Anfrage; 0 = Lease bekommen
  local i="$1"
  if command -v dhclient >/dev/null 2>&1; then
    timeout 8 dhclient -1 "$i" >/dev/null 2>&1 && return 0
  elif command -v dhcpcd >/dev/null 2>&1; then
    timeout 8 dhcpcd -t 8 "$i" >/dev/null 2>&1 && return 0
  elif command -v udhcpc >/dev/null 2>&1; then
    timeout 8 udhcpc -i "$i" -n -q >/dev/null 2>&1 && return 0
  fi
  ip -4 addr show "$i" 2>/dev/null | grep -q 'inet '   # evtl. schon eine Adresse?
}

serve_dhcp() {  # eigener Mini-DHCP, damit das Handy automatisch eine IP zieht
  local i="$1"
  if command -v dnsmasq >/dev/null 2>&1; then
    dnsmasq --interface="$i" --bind-interfaces \
      --dhcp-range="${RANGE_LO},${RANGE_HI},255.255.255.0,1h" \
      --dhcp-leasefile="$LEASE/$i.leases" --pid-file="$LEASE/$i.pid" \
      --no-daemon >/dev/null 2>&1 &
    echo "    DHCP-Server fuer Smartphone laeuft (${RANGE_LO}-${RANGE_HI})."
  elif command -v avahi-autoipd >/dev/null 2>&1; then
    avahi-autoipd -D "$i" >/dev/null 2>&1 || true
    echo "    Kein dnsmasq – Link-Local (169.254.x) aktiv; am Handy Auto-IP/APIPA nutzen."
  else
    echo "    Kein DHCP-Server/avahi – am Handy manuell IP ${NET}.50/24, Gateway ${SELF} setzen."
  fi
}

for IFACE in $(candidates "${1:-}"); do
  echo "[*] $IFACE: Link up …"; ip link set "$IFACE" up 2>/dev/null || true
  sleep 1
  if dhcp_try "$IFACE"; then
    echo "[+] $IFACE: DHCP-Lease erhalten -> $(ip -4 -o addr show "$IFACE" | awk '{print $4}')"
  else
    echo "[i] $IFACE: kein DHCP – vergebe statische IP ${SELF}/24"
    ip addr flush dev "$IFACE" 2>/dev/null || true
    ip addr add "${SELF}/24" dev "$IFACE" 2>/dev/null || true
    serve_dhcp "$IFACE"
  fi
done
echo "[=] Adressen:"; ip -4 -o addr show | awk '$2!="lo"{print "    "$2" "$4}'
echo "[=] Am Smartphone: WLAN/USB-Ethernet verbinden – IP kommt automatisch."
