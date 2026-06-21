# IR-Pilot — geführtes Incident-Response-Tool

Ein **playbook-basiertes Einsatz-Tool für Cyber Incident Responder**. Eine
Codebasis, drei Wege: **offline vom USB-Stick** (`file://`), **als Web-App**
(Cloud-Hosting) und **als PWA „installierbar"** auf Android (quasi APK). Reines
HTML/JS, **kein Build, keine Abhängigkeiten**, läuft im Browser des Galaxy
Fold 5.

> Gebaut für den Ernstfall: Du hast nur Handy, USB-Stick und USB-Ethernet dabei
> und musst sofort strukturiert, beweissicher und meldepflicht-konform arbeiten.

## Was es kann

- **Geführte Playbooks** entlang des IR-Lifecycles: Triage → Krisenkommunikation
  → Beweissicherung → Eindämmung → Bereinigung → Wiederherstellung/sicherer
  Wiederanlauf → Ermittlung → Abschluss.
- **Forensische Ableitungen**: pro Fall Symptom → Hypothesen → benötigte
  Artefakte, in **Order of Volatility**.
- **Beweissicherung** mit SHA256, Asservat-Ablage und **Chain of Custody**.
- **Krisenkommunikation**: fertige Vorlagen inkl. **Meldepflichten/Fristen**
  (DSGVO 72 h, BSI/KRITIS, BNetzA, EBA Bahn, Polizei/ZAC, Bank-Recall).
- **IOC-Erfassung**, **Lagebericht** und exportierbarer **Incident-Report**
  (Markdown) + **Fall-Export** (JSON).
- **Forensik-Toolkit**: read-only Triage-/Acquisition-Skripte für den USB-Stick
  (Windows/Linux/AD/M365/OT-Capture/Mail-Header/Hash-Manifest).

## Die 9 hinterlegten Fälle

1. **Rechnungs-/IBAN-Manipulation (BEC)** — gefälschte Bankdaten in Rechnungen.
2. **Umspannwerk 300 kV** — Einbruch + Verdacht Manipulation an Schutzgeräten (OT/KRITIS).
3. **Bahnstellwerk** — aktiver Fernzugriff (Maus bewegt sich), safety-kritisch.
4. **Ransomware Bäckerei** — IT+OT flächendeckend verschlüsselt.
5. **AD-Brute-Force → Domain-Admin** kompromittiert (Molkerei, Produktion).
6. **Supply-Chain Solar/BESS** — Wartungslaptop mit Malware (C2 nach Russland).
7. **Phishing-Welle** — Credential-/Token-Diebstahl (AiTM), Folge-Kontomissbrauch.
8. **Wasserwerk** — Manipulation der Trinkwasser-Steuerung (OT/KRITIS, Gesundheit).
9. **Cloud/M365-Takeover** — Tenant-Übernahme (Global Admin, OAuth-Consent, Exfil).

Das Tool ist **generisch** — die Fälle sind Daten (`data/playbooks.js`); neue
Szenarien einfach ergänzen.

## Start

**Vom USB-Stick / Handy (offline):** Ordner auf den Stick kopieren,
`index.html` im Browser öffnen. Funktioniert ohne Internet/Server. Fälle werden
lokal im Browser gespeichert (Export als JSON/Markdown jederzeit möglich).

**Als PWA (installierbar):** über HTTPS hosten (z. B. statisches Cloud-Hosting),
im Browser „Zum Startbildschirm hinzufügen" → läuft wie eine App, offline-fähig
(Service Worker).

**Als Web-App (Cloud):** beliebiges statisches Hosting — nur die Dateien
ausliefern.

## Forensik-Toolkit

Die Skripte liegen unter `tools/` (read-only, defensiv) und sind in der App
unter **Tools** einsehbar/kopier-/herunterladbar:

| Skript | Zweck |
|--------|-------|
| `windows-triage.ps1` | Windows-Host read-only sichern (Prozesse, Netz, Autostarts, Tasks, EventLogs, Hash-Manifest) |
| `linux-triage.sh` | Linux-Host-Triage |
| `ad-triage.ps1` | DC-Anmelde-Events (4625/4624/4768/4769/4672), Lockouts, Admin-Änderungen |
| `m365-triage.ps1` | BEC: Inbox-Rules, Weiterleitungen, Audit-Log |
| `ot-capture.sh` | passiver Mitschnitt über USB-Ethernet (pcap) am TAP/SPAN |
| `parse-eml.py` | Mail-Header-/BEC-Analyse |
| `evidence-manifest.sh` | SHA256-Manifest erzeugen/verifizieren (Integrität) |

