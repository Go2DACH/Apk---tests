# Incident-Report – Ransomware / Verschluesselung – Heizungs-/SHK-Betrieb mit eigener Fertigung

- **Organisation:** Muster Heizung & Fertigung GmbH
- **Sektor:** —
- **Responder:** IR (du)
- **Einstufung:** TLP:AMBER
- **Playbook:** Ransomware / Verschluesselung – Heizungs-/SHK-Betrieb mit eigener Fertigung
- **Erstellt:** 2026-06-21 09:09
- **Status:** offen

> Alles gesperrt/verschluesselt – nichts geht mehr – Heizungs-/SHK-Betrieb mit eigener Fertigung

**Fortschritt Massnahmen:** 34/34 (100 %)

## 1. Kurzfassung
alle Monitore schwarz, Strom ist da, nichts geht mehr

## 2. Zeitachse
- `2026-06-21 09:09` **decision** – Flag status = suspected  _(IR (du))_
- `2026-06-21 09:09` **comms** – Kommunikation (Geschaeftsleitung / Krisenstab, vorbereitet)  _(IR (du))_
- `2026-06-21 09:09` **comms** – Kommunikation (Polizei – Zentrale Ansprechstelle Cybercrime (ZAC), vorbereitet)  _(IR (du))_
- `2026-06-21 09:09` **comms** – Kommunikation (Intern / No More Ransom, vorbereitet)  _(IR (du))_
- `2026-06-21 09:09` **comms** – Kommunikation (Datenschutz-Aufsichtsbehoerde / DSB, vorbereitet)  _(IR (du))_
- `2026-06-21 09:09` **evidence** – Beweis gesichert: RAM Patient Zero (sha256 sha256:ac326…)  _(IR (du))_
- `2026-06-21 09:09` **evidence** – Beweis gesichert: Endpoint-Triage (sha256 sha256:89657…)  _(IR (du))_
- `2026-06-21 09:09` **evidence** – Beweis gesichert: AD/VPN/Firewall-Logs (sha256 sha256:9d83d…)  _(IR (du))_
- `2026-06-21 09:09` **evidence** – Beweis gesichert: Ransom-Note + verschluesselte Samples (sha256 sha256:ded05…)  _(IR (du))_
- `2026-06-21 09:09` **ioc** – IOC hash: 44d88612fea8a8f36de82e1278abb02f  _(IR (du))_
- `2026-06-21 09:09` **ioc** – IOC ip: 185.220.101.5  _(IR (du))_
- `2026-06-21 09:09` **decision** – Flag status = confirmed  _(IR (du))_

## 3. Beweismittel & Chain of Custody

**1. RAM Patient Zero** (memory, Fluechtigkeit: hoch)
- Quelle: — · Methode: Triage/Acquisition
- SHA256: `sha256:ac3265ff638d` · Groesse: —
- Ablage: USB:/evidence · Gesichert von: IR · 2026-06-21 09:09
  - Custody: `2026-06-21 09:09` gesichert → IR (USB:/evidence)

**2. Endpoint-Triage** (datei, Fluechtigkeit: hoch)
- Quelle: — · Methode: Triage/Acquisition
- SHA256: `sha256:89657267662c` · Groesse: —
- Ablage: USB:/evidence · Gesichert von: IR · 2026-06-21 09:09
  - Custody: `2026-06-21 09:09` gesichert → IR (USB:/evidence)

**3. AD/VPN/Firewall-Logs** (log, Fluechtigkeit: mittel)
- Quelle: — · Methode: Triage/Acquisition
- SHA256: `sha256:9d83d65eac74` · Groesse: —
- Ablage: USB:/evidence · Gesichert von: IR · 2026-06-21 09:09
  - Custody: `2026-06-21 09:09` gesichert → IR (USB:/evidence)

**4. Ransom-Note + verschluesselte Samples** (datei, Fluechtigkeit: niedrig)
- Quelle: — · Methode: Triage/Acquisition
- SHA256: `sha256:ded0593c7183` · Groesse: —
- Ablage: USB:/evidence · Gesichert von: IR · 2026-06-21 09:09
  - Custody: `2026-06-21 09:09` gesichert → IR (USB:/evidence)

## 4. Indicators of Compromise (IOC)
- **hash**: `44d88612fea8a8f36de82e1278abb02f` – Ransomware-Binary
- **ip**: `185.220.101.5` – C2 (RAM/Capture)

