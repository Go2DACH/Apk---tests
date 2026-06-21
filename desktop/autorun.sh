#!/usr/bin/env bash
# autorun.sh – Desktop-Starter auf dem Live-USB: oeffnet IR-Pilot + Menue
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"; APP="$HERE/../index.html"
open_app(){ (xdg-open "$APP" 2>/dev/null || sensible-browser "$APP" 2>/dev/null || firefox "$APP" 2>/dev/null) & }
echo "==== IR-Pilot Desktop ===="
open_app
while true; do
  cat <<'M'

  1) Ziel-Partition read-only mounten   (mount-ro.sh)
  2) Datentraeger sichern (Image)        (image-disk.sh)
  3) Windows offline sammeln             (collect-windows-offline.sh)
  4) Linux offline sammeln               (collect-linux-offline.sh)
  5) Geraete anzeigen (lsblk)
  6) IR-Pilot erneut oeffnen
  7) Smartphone-Steuerung starten   (ohne Tastatur, control-server)
  0) Ende
M
  read -rp "Auswahl: " a
  case "$a" in
    1) read -rp "Geraet (z.B. /dev/sdb1): " d; sudo "$HERE/mount-ro.sh" "$d" ;;
    2) read -rp "Geraet (z.B. /dev/sdb): " d; read -rp "Ausgabe: " o; sudo "$HERE/image-disk.sh" "$d" "$o" ;;
    3) read -rp "Mount: " m; read -rp "Ausgabe: " o; sudo "$HERE/collect-windows-offline.sh" "$m" "$o" ;;
    4) read -rp "Mount: " m; read -rp "Ausgabe: " o; sudo "$HERE/collect-linux-offline.sh" "$m" "$o" ;;
    5) lsblk -o NAME,SIZE,FSTYPE,LABEL,MOUNTPOINT ;;
    6) open_app ;;
    7) echo "Smartphone per USB-Ethernet/WLAN verbinden, dann angezeigte URL+Token im Handy-Browser oeffnen. Strg+C beendet."
       sudo IR_EVIDENCE="${IR_EVIDENCE:-$HERE/../evidence}" python3 "$HERE/control-server.py" ;;
    0) exit 0 ;;
  esac
done
