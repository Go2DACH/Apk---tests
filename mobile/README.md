# Smartphone-Skripte (Termux) – schnelle Lagegewinnung am Handy

Du kommst per **WLAN, USB-Ethernet oder USB-Stick** ins Netz. Diese Skripte
laufen in **Termux** auf dem Galaxy Fold 5 und erzeugen ein **Ingest-Bundle**
(`ingest.json`), das du in IR-Pilot unter **Bericht → Daten importieren (JSON)**
einliest.

## Einrichtung (einmalig)

1. **Termux** installieren (F-Droid empfohlen).
2. Pakete:

```bash
pkg update && pkg install -y nmap iproute2 tcpdump curl jq openssl-tool termux-api
```

3. Skripte auf den USB-Stick / nach Termux kopieren, ausführbar machen:

```bash
chmod +x phone-*.sh
```

## Skripte

| Skript | Zweck |
|--------|-------|
| `phone-recon.sh` | Lokales Netz erfassen (Interface, Gateway, ARP, Ping-Sweep) → `ingest.json` (Hosts) |
| `phone-dns.sh`   | DNS/Reverse/Cert für Domain/IP über DoH (ohne dig) → IOCs |
| `phone-capture.sh` | Passiver Mitschnitt über USB-Ethernet (root) → pcap + Bundle |

## Ablauf

```bash
./phone-recon.sh                # erzeugt ingest.json (aktuelles Subnetz)
./phone-dns.sh evil.example     # hängt IOCs an ingest.json an
# ingest.json in IR-Pilot importieren (Bericht → Daten importieren)
```

> Nur in **autorisierten** Netzen scannen. USB-Ethernet für Captures nur an
> SPAN/TAP, nicht aktiv in OT einspeisen.
