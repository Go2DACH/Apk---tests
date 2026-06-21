# Changelog

## Unreleased — Multi-Host, Cloud & Auslieferung

- **Fotos & Screenshots** (`js/core.js` addPhoto/removePhoto): Geräte-/Anlagenfotos
  oder Host-Screenshots in der Beweise-Ansicht erfassen (Kamera oder Galerie),
  lokal verkleinert gespeichert, im PDF-Bericht eingebunden.
- **Bericht als PDF**: `IR.report.printableHTML` + „📄 Bericht als PDF" – Browser
  `window.print()` bzw. in der APK Android-PDF-Druck (`IRBridge.printPage`).
- **KI-Assistent** (`js/assistant.js`, Ansicht „🤖 Assistent"): Fachfragen (IR/OT,
  Schutzgeräte wie SIPROTEC 4, Log-Sicherung) über die Claude-Messages-API mit
  **eigenem** API-Key (lokal, nie committet); Beispiel-Fragen vorbelegt.

- **Eine Quelle statt zwei Apps**: Das **Werkzeug-Kit** (Boot-Stick-Skripte,
  `control-server.py`, Windows-Sammler, App) ist als `ir-pilot-kit.zip` **in die
  APK eingebettet** und über **„📦 Kit herunterladen"** (Geräte-Ansicht) direkt auf
  USB/Speicher exportierbar (nativ via `IRBridge.exportAsset`, im Web als Download).
  Auf Pages zusätzlich unter `…/ir-pilot-kit.zip` (`build/make-kit.sh`).
- **Playbook-Stand im Dashboard**: Snapshot trägt jetzt die **aktuelle Phase**;
  App- und Pages-Dashboard zeigen „Phase: …".


- **No-Root-Forensik & Boot-Stick-Fernsteuerung** (`desktop/control-server.py`):
  headless vom Smartphone steuern, ohne Tastatur am Ziel; `mobile/hid-keyboard.md`.
- **Mehrere Forensik-Hosts** (bis 10, `js/hosts.js`): Auto-Discovery (USB/Netz),
  One-Click Discover/Wireshark/Image/Triage/Manifest, Datei-Download.
- **Befunde automatisch ins Playbook**: ingest.json der Endpoints → „⤵ Befunde in
  Fall"; Panel „📥 Befunde aus Daten" in der Forensik-Phase (kein Auto-Confirm).
- **Auto-Kopplung** Handy↔Stick ohne DHCP (`desktop/netup.sh`, `ir-net.service`).
- **Windows-Sammler** (`windows/IR-Collect.cmd`/`ir-collect.ps1`): read-only Triage
  → SHA256 → Upload an den Host (`/api/intake`).
- **Cloud = Git** (`js/cloud.js`): Vorfall-Snapshots via GitHub-Contents-API nach
  `cloud/incidents/`; Pfad vorbelegt + änderbar; klare 403/404-Hinweise.
- **Pages-Dashboard** (`dashboard.html`): liest die Cloud statisch; PIN 1374.
- **Pages-Deploy** auf `gh-pages`-Branch umgestellt (umgeht Environment-Sperre).
- **APK**: Cleartext + MixedContent für lokale Forensik-Hosts erlaubt.
- **Doku**: `npm run guide` erzeugt `dist/IR-Pilot_Anleitung.pdf` (mit Screenshots)
  und `dist/IR-Pilot_Testplan.pdf` (manueller Testplan + „wo hakt es").
- **Tests**: 1635 Logik + 33 UI + 7 Dashboard + Control-Server-Smoke.

## v1.0.0 — IR-Pilot (Incident-Response-Tool)

Erstes Release. Geführtes, playbook-basiertes Incident-Response-Tool für den
Einsatz – offline vom USB-Stick im Smartphone-Browser, als Web-App hostbar und
als PWA installierbar. Reines HTML/JS, kein Build, keine Abhängigkeiten.

### Framework
- **Assistent**: Umgebung (60+ Typen inkl. Brauerei, Sägewerk, Maschinenbau/
  Instandhaltung, Feuerwehr, Gebäudeautomation, Energie/Wasser/Bahn …) →
  Beobachtung (13 Impacts in Kundensicht) → Fragebogen → **erste Vermutung** aus
  17 Cyber-Hypothesen (inkl. 3 benigne „kein Angriff").
- **Generator** baut daraus ein maßgeschneidertes Playbook mit Tools an der
  richtigen Stelle; generisches Playbook + 9 kuratierte Beispiele als Schnellstart.
- **Erstbewertungs-Gate** „Vorfall oder Fehlalarm?" mit De-Eskalations-Pfad.

### Forensik & Entscheidung
- Beweissicherung nach **Order of Volatility**, SHA256 + **Chain of Custody**.
- Pro Beweis **„Worauf achten (Entscheidung)"** + Entscheidungs-Stufe je Hypothese.

### Wiederherstellung
- **Beweissicherung VOR dem Restore** als verpflichtendes Gate.
- **Begleiteter Wiederanlauf**: saubere Quelle, Reihenfolge, Erstzugang schließen,
  sauberes Netz, Zugänge erneuern, Monitoring, Validierung, Go-Live-Freigabe.

### Krisenkommunikation
- Vorlagen mit Meldepflichten/Fristen: DSGVO 72 h, BSI/KRITIS, BNetzA, EBA,
  Gesundheitsamt, Polizei/ZAC, Bank-SEPA-Recall.

### Einsatz-Kit
- **Smartphone (Termux)**: phone-recon / phone-dns / phone-capture → ingest.json.
- **Desktop/Live-USB**: mount-ro, image-disk, Windows-/Linux-Offline-Collector.
- **Bootbares Forensik-Linux** (Debian live-build) inkl. gparted & Forensik-Tools
  + App an Bord; Toolkit-USB-Packer.
- **Toolkit** (read-only): Windows/Linux/AD/M365-Triage, OT-Capture, Mail-Header,
  Hash-Manifest, Memory-Acquisition, Velociraptor, UAC, Super-Timeline, CyberChef.
- **Import** der Sammler-Bundles in die App; Timeline-CSV; Incident-Report (MD) +
  Fall-Export (JSON); **Einsatzkarten-PDF** (1 Seite je Fall) + Walkthrough.

### Qualität
- 1592 Logik-Checks + 19 UI-Checks (jsdom) grün; alle Shell-Skripte `bash -n` ok.

Defensiver Scope; Sammler sind read-only, keine offensiven Funktionen.