Neu materialisieren: `npm run tools`.

## Einsatz-Kit (Skripte & bootbares Linux)

Du kommst per **USB-Stick, WLAN und USB-Ethernet** ins Netz. Dafür liegt ein
komplettes Sammel-Kit bei; alle Sammler erzeugen ein **`ingest.json`**, das du
in der App unter **Bericht → Daten importieren (JSON)** einliest (oder
**Quick-Paste IOCs** für Freitext).

### Smartphone (Termux) — `mobile/`
- `phone-recon.sh` — lokales Netz erfassen (Interface/Gateway/ARP/Ping-Sweep) → Hosts.
- `phone-dns.sh` — DNS/Reverse/Cert über DoH (ohne `dig`) → IOCs.
- `phone-capture.sh` — passiver Mitschnitt über USB-Ethernet (root) → pcap + Bundle.

### Desktop / Live-USB — `desktop/`
- `mount-ro.sh` — Zielpartition **read-only** mounten (offline an die Daten).
- `image-disk.sh` — Datenträger sichern (ddrescue/raw oder ewfacquire/E01) + Hash.
- `collect-windows-offline.sh` — von gemounteter Windows-Platte: Hives, EVTX,
  Amcache, Prefetch, Tasks, NTUSER → Triage-Paket + Manifest.
- `collect-linux-offline.sh` — `/etc`, Logs, Cron, SSH-Keys, History → Paket.
- `autorun.sh` — Starter-Menü auf dem Live-USB (öffnet IR-Pilot + geführte Sammlung).

### Bootbares Forensik-Linux — `build/`
- `build-live-iso.sh` — baut mit **Debian live-build** ein bootbares Forensik-Linux
  **inkl. gparted** und der Tools aus `build/packages.list` (testdisk, ddrescue,
  sleuthkit, ewf-tools, wireshark/tshark, nmap, plaso, exiftool, chntpw, …) und
  **legt IR-Pilot + alle Skripte an Bord**. Forensischer Modus: kein Auto-Mount,
  keine Persistenz. ISO mit `dd` auf den Stick. (Alternativ: CAINE/Tails booten +
  `make-toolkit-usb.sh`.)
- `make-toolkit-usb.sh` — App + Skripte auf eine USB-Datenpartition legen.
- `make-cards.js` / `render-pdf-shots.js` — Einsatzkarten + Screenshots erzeugen.

### Forensik-Toolkit (in der App, `tools/`)
Windows-/Linux-/AD-/M365-Triage · OT-Capture (USB-Ethernet) · Mail-Header ·
Hash-Manifest · **Memory-Acquisition** (avml/winpmem) · **Velociraptor**
Offline-Collector · **UAC** · **Super-Timeline** (plaso/Sleuthkit). `npm run tools`
materialisiert sie nach `tools/`.

### Fertige Artefakte — `dist/`
- `IR-Pilot_Einsatzkarten.pdf` — eine A4-Seite je Fall (Sofortmaßnahmen,
  Meldewege/Fristen, Beweise zuerst). Auch als druckbares `einsatzkarten.html`.
- `IR-Pilot_Walkthrough.pdf` + `shot-*.png` — Screenshots/Kurzüberblick.

## Tests

```bash
npm test          # Logik (tests/run.js) + UI-Smoke mit jsdom (tests/ui.js)
```

## Projektstruktur

```
index.html              App-Shell
css/app.css             Mobile-first UI (dunkel)
js/core.js              Namespace, Case-Modell, Engine, Persistenz
js/report.js            Incident-Report + Lagebericht
js/app.js               UI-Controller (Vanilla JS)
data/playbooks.js       9 Fälle + generischer Lifecycle
data/comms.js           Krisenkommunikation + Meldepflichten
data/toolkit.js         Forensik-Skripte (Quelle)
tools/                  materialisierte Triage-Skripte
mobile/                 Smartphone-Skripte (Termux)
desktop/                Offline-Collection vom Live-USB
build/                  Live-ISO-Builder, Toolkit-USB, Einsatzkarten/Screenshots
dist/                   erzeugte PDFs/Screenshots
manifest.webmanifest    PWA-Manifest
sw.js                   Service Worker (Offline-Cache)
tests/                  run.js (Logik), ui.js (jsdom)
```

## Hinweis / Scope

Defensives Werkzeug für **autorisierte** Incident Response. Die Toolkit-Skripte
sind **read-only** (Sammlung/Beweissicherung), keine offensiven Funktionen.
Rechtliche Schritte/Meldungen mit Recht/DSB/Behörden abstimmen.
