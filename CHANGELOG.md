# Changelog

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
