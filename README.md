# IR-Pilot — geführtes Incident-Response-Tool

Ein **playbook-basiertes Einsatz-Tool für Cyber Incident Responder**. Eine
Codebasis, drei Wege: **offline vom USB-Stick** (`file://`), **als Web-App**
(Cloud-Hosting) und **als PWA „installierbar"** auf Android (quasi APK). Reines
HTML/JS, **kein Build, keine Abhängigkeiten**, läuft im Browser des Galaxy
Fold 5.

> Gebaut für den Ernstfall: Du hast nur Handy, USB-Stick und USB-Ethernet dabei
> und musst sofort strukturiert, beweissicher und meldepflicht-konform arbeiten.

## Architektur: Pages (Daten/UI) + APK (Arbeit)

Eine Codebasis, zwei Auslieferungswege – als **Hybrid**:

- **GitHub Pages / PWA = Daten & UI.** Hält App, Playbooks/Kataloge/Comms/Tools,
  Fallverwaltung (lokal), Berichte. Offline-fähig, installierbar. Deploy:
  `.github/workflows/pages.yml`.
- **Android-APK = die Arbeit.** WebView lädt **dieselbe** App (gebündelt offline,
  „Daten aktualisieren" zieht die neueste Version von Pages) und ergänzt eine
  **native Brücke** (`window.AndroidIR`) für das, was der Browser nicht darf.
  Projekt unter `android/`, Build: `.github/workflows/build-apk.yml` → APK-Artefakt.

Warum die APK nötig ist (Browser-Sandbox):

| Aufgabe | Web/PWA | APK (nativ) |
|---|---|---|
| Playbook-UI, Fälle, Berichte, Comms, DNS/DoH | ✅ | ✅ |
| **WiFi/Ethernet-Mitschnitt (pcap)** | ❌ | ✅ ohne Root via VpnService (PCAPdroid, nur eigener Traffic); echtes TAP/fremde Hosts = tcpdump auf dem **Boot-Stick** (dort root) |
| **Netz-Scan / Host-Discovery** | ❌ | ✅ gebündeltes nmap |
| **Boot-Stick schreiben** | ❌ | ✅ ohne Root (USB-Host, EtchDroid) – ISO bauen bleibt Linux/CI |
| **Imaging/Triage am Ziel ohne Tastatur** | ❌ | per **Boot-Stick + `control-server.py`** vom Handy-Browser (kein Root am Handy) |
| Datei auf USB/Downloads sichern | nur Download | ✅ MediaStore/USB |

Die App erkennt zur Laufzeit (`IR.native`), ob sie in der APK läuft: dann echte
Aktionen im Tab **Geräte**; im Browser dort die passenden Skripte/Anleitungen
(Termux/EtchDroid). Stand v1.0.0: native Brücke + Datei/Share/Reload nativ,
Capture/Flash delegieren an PCAPdroid/EtchDroid; eigene native Module
(VpnService-Capture, USB-Flash, nmap) sind der nächste Schritt.

## Framework: Assistent statt fester Szenarien

Beim Start führt ein **Assistent** durch drei Fragen – ohne Technikwissen – und
**baut daraus ein massgeschneidertes Playbook** mit den passenden Tools an der
richtigen Stelle:

1. **Umgebung** wählen – **60+ Unternehmens-/Anlagentypen** (Gastro, Handwerk,
   Industrie, Energie/KRITIS, Wasser, Verkehr, Gesundheit, Handel, Agrar, Bau,
   Öffentlich, Gebäude/IT), u. a. Brauerei, Sägewerk, Maschinenbau/Instandhaltung,
   Feuerwehr/Leitstelle, Gebäudeautomation, Umspannwerk, Wasserwerk, Bahnstellwerk.
2. **Was wurde beobachtet?** – **13 Impacts in Kundensicht** (z. B. „alles
   gesperrt", „falsche Bankdaten", „Maschine spinnt", „Bildschirm bewegt sich",
   „Webseite down", „Gefahr für Menschen/Versorgung").
3. **Kurzer Fragebogen** (laienverständlich) → das Tool berechnet eine **erste
   technische Vermutung** aus **17 Cyber-Hypothesen** (Ransomware, BEC, OT-
   Manipulation, RAT, AD/Identität, Phishing, Supply-Chain, DDoS, Webshell,
   Insider, Exfiltration, Cloud-Takeover, Wiper, Brute-Force, Erpressung – plus
   **3 benigne** „kein Cyber-Angriff": physisch, Fehlkonfiguration, Defekt).

Aus **Umgebung + Impact + Hypothese** generiert der Generator ein vollständiges
Playbook (Erstbewertung → Triage → Krisenkommunikation inkl. passender
Meldepflichten → Beweissicherung nach Volatilität **mit den richtigen Tools** →
Eindämmung → Bereinigung → Wiederanlauf → Ermittlung → Abschluss). Ein
**generisches Playbook** und die 9 kuratierten Beispiele bleiben als Schnellstart
verfügbar. Kataloge: `data/catalog.js`, Fragebogen: `data/questions.js`,
Generator/Scoring: `js/framework.js`.

## Was es kann

- **Erstbewertungs-Gate „Vorfall oder Fehlalarm?"**: Nicht jeder Anruf ist ein
  Angriff. Jedes Playbook startet mit einer Einstufung (bestätigt / Verdacht /
  **kein Angriff**). Das Angriffs-Playbook wird erst bei bestätigt/Verdacht
  sichtbar; bei „kein Angriff" greift ein **De-Eskalations-/Dokumentationspfad**
  (benigne Ursache belegen, Entwarnung kommunizieren, sauber schließen).
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
- `control-server.py` — **Boot-Stick ohne Tastatur vom Smartphone steuern.** Läuft
  auf dem gebooteten Forensik-Linux (Stdlib, kein Root am Handy nötig). Zeigt
  URL + Token; im Handy-Browser öffnest du eine Touch-Oberfläche für Geräteliste,
  RO-Mount, Imaging, Windows/Linux-Triage, Manifest und Netzwerk-Capture — und die
  volle App unter `/app/`. Startet automatisch als `ir-control.service` oder über
  `autorun.sh` (Punkt 7). Token-geschützt, nur im vertrauenswürdigen Analyse-Netz.

### Ohne Root & ohne Tastatur — `mobile/hid-keyboard.md`
Die App läuft **ohne Root**. Wenn am Zielrechner keine Tastatur ist: den Stick
booten und per **USB-Ethernet/WLAN** vom Handy fernsteuern (`control-server.py`).
Handy-als-USB-Tastatur (HID-Gadget) braucht **Root am Handy** und ist daher nicht
der Standardweg — die ehrliche Abwägung steht in `mobile/hid-keyboard.md`.

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
Offline-Collector · **UAC** · **Super-Timeline** (plaso/Sleuthkit) · **CyberChef
offline** (Dekodieren/Defangen/JWT direkt im Browser, auch am Smartphone –
`tools/fetch-cyberchef.sh` holt es einmalig, danach offline). `npm run tools`
materialisiert die Skripte nach `tools/`.

### Fertige Artefakte — `dist/`
- `IR-Pilot_Einsatzkarten.pdf` — eine A4-Seite je Fall (Sofortmaßnahmen,
  Meldewege/Fristen, Beweise zuerst). Auch als druckbares `einsatzkarten.html`.
- `IR-Pilot_Walkthrough.pdf` + `shot-*.png` — Screenshots/Kurzüberblick.

## Tests

```bash
npm test          # Logik (run.js) + UI-Smoke (ui.js) + Control-Server (control-server.sh)
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
mobile/                 Smartphone-Skripte (Termux) + hid-keyboard.md (no-root/Tastatur)
desktop/                Offline-Collection vom Live-USB + control-server.py
build/                  Live-ISO-Builder, Toolkit-USB, Einsatzkarten/Screenshots
dist/                   erzeugte PDFs/Screenshots
manifest.webmanifest    PWA-Manifest
sw.js                   Service Worker (Offline-Cache)
tests/                  run.js (Logik), ui.js (jsdom), control-server.sh (Stick-Steuerung)
```

## Hinweis / Scope

Defensives Werkzeug für **autorisierte** Incident Response. Die Toolkit-Skripte
sind **read-only** (Sammlung/Beweissicherung), keine offensiven Funktionen.
Rechtliche Schritte/Meldungen mit Recht/DSB/Behörden abstimmen.
