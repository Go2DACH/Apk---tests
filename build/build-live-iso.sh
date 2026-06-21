#!/usr/bin/env bash
# build-live-iso.sh – baut ein bootbares Forensik-Linux (Debian live-build) mit
# gparted + forensischen Tools UND der IR-Pilot-App + Skripten an Bord.
#
#   sudo apt-get install live-build
#   sudo ./build-live-iso.sh
#
# Ergebnis: live-image-amd64.hybrid.iso  -> mit 'dd' auf USB schreiben.
# Forensischer Modus: kein Auto-Mount, keine Persistenz (Platten bleiben unberuehrt).
set -eu
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORK="${1:-$ROOT/build/live}"
command -v lb >/dev/null || { echo "[!] live-build fehlt: sudo apt-get install live-build"; exit 1; }

mkdir -p "$WORK"; cd "$WORK"
echo "[*] Konfiguriere live-build in $WORK"
lb clean || true
lb config \
  --distribution bookworm \
  --architectures amd64 \
  --debian-installer none \
  --bootappend-live "boot=live components noautomount noeject nopersistence quiet" \
  --memtest none

# Paketliste uebernehmen
mkdir -p config/package-lists
grep -vE '^\s*#|^\s*$' "$ROOT/build/packages.list" > config/package-lists/forensics.list.chroot

# App + Skripte in das Image legen (/opt/ir-pilot)
mkdir -p config/includes.chroot/opt/ir-pilot
for d in index.html sw.js manifest.webmanifest css js data tools mobile desktop windows assets README.md; do
  [ -e "$ROOT/$d" ] && cp -a "$ROOT/$d" config/includes.chroot/opt/ir-pilot/
done

# Desktop-Autostart: IR-Pilot beim Login oeffnen
mkdir -p config/includes.chroot/etc/skel/.config/autostart
cat > config/includes.chroot/etc/skel/.config/autostart/ir-pilot.desktop <<'EOF'
[Desktop Entry]
Type=Application
Name=IR-Pilot
Exec=bash -c 'xdg-open /opt/ir-pilot/index.html'
X-GNOME-Autostart-enabled=true
EOF

# Auto-Kopplung Smartphone <-> Stick (DHCP probieren, sonst eigene IP + Mini-DHCP)
mkdir -p config/includes.chroot/etc/systemd/system
cat > config/includes.chroot/etc/systemd/system/ir-net.service <<'EOF'
[Unit]
Description=IR-Pilot Auto-Netz (Smartphone/Stick koppeln, DHCP-or-static)
After=network.target
Before=ir-control.service

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=/bin/bash /opt/ir-pilot/desktop/netup.sh

[Install]
WantedBy=multi-user.target
EOF

# Smartphone-Steuerung: Control-Server als systemd-Dienst (headless, ohne Tastatur)
cat > config/includes.chroot/etc/systemd/system/ir-control.service <<'EOF'
[Unit]
Description=IR-Pilot Control-Server (Boot-Stick vom Smartphone steuern)
After=network.target ir-net.service
Wants=ir-net.service

[Service]
Type=simple
Environment=IR_APP=/opt/ir-pilot
Environment=IR_EVIDENCE=/evidence
Environment=IR_PORT=8080
ExecStartPre=/bin/mkdir -p /evidence
ExecStart=/usr/bin/python3 /opt/ir-pilot/desktop/control-server.py
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF

# Hook: Auto-Mount global deaktivieren (Forensik!)
mkdir -p config/hooks/live
cat > config/hooks/live/9000-forensic.hook.chroot <<'EOF'
#!/bin/sh
set -e
# udisks2 Auto-Mount aus, swap aus
systemctl disable udisks2 2>/dev/null || true
echo 'vm.swappiness=0' >> /etc/sysctl.conf
ln -sf /opt/ir-pilot/desktop/autorun.sh /usr/local/bin/ir-desktop 2>/dev/null || true
chmod +x /opt/ir-pilot/desktop/*.sh /opt/ir-pilot/desktop/*.py /opt/ir-pilot/mobile/*.sh /opt/ir-pilot/tools/*.sh 2>/dev/null || true
# Auto-Netz + Control-Server-Dienst aktivieren (Smartphone-Fernsteuerung ohne Tastatur)
systemctl enable ir-net.service 2>/dev/null || true
systemctl enable ir-control.service 2>/dev/null || true
# CyberChef offline mit ins Image holen (best effort, Internet im Build noetig)
bash /opt/ir-pilot/tools/fetch-cyberchef.sh /opt/ir-pilot/tools/cyberchef 2>/dev/null || true
EOF
chmod +x config/hooks/live/9000-forensic.hook.chroot

echo "[*] Baue ISO (dauert je nach Netz/CPU laenge)..."
lb build
ISO="$(ls -1 *.iso 2>/dev/null | head -1)"
echo "[+] Fertig: $WORK/$ISO"
echo "    Auf USB schreiben:  sudo dd if='$WORK/$ISO' of=/dev/sdX bs=4M status=progress conv=fsync"
echo "    Tipp: Alternativ turnkey-Forensik-Distros CAINE oder Tails verwenden und"
echo "          nur den Ordner /opt/ir-pilot (make-toolkit-usb.sh) auf eine Datenpartition legen."
