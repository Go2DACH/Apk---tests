# IR-Pilot – Windows-Sammler (auf dem USB-Stick)

Doppelklickbares Windows-Programm, das **read-only** Live-Triage von einem
laufenden Windows-Rechner sammelt und die Daten **automatisch an dein Smartphone /
den Boot-Stick** lädt – von dort weiter ins **Dashboard** (PIN-geschützt) und in
die Cloud.

## Dateien
- `IR-Collect.cmd` — Doppelklick-Starter (ruft PowerShell mit Bypass auf).
- `ir-collect.ps1` — die eigentliche Sammlung + Upload.
- `ir-target.txt` — Ziel-Host + Token (aus `ir-target.txt.example` erstellen).

## Bedienung (am Vorfall)
1. Forensik-Host bereitstellen: Boot-Stick `control-server.py` läuft, Smartphone
   gekoppelt. URL + Token stehen auf der Stick-Konsole (z. B. `http://10.13.37.50:8080`).
2. `ir-target.txt` anlegen (base + token) **oder** beim Start eingeben.
3. Auf dem Ziel-Windows den Stick einstecken, **`IR-Collect.cmd` doppelklicken**
   (für vollständige Event-Logs/Autoruns als Administrator ausführen).
4. Es wird gesammelt (systeminfo, ipconfig, netstat, tasklist, services,
   schtasks, autoruns, DNS-Cache, ARP, Security-Events 4624/4625/4672/4688,
   etablierte Verbindungen → IOCs), gepackt, **SHA256** gebildet und an den Host
   hochgeladen (`/api/intake`).
5. Im IR-Pilot-**Dashboard** erscheint der Host mit der Datei; nach **PIN 1374**
   sind alle Dateien herunterladbar. `ingest.json` lässt sich zusätzlich direkt in
   einen Fall importieren (Bericht → Daten importieren).

## Hinweise
- **Read-only:** nur lesende Abfragen; das Zielsystem wird nicht verändert. Für
  echte Datenträger-Forensik (Image, Offline-Triage) den Rechner stattdessen vom
  Forensik-Stick booten und über das Dashboard fernsteuern.
- Ohne erreichbaren Host bleibt das Paket lokal (`IR-Collect\…\*.zip`) und kann
  manuell importiert werden.
- Übertragung erfolgt im vertrauenswürdigen Analyse-Netz; der Token schützt vor
  fremdem Zugriff.
