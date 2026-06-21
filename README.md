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

## Die 6 hinterlegten Fälle

1. **Rechnungs-/IBAN-Manipulation (BEC)** — gefälschte Bankdaten in Rechnungen.
2. **Umspannwerk 300 kV** — Einbruch + Verdacht Manipulation an Schutzgeräten (OT/KRITIS).
3. **Bahnstellwerk** — aktiver Fernzugriff (Maus bewegt sich), safety-kritisch.
4. **Ransomware Bäckerei** — IT+OT flächendeckend verschlüsselt.
5. **AD-Brute-Force → Domain-Admin** kompromittiert (Molkerei, Produktion).
6. **Supply-Chain Solar/BESS** — Wartungslaptop mit Malware (C2 nach Russland).

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
data/playbooks.js       6 Fälle + generischer Lifecycle
data/comms.js           Krisenkommunikation + Meldepflichten
data/toolkit.js         Forensik-Skripte (Quelle)
tools/                  materialisierte Skripte für den USB-Stick
manifest.webmanifest    PWA-Manifest
sw.js                   Service Worker (Offline-Cache)
tests/                  run.js (Logik), ui.js (jsdom)
```

## Hinweis / Scope

Defensives Werkzeug für **autorisierte** Incident Response. Die Toolkit-Skripte
sind **read-only** (Sammlung/Beweissicherung), keine offensiven Funktionen.
Rechtliche Schritte/Meldungen mit Recht/DSB/Behörden abstimmen.
