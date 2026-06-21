#!/usr/bin/env bash
# mount-ro.sh – Zielpartition forensisch READ-ONLY mounten (offline an die Daten)
# Nutzung:  sudo ./mount-ro.sh /dev/sdb1 [/mnt/ziel]
set -eu
DEV="${1:?Geraet/Partition angeben, z.B. /dev/sdb1}"
MNT="${2:-/mnt/evidence}"
mkdir -p "$MNT"
FS="$(blkid -o value -s TYPE "$DEV" 2>/dev/null || echo unknown)"
echo "[*] $DEV ($FS) -> $MNT (read-only)"
case "$FS" in
  ntfs) mount -o ro,show_sys_files,streams_interface=windows -t ntfs-3g "$DEV" "$MNT" ;;
  vfat|exfat) mount -o ro -t "$FS" "$DEV" "$MNT" ;;
  ext2|ext3|ext4) mount -o ro,noload -t "$FS" "$DEV" "$MNT" ;;
  *) mount -o ro "$DEV" "$MNT" ;;
esac
echo "[+] Gemountet (ro): $MNT"
mount | grep " $MNT "