## 5. Kommunikation & Meldungen
- `2026-06-21 09:09` **Geschaeftsleitung / Krisenstab** () – Status: vorbereitet
- `2026-06-21 09:09` **Polizei – Zentrale Ansprechstelle Cybercrime (ZAC)** () – Status: vorbereitet
- `2026-06-21 09:09` **Intern / No More Ransom** () – Status: vorbereitet
- `2026-06-21 09:09` **Datenschutz-Aufsichtsbehoerde / DSB** () – Status: vorbereitet

## 6. Durchgefuehrte Massnahmen

### Erstbewertung – Vorfall oder Fehlalarm? (1/4)
- [x] Erstbewertung & Quelle dokumentieren
- [ ] Nicht-boeswillige Erklaerung pruefen
- [ ] Einstufung – Vorfall oder Fehlalarm?
- [ ] Weiter mit dem Playbook

### Identifikation & Sofortmassnahmen (3/4)
- [x] Betroffene Geraete vom Netz trennen, aber NICHT ausschalten
- [x] Erpresserschreiben/Meldung fotografieren
- [x] Backups pruefen (vorhanden? getrennt?)
- [ ] Umfang & Beobachtung erfassen

### Krisenkommunikation & Meldepflichten (4/4)
- [x] Geschaeftsleitung / Krisenstab
- [x] Polizei – Zentrale Ansprechstelle Cybercrime (ZAC)
- [x] Intern / No More Ransom
- [x] Datenschutz-Aufsichtsbehoerde / DSB

### Beweissicherung (Order of Volatility) (9/10)
- [x] RAM Patient Zero
- [x] Endpoint-Triage
- [x] AD/VPN/Firewall-Logs
- [x] Ransom-Note + verschluesselte Samples
- [x] Tool: Windows-Triage
- [x] Tool: Memory-Acquisition
- [x] Tool: Velociraptor-Offline
- [x] Tool: OT-Netzwerk-Capture
- [x] Tool: M365-Triage
- [ ] Befund & Entscheidung: bestaetigt sich die Vermutung? — _Ransom-Note "RESTORE-FILES.txt" + Dateien .lockedX umbenannt; Logs: vssadmin delete shadows; RAM: Verschluesselungsprozess + C2. -> RANSOMWARE BESTAETIGT._

### Eindaemmung (3/3)
- [x] Betroffene Systeme isolieren (nicht ausschalten)
- [x] Netz segmentieren, OT von IT trennen
- [x] Privilegierte Konten sperren/zuruecksetzen (KRBTGT)

### Bereinigung (2/2)
- [x] Neu aufsetzen statt entschluesseln-und-weiter
- [x] Erstzugang schliessen (RDP/VPN/Phishing/Exploit)

### Wiederherstellung & sicherer Wiederanlauf (8/10)
- [x] STOP: Beweissicherung VOR Restore abgeschlossen?
- [x] Saubere Wiederherstellungsquelle bestimmen & pruefen
- [ ] Wiederanlauf-Reihenfolge priorisieren — _1) Kuehlung/Steuerung (Discounter-Baustelle), 2) Fertigung/CNC, 3) Buero/ERP, 4) Kasse_
- [x] Erstzugang/Schwachstelle geschlossen (vor dem Restore)
- [x] In gesaeubertem/segmentiertem Netz wiederherstellen
- [x] Alle Zugaenge erneuern (Passwoerter/Keys/Tokens, MFA)
- [x] Vor Go-Live: Monitoring/EDR scharf, IOCs geblockt
- [x] Integritaet & Funktion validieren
- [x] Stufenweiser, beobachteter Wiederanlauf
- [ ] Go-Live-Entscheidung dokumentieren — _Freigabe durch IT-Leitung nach Validierung; Restrisiko: Re-Infektion -> 2 Wochen Intensiv-Monitoring._

### Ermittlung / Analyse (2/2)
- [x] Root Cause & Zeitachse rekonstruieren
- [x] Vollstaendigkeit pruefen (Persistenz ausgeschlossen?)

### Abschluss (2/3)
- [x] Abschlussbericht erzeugen
- [ ] Lessons Learned
- [x] Fall abschliessen & Asservate uebergeben

## 7. Offene Aufgaben
_keine offenen Aufgaben_

---
_Erzeugt mit IR-Pilot · 2026-06-21 09:09 · TLP:AMBER_