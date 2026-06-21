/* IR-Pilot – Playbooks. Generischer IR-Lifecycle + 6 saubere Beispielfaelle.
 * Phasen (einheitlich):
 *  triage       – Identifikation & Sofortmassnahmen (inkl. Leib/Leben bei OT)
 *  comms        – Krisenkommunikation & Meldepflichten
 *  forensik     – Beweissicherung (Order of Volatility, Hash, Chain of Custody)
 *  eindaemmung  – Containment
 *  bereinigung  – Eradication
 *  wiederanlauf – Wiederherstellung & sicherer Wiederanlauf
 *  ermittlung   – Ermittlung / Analyse fuer die spaetere Untersuchung
 *  abschluss    – Abschluss & Lessons Learned
 */
(function (root) {
  'use strict';
  var IR = root.IR || (root.IR = {});

  function s(id, type, title, md, extra) {
    return Object.assign({ id: id, type: type, title: title, do: md }, extra || {});
  }
  // Beweis-Schritt aus einem Forensik-Plan-Eintrag
  function ev(id, title, md, spec) {
    return s(id, 'evidence', title, md, { evidence: spec });
  }
  // Wiederverwendbare Kommunikations-/Abschluss-Bausteine (Praefix p)
  function commManagement(p) {
    return s(p + '-c-mgmt', 'comms', 'Geschaeftsleitung briefen',
      'Kurzes Lagebild (Was ist passiert, Auswirkung, naechste Schritte, Entscheidungsbedarf). **Keine Schuldzuweisung.** Krisenstab benennen.',
      { commsId: 'mgmt_briefing' });
  }
  function commLegalDSGVO(p) {
    return s(p + '-c-dsgvo', 'comms', 'Datenschutz / DSGVO pruefen (72 h)',
      'Sind personenbezogene Daten betroffen? Falls ja: **Meldung an die Aufsichtsbehoerde binnen 72 h** (Art. 33 DSGVO), ggf. Betroffenenbenachrichtigung (Art. 34). DSB einbinden, Frist im Fall notieren.',
      { commsId: 'dsgvo_breach' });
  }
  function commPolice(p) {
    return s(p + '-c-police', 'comms', 'Strafanzeige / Polizei (ZAC)',
      'Zentrale Ansprechstelle Cybercrime (ZAC) der Polizei kontaktieren. Anzeige erstatten. **Asservate fuer die Ermittlung sichern** (Chain of Custody!).',
      { commsId: 'police_report' });
  }
  function closeout(p) {
    return [
      s(p + '-x-report', 'check', 'Abschlussbericht erzeugen', 'Im Tab **Bericht** den Incident-Report exportieren (Zeitachse, Beweise, Kommunikation, Massnahmen).'),
      s(p + '-x-lessons', 'input', 'Lessons Learned', 'Was hat funktioniert, was nicht? Konkrete Verbesserungen ableiten.', { field: { name: 'lessons', label: 'Lessons Learned', kind: 'textarea' } }),
      s(p + '-x-close', 'check', 'Fall abschliessen & Asservate uebergeben', 'Asservate dokumentiert uebergeben (Chain of Custody schliessen), Fallstatus auf erledigt.')
    ];
  }
  function recoveryCommon(p) {
    return [
      s(p + '-w-clean', 'check', 'Nur aus sauberer Quelle wiederherstellen', 'Wiederherstellung ausschliesslich aus **verifiziert sauberen** Backups/Images. Keine Wiederverwendung potenziell kompromittierter Systeme ohne Neuaufsetzen.'),
      s(p + '-w-creds', 'check', 'Alle Zugaenge erneuern', 'Passwoerter/Keys/Tokens/Zertifikate rotieren (priorisiert Admin/Dienstkonten). MFA erzwingen.'),
      s(p + '-w-monitor', 'check', 'Verschaerftes Monitoring beim Wiederanlauf', 'Vor Go-Live zusaetzliche Protokollierung/EDR/Netzwerk-Monitoring aktivieren; Wiederanlauf stufenweise und beobachtet.'),
      s(p + '-w-validate', 'check', 'Wiederanlauf validieren', 'Funktion + Sicherheit pruefen (keine Restpersistenz, keine IOC-Kommunikation), bevor der Normalbetrieb freigegeben wird.')
    ];
  }

  // ====================================================================== //
  //  FALL 1 – BEC / Rechnungs- & IBAN-Manipulation
  // ====================================================================== //
  var bec = {
    id: 'bec-iban',
    title: 'Rechnungs-/IBAN-Manipulation (BEC)',
    category: 'IT · Betrug / E-Mail-Kompromittierung',
    severity: 'hoch',
    oneLiner: 'Versendete Rechnungen kommen mit fremder IBAN an; eingehende PDFs tragen alle dieselbe (auslaendische) IBAN.',
    derivation:
      '**Symptom:** IBAN auf dem Quellrechner korrekt, beim Kunden falsch; eingehende Rechnungen einheitlich manipuliert (z.B. nach Litauen).\n' +
      '**Hypothesen:** (a) **Man-in-the-Mail / BEC** – Postfach kompromittiert, Weiterleitungs-/Posteingangsregeln, Anhaenge werden im Transit getauscht. (b) **Endpoint-Malware (Banking-Trojan)**, die PDFs beim Erzeugen/Senden manipuliert. (c) Kompromittierter Mailserver/Connector. (d) Tippfehler-Domain / Lieferanten kompromittiert.\n' +
      '**Beweis-Ableitung:** Header & Audit-Logs des Postfachs, Postfachregeln/Weiterleitungen, Vergleich gesendetes Original vs. zugestelltes PDF, Endpoint-Forensik (Autostarts/Prozesse), Mailflow-/Transport-Logs.',
    phases: [
      { id: 'triage', title: 'Identifikation & Sofortmassnahmen', steps: [
        s('bec-t-stop', 'check', 'Zahlungsstopp veranlassen', 'Sofort intern und bei betroffenen Kunden **vor Zahlungen auf neue/geaenderte IBANs warnen**. Bereits angewiesene Zahlungen pruefen.'),
        s('bec-t-scope', 'input', 'Umfang erfassen', 'Welche Konten/Postfaecher? Seit wann? Welche Kunden/Rechnungen betroffen? Schadenhoehe?', { field: { name: 'scope', label: 'Betroffene Postfaecher / Zeitraum / Schaden', kind: 'textarea' } }),
        s('bec-t-preserve', 'check', 'Beweise NICHT veraendern', 'Verdaechtige E-Mails **nicht loeschen/weiterleiten als Original** – als .eml/.msg mit vollstaendigen Headern exportieren. Original-PDFs (gesendet + zugestellt) sichern.'),
        s('bec-t-rule', 'choice', 'Verdaechtige Postfachregel/Weiterleitung gefunden?', 'Posteingangsregeln, Auto-Weiterleitung, delegierte Zugriffe pruefen.', { options: [
          { label: 'Ja – Postfach kompromittiert', setFlag: { k: 'mailbox_compromised', v: true } },
          { label: 'Nein / unklar', setFlag: { k: 'mailbox_compromised', v: false } }
        ] })
      ] },
      { id: 'comms', title: 'Krisenkommunikation & Meldepflichten', steps: [
        commManagement('bec'),
        s('bec-c-bank', 'comms', 'Bank: IBAN-Rueckruf / Recall', 'Hausbank des Geschaedigten **und** Empfaengerbank kontaktieren. SEPA-**Recall** der Ueberweisung anstossen (schnell!). Empfaengerkonto melden.', { commsId: 'bank_recall' }),
        s('bec-c-cust', 'comms', 'Kunden & Lieferanten warnen', 'Ueber **separaten, verifizierten Kanal** (Telefon, nicht per E-Mail-Antwort) vor falschen IBANs warnen und korrekte Bankdaten bestaetigen.', { commsId: 'partner_warning' }),
        commPolice('bec'),
        commLegalDSGVO('bec')
      ] },
      { id: 'forensik', title: 'Beweissicherung', steps: [
        ev('bec-f-headers', 'E-Mail-Header & verdaechtige Mails sichern', 'Vollstaendige Header der betroffenen Mails exportieren (Tool: **Mail-Header**). Original .eml/.msg sichern, Hash bilden.', { name: 'Verdaechtige E-Mails (.eml/.msg + Header)', type: 'datei', volatility: 'mittel', method: 'Export inkl. Header' }),
        ev('bec-f-pdfs', 'PDF-Diff: gesendet vs. zugestellt', 'Gesendetes Original-PDF und das beim Kunden angekommene PDF sichern und vergleichen (Metadaten/Producer/Aenderungsdatum, IBAN-Stelle).', { name: 'PDF-Paare (gesendet/zugestellt)', type: 'datei', volatility: 'niedrig', method: 'Sicherung + Vergleich' }),
        ev('bec-f-m365', 'Postfach-Audit & Regeln exportieren', 'M365/Exchange: Audit-Log (UAL), **Inbox-Rules**, Weiterleitungen, Anmeldungen/risikoreiche Sign-ins, OAuth-App-Grants. (Tool: **M365-Triage**).', { name: 'M365/Exchange Audit + Regeln', type: 'log', volatility: 'mittel', method: 'Audit-Export' }),
        ev('bec-f-endpoint', 'Endpoint-Triage des Quellrechners', 'Falls Malware-Hypothese: Triage des Rechners, der Rechnungen erstellt (Autostarts, Prozesse, Netz). (Tool: **Windows-Triage**).', { name: 'Endpoint-Triage Quellrechner', type: 'datei', volatility: 'hoch', method: 'Triage-Skript' })
      ] },
      { id: 'eindaemmung', title: 'Eindaemmung', steps: [
        s('bec-e-reset', 'check', 'Kompromittierte Konten sichern', 'Passwoerter + MFA aller betroffenen/privilegierten Postfaecher zuruecksetzen, **aktive Sessions/Token global invalidieren**, OAuth-Grants pruefen.', { showIf: { flag: 'mailbox_compromised' } }),
        s('bec-e-rules', 'check', 'Boesartige Regeln/Weiterleitungen entfernen', 'Nach Export (!) verdaechtige Inbox-Rules/Forwardings entfernen, delegierte Zugriffe bereinigen.'),
        s('bec-e-block', 'check', 'IOCs blockieren', 'Empfaenger-IBAN, Absenderadressen, Tippfehler-Domains, Mail-Infrastruktur als IOC erfassen und blockieren (Tab IOCs).')
      ] },
      { id: 'bereinigung', title: 'Bereinigung', steps: [
        s('bec-b-malware', 'check', 'Malware entfernen / Endpoint neu aufsetzen', 'Bei bestaetigter Endpoint-Malware betroffenen Rechner neu aufsetzen (kein „Saeubern" bei Banking-Trojanern).', { showIf: { answered: 'bec-t-scope' } }),
        s('bec-b-mailhygiene', 'check', 'Mailflow absichern', 'SPF/DKIM/DMARC pruefen/haerten, externe-Absender-Banner, Anti-Phishing-Policies schaerfen.')
      ] },
      { id: 'wiederanlauf', title: 'Wiederherstellung & sicherer Wiederanlauf', steps: recoveryCommon('bec').concat([
        s('bec-w-process', 'check', '4-Augen-Prinzip fuer Bankdaten', 'Prozess: IBAN-Aenderungen nur mit telefonischer Rueckbestaetigung; Zahlungen ueber Freigabe-/4-Augen-Workflow.')
      ]) },
      { id: 'ermittlung', title: 'Ermittlung / Analyse', steps: [
        s('bec-i-timeline', 'check', 'Angriffszeitachse rekonstruieren', 'Erstzugang (Phishing/Credential), Regel-Erstellung, manipulierte Sendungen, Geldfluss. IOCs und Geldwege fuer die Anzeige aufbereiten.'),
        s('bec-i-money', 'input', 'Geldfluss / Mule-Konto', 'Empfaengerkonto(en), Betraege, Zeitpunkte – fuer Bank & Polizei.', { field: { name: 'money', label: 'Konten / Betraege / Zeit', kind: 'textarea' } })
      ] },
      { id: 'abschluss', title: 'Abschluss', steps: closeout('bec') }
    ]
  };

  // ====================================================================== //
  //  FALL 2 – Umspannwerk 300 kV: Einbruch + Verdacht Manipulation Schutzgeraete (OT)
  // ====================================================================== //
  var sub = {
    id: 'ot-umspannwerk',
    title: 'Umspannwerk 300 kV – physischer Einbruch + OT-Manipulationsverdacht',
    category: 'OT/ICS · Energie (KRITIS)',
    severity: 'kritisch',
    oneLiner: 'Einbruch ohne Diebstahl/Schaden; Verdacht auf Cyber-Manipulation, ggf. an Schutzgeraeten (Schutzrelais).',
    derivation:
      '**Symptom:** Physischer Zutritt, „nichts weg", aber moegliche Manipulation an **Schutzgeraeten/Relais** (IEC 61850 / IEC 60870-5-104) oder Engineering-Laptop.\n' +
      '**Hypothesen:** Manipulierte Relais-Parametersaetze/Logik (Fehlausloesung oder unterdrueckte Schutzfunktion), eingeschleuste Hardware (Rogue-Geraet/Funk), kompromittierte Engineering-Workstation, Firmware-Tausch.\n' +
      '**Beweis-Ableitung:** Relais-Event-/Stoerschriebe, Parametersatz-/Konfig-Versionen + Pruefsummen, Engineering-Workstation-Image, Stations-/Prozessbus-Captures, Zutritts-/Video-/Tuerkontakt-Logs, sichtpruefung auf Fremdhardware. **Safety vor allem.**',
    phases: [
      { id: 'triage', title: 'Sicherheit & Sofortmassnahmen', steps: [
        s('sub-t-safety', 'choice', 'Gefahr fuer Leib/Leben oder Netzstabilitaet?', '**300 kV – Lebensgefahr.** Nur mit Anlagenverantwortlichem/Schaltberechtigung handeln. Keine Schalthandlung/Trennung ohne Freigabe.', { options: [
          { label: 'Ja – Netzbetrieb/Sicherheit gefaehrdet', setFlag: { k: 'safety_critical', v: true } },
          { label: 'Stabil, beobachtet', setFlag: { k: 'safety_critical', v: false } }
        ] }),
        s('sub-t-coord', 'check', 'Leitstelle/Netzbetreiber einbinden', 'Mit Netzleitstelle & Anlagenverantwortlichem koordinieren. **Schutzfunktionen NICHT eigenmaechtig abschalten.** Manuelle Ueberwachung erhoehen.'),
        s('sub-t-secure', 'check', 'Tatort sichern (physisch + digital)', 'Bereich absperren, nichts beruehren/ein-/ausschalten. Fremdhardware NICHT entfernen, nur dokumentieren (Fotos). Spuren fuer Polizei erhalten.'),
        s('sub-t-photo', 'evidence', 'Fotodokumentation', 'Schraenke, Relais-Displays/LEDs, Verkabelung, evtl. Fremdgeraete, Siegel/Plomben fotografieren.', { evidence: { name: 'Fotodokumentation Anlage', type: 'foto', volatility: 'niedrig', method: 'Foto' } })
      ] },
      { id: 'comms', title: 'Krisenkommunikation & Meldepflichten', steps: [
        commManagement('sub'),
        s('sub-c-kritis', 'comms', 'KRITIS-Meldung BSI + BNetzA', 'Energieversorgung = **KRITIS**: Meldung an **BSI** (§8b BSIG) und **BNetzA**; CERT/EnergieCERT einbinden. Netzbetreiber/Uebertragungsnetzbetreiber informieren.', { commsId: 'kritis_bsi' }),
        s('sub-c-police', 'comms', 'Polizei/Staatsschutz – Einbruch', 'Physischer Einbruch in KRITIS: Polizei/Staatsschutz. **Spuren/Asservate** sichern.', { commsId: 'police_report' }),
        commLegalDSGVO('sub')
      ] },
      { id: 'forensik', title: 'Beweissicherung (OT)', steps: [
        ev('sub-f-relay', 'Relais: Events, Stoerschriebe, Parametersaetze', 'Pro Schutzgeraet: Ereignis-/Fehlerspeicher, Stoerschriebe (COMTRADE), **aktiven Parametersatz + Pruefsumme** exportieren und mit Soll-/Referenzstand vergleichen.', { name: 'Relais-Configs/Events (COMTRADE)', type: 'log', volatility: 'mittel', method: 'Engineering-Tool-Export' }),
        ev('sub-f-ews', 'Engineering-Workstation forensisch sichern', 'Konfig-PC/Engineering-Laptop: moeglichst **Speicherabbild + Disk-Image** (write-blocker), sonst Live-Triage. Projekt-/Aenderungshistorie sichern.', { name: 'Engineering-Workstation Image', type: 'image', volatility: 'hoch', method: 'RAM+Disk-Image' }),
        ev('sub-f-net', 'Stations-/Prozessbus aufzeichnen', 'Passiv mitschneiden (SPAN/TAP) auf Stationsbus (MMS/GOOSE) und 104; auf unerwartete Master/Kommandos achten. (Tool: **OT-Netzwerk-Capture**).', { name: 'OT-Netzwerk-Capture (pcap)', type: 'netzwerk', volatility: 'hoch', method: 'TAP/SPAN passiv' }),
        ev('sub-f-access', 'Zutritts-, Tuer- & Videologs', 'Zutrittskontrolle, Tuerkontakte, Kameraaufzeichnung zum Tatzeitfenster sichern.', { name: 'Zutritts-/Videologs', type: 'log', volatility: 'mittel', method: 'Export' })
      ] },
      { id: 'eindaemmung', title: 'Eindaemmung', steps: [
        s('sub-e-isolate', 'check', 'Fernzugaenge schliessen', 'Fernwartungszugaenge (VPN/Modem/Mobilfunk) zur Station kontrolliert sperren – in Abstimmung mit Leitstelle, ohne Schutzfunktion zu verlieren.'),
        s('sub-e-rogue', 'check', 'Fremdhardware behandeln', 'Identifizierte Rogue-Hardware dokumentiert sichern (als Asservat), Entfernen nur mit Anlagenverantwortlichem.'),
        s('sub-e-restore-cfg', 'check', 'Schutzparameter verifizieren', 'Manipulierte Parametersaetze gegen signierte Referenz pruefen; nur nach Freigabe auf Soll-Stand zuruecksetzen.', { showIf: { flag: 'safety_critical' } })
      ] },
      { id: 'bereinigung', title: 'Bereinigung', steps: [
        s('sub-b-firmware', 'check', 'Firmware/Integritaet pruefen', 'Relais-/RTU-Firmware gegen Herstellersignatur verifizieren; bei Zweifel Hersteller einbinden, Geraete tauschen.'),
        s('sub-b-ews', 'check', 'Engineering-Workstation neu aufsetzen', 'EWS sauber neu aufsetzen; Projektdaten nur aus verifizierter Quelle.')
      ] },
      { id: 'wiederanlauf', title: 'Sicherer Wiederanlauf', steps: recoveryCommon('sub').concat([
        s('sub-w-test', 'check', 'Schutzpruefung vor Freigabe', 'Sekundaerpruefung/Schutzpruefung der Relais (Soll-Ausloesung) durch Fachpersonal vor Rueckkehr in den Normalbetrieb.')
      ]) },
      { id: 'ermittlung', title: 'Ermittlung / Analyse', steps: [
        s('sub-i-correlate', 'check', 'Physisch + digital korrelieren', 'Zutrittszeit mit Geraete-Events/Config-Aenderungen/Netzauffaelligkeiten korrelieren. Taeterzugang & Wirkung rekonstruieren.'),
        s('sub-i-vendor', 'check', 'Hersteller-Forensik', 'Relais-/RTU-Hersteller fuer Tiefenanalyse (Firmware, Logik) einbinden.')
      ] },
      { id: 'abschluss', title: 'Abschluss', steps: closeout('sub') }
    ]
  };

  // ====================================================================== //
  //  FALL 3 – Bahnstellwerk: aktive Fernsteuerung (Maus bewegt sich) (OT, Safety)
  // ====================================================================== //
  var rail = {
    id: 'ot-stellwerk',
    title: 'Bahnstellwerk – aktiver Eindringling (Maus bewegt sich)',
    category: 'OT/ICS · Bahn (Safety-kritisch)',
    severity: 'kritisch',
    oneLiner: 'Schaltmeister sieht Mauszeiger sich ohne Eingabe bewegen – aktiver Fernzugriff auf einem sicherheitsrelevanten Bedienplatz.',
    derivation:
      '**Symptom:** Live-Fernsteuerung (RAT/Remote-Tool) auf einem Stellwerks-Bedienplatz.\n' +
      '**Hypothesen:** Aktive Remote-Session (RAT/legit. Fernwartung missbraucht), kompromittierter Bedien-PC, Sprung aus dem Buero-/Fernwartungsnetz.\n' +
      '**Konflikt:** **Bahnbetriebssicherheit vor Forensik.** Niemals eigenmaechtig sicherheitsrelevante Stelllogik/Aussensignale beeinflussen. Erst Betrieb sichern (ggf. Rueckfallebene/handvermittelter Betrieb durch Fahrdienstleiter), dann Fluechtige Daten sichern, dann trennen.',
    phases: [
      { id: 'triage', title: 'Sicherheit & Sofortmassnahmen', steps: [
        s('rail-t-betrieb', 'check', 'Betriebssicherheit zuerst', 'Sofort **Fahrdienstleiter/Betriebsleitung** einbinden. Auf betriebliche **Rueckfallebene** (z.B. handvermittelter Betrieb, Langsamfahr-/Halt) gehen. Keine Zugfahrt auf Basis potenziell manipulierter Anzeigen.'),
        s('rail-t-observe', 'check', 'Beobachten, nicht stoeren', 'Aktionen des Angreifers **beobachten und protokollieren** (Foto/Video des Bildschirms). Noch **nicht** Netzwerk ziehen – fluechtige Beweise zuerst (siehe Forensik).'),
        s('rail-t-noinput', 'check', 'Eingaben am Bedienplatz vermeiden', 'Maus/Tastatur nicht „gegensteuern". Bei akuter Gefahr Bedienplatz gemaess Betriebsanweisung in sicheren Zustand.'),
        s('rail-t-decide', 'choice', 'Aktive Manipulation sicherheitsrelevant?', 'Bedroht die Aktion unmittelbar den Bahnbetrieb?', { options: [
          { label: 'Ja – sofort trennen nach Foto/RAM', setFlag: { k: 'rail_imminent', v: true } },
          { label: 'Nein – kontrolliert sichern', setFlag: { k: 'rail_imminent', v: false } }
        ] })
      ] },
      { id: 'comms', title: 'Krisenkommunikation & Meldepflichten', steps: [
        commManagement('rail'),
        s('rail-c-eba', 'comms', 'Meldung EBA + BSI (KRITIS Bahn)', 'Eisenbahn ist KRITIS: Betreiber-Meldewege, **Eisenbahn-Bundesamt (EBA)** und **BSI** informieren; konzernweites CERT/SOC (z.B. DB CERT) einbinden.', { commsId: 'kritis_bahn' }),
        s('rail-c-police', 'comms', 'Polizei/Bundespolizei', 'Angriff auf Bahninfrastruktur: Bundespolizei/Staatsschutz. Asservate sichern.', { commsId: 'police_report' })
      ] },
      { id: 'forensik', title: 'Beweissicherung (fluechtig zuerst)', steps: [
        ev('rail-f-screen', 'Bildschirm-Foto/Video der Live-Session', 'Vor jeglicher Trennung die aktive Sitzung filmen/fotografieren (Mauswege, geoeffnete Fenster, Tools).', { name: 'Bildschirm-Aufnahme Live-Angriff', type: 'foto', volatility: 'hoch', method: 'Foto/Video' }),
        ev('rail-f-ram', 'RAM-Abbild des Bedien-PCs', 'Wenn ohne Betriebsgefaehrdung moeglich: **Speicherabbild** ziehen (haelt RAT-Prozess/Verbindungen). Danach erst Netz trennen.', { name: 'RAM-Abbild Bedien-PC', type: 'memory', volatility: 'hoch', method: 'Memory-Acquisition' }),
        ev('rail-f-net', 'Netzwerk-Capture der aktiven Verbindung', 'Am Uplink passiv mitschneiden – Remote-IP/Port/Protokoll der C2/RAT-Verbindung. (Tool: **OT-Netzwerk-Capture**).', { name: 'Netzwerk-Capture C2', type: 'netzwerk', volatility: 'hoch', method: 'TAP/SPAN' }),
        ev('rail-f-disk', 'Disk-Image nach Trennung', 'Nach kontrolliertem Trennen Datentraeger forensisch sichern (Tool: **Windows-Triage** als Minimal-Fallback).', { name: 'Disk-Image Bedien-PC', type: 'image', volatility: 'mittel', method: 'Image/Triage' })
      ] },
      { id: 'eindaemmung', title: 'Eindaemmung', steps: [
        s('rail-e-cut', 'check', 'Fernzugang trennen (kontrolliert)', 'Nach Sicherung der fluechtigen Daten den **Remote-Zugang** kappen (Netz/Fernwartung), Bedien-PC isolieren. Mit Betrieb abgestimmt.'),
        s('rail-e-jump', 'check', 'Zugangsweg schliessen', 'Genutzten Fernwartungs-/Sprungpunkt sperren, Konten der Fernwartung sperren/zuruecksetzen.'),
        s('rail-e-scope', 'check', 'Ausbreitung pruefen', 'Weitere Bedienplaetze/Server auf gleiche RAT/IOCs pruefen.')
      ] },
      { id: 'bereinigung', title: 'Bereinigung', steps: [
        s('rail-b-rebuild', 'check', 'Bedienplatz neu aufsetzen', 'Kompromittierten Bedien-PC neu aufsetzen (kein Inplace-Clean).'),
        s('rail-b-remote', 'check', 'Fernwartung haerten', 'Fernwartung nur ueber gehaertete, ueberwachte, MFA-gesicherte Wege; Standard-/Sammelkonten entfernen.')
      ] },
      { id: 'wiederanlauf', title: 'Sicherer Wiederanlauf', steps: recoveryCommon('rail').concat([
        s('rail-w-betrieb', 'check', 'Freigabe nur durch Betrieb', 'Rueckkehr aus der Rueckfallebene in den Normalbetrieb erst nach Freigabe von Betrieb + IR-Team und verifizierter Integritaet.')
      ]) },
      { id: 'ermittlung', title: 'Ermittlung / Analyse', steps: [
        s('rail-i-path', 'check', 'Angriffsweg rekonstruieren', 'Von der Remote-IP rueckwaerts: Sprungpunkt, Erstzugang, Zeitachse. C2 als IOC. Persistenz suchen.'),
        s('rail-i-other', 'check', 'Querschlag in andere Stellwerke pruefen', 'Gleiche Fernwartungsinfrastruktur an anderen Standorten pruefen.')
      ] },
      { id: 'abschluss', title: 'Abschluss', steps: closeout('rail') }
    ]
  };

  // ====================================================================== //
  //  FALL 4 – Ransomware Baeckerei (Kasse bis Klima)
  // ====================================================================== //
  var ransom = {
    id: 'ransomware',
    title: 'Ransomware – alles verschluesselt (Kasse, Buero, Klima)',
    category: 'IT/OT · Ransomware',
    severity: 'kritisch',
    oneLiner: 'Flaechendeckende Verschluesselung von POS, Buero-IT bis Gebaeude-/Klimasteuerung.',
    derivation:
      '**Symptom:** Verschluesselte Dateien, Ransom-Note, Ausfall Kasse/Buero/Klima (IT+OT).\n' +
      '**Hypothesen:** Domaenenweite Ransomware nach Erstzugang (Phishing/RDP/VPN/Exploit), Lateral Movement, evtl. Datendiebstahl (Double Extortion).\n' +
      '**Beweis-Ableitung:** Ransom-Note + verschluesselte Samples (Variante/Decryptor), „Patient Zero", RAM des betroffenen Systems, AD-/EDR-/VPN-/Firewall-Logs, Backups-Status, Exfil-Hinweise.',
    phases: [
      { id: 'triage', title: 'Identifikation & Sofortmassnahmen', steps: [
        s('ran-t-isolate', 'check', 'Sofort isolieren – nicht ausschalten', 'Betroffene Systeme vom Netz trennen (Kabel/WLAN/Port), **aber NICHT ausschalten** (RAM/Schluesselspuren). Ausbreitung stoppen (Switch-Ports, WLAN, VPN).'),
        s('ran-t-note', 'evidence', 'Ransom-Note & verschluesselte Samples sichern', 'Erpresserschreiben + einige verschluesselte Dateien + Originale (falls vorhanden) sichern (Varianten-/Decryptor-Bestimmung).', { evidence: { name: 'Ransom-Note + Samples', type: 'datei', volatility: 'niedrig', method: 'Kopie' } }),
        s('ran-t-backups', 'choice', 'Backups intakt & getrennt?', 'Sind Offline-/Immutable-Backups vorhanden und **nicht** mitverschluesselt?', { options: [
          { label: 'Ja – saubere Backups vorhanden', setFlag: { k: 'backups_ok', v: true } },
          { label: 'Nein / unsicher', setFlag: { k: 'backups_ok', v: false } }
        ] }),
        s('ran-t-nopay', 'check', 'Keine vorschnelle Zahlung', 'Loesegeldzahlung nicht vorschnell – rechtliche/Sanktions-Risiken, keine Garantie. Erst Lagebild + Behoerden + Backups pruefen.')
      ] },
      { id: 'comms', title: 'Krisenkommunikation & Meldepflichten', steps: [
        commManagement('ran'),
        commPolice('ran'),
        s('ran-c-id', 'comms', 'No-More-Ransom / Decryptor pruefen', 'Variante ueber **nomoreransom.org** / ID-Ransomware bestimmen; ggf. existiert ein kostenloser Decryptor.', { commsId: 'ransomware_id' }),
        commLegalDSGVO('ran'),
        s('ran-c-stakeholder', 'comms', 'Mitarbeiter/Kunden/Lieferanten', 'Betriebsausfall transparent, kontrolliert kommunizieren (Holding Statement), Geschaeftsbetrieb-Notbetrieb organisieren.', { commsId: 'holding_statement' })
      ] },
      { id: 'forensik', title: 'Beweissicherung', steps: [
        ev('ran-f-ram', 'RAM des Patient-Zero / Schluesselsystems', 'Vor Abschalten Speicherabbild ziehen (moegliche Schluessel/Prozesse). (Tool: **Windows-Triage**/Memory).', { name: 'RAM-Abbild Patient Zero', type: 'memory', volatility: 'hoch', method: 'Memory-Acquisition' }),
        ev('ran-f-triage', 'Endpoint-Triage betroffener Systeme', 'Autostarts, Dienste, geplante Tasks, Event-Logs, Prefetch, RDP-/PsExec-Spuren. (Tool: **Windows-Triage**).', { name: 'Endpoint-Triage-Pakete', type: 'datei', volatility: 'hoch', method: 'Triage-Skript' }),
        ev('ran-f-logs', 'Zentrale Logs: AD, VPN, Firewall, EDR', 'Erstzugang & Lateral Movement: DC-Security-Logs, VPN/RDP, Firewall, EDR-Alarme; Zeitachse aufbauen.', { name: 'Zentrale Logs', type: 'log', volatility: 'mittel', method: 'Export' }),
        ev('ran-f-exfil', 'Exfiltration pruefen', 'Hinweise auf Datenabfluss (grosse Uploads, Rclone/Mega, ungewoehnliche Ziele) – relevant fuer DSGVO/Erpressung.', { name: 'Exfil-Indikatoren', type: 'netzwerk', volatility: 'mittel', method: 'Log-/Netzanalyse' })
      ] },
      { id: 'eindaemmung', title: 'Eindaemmung', steps: [
        s('ran-e-segment', 'check', 'Netz segmentieren / OT trennen', 'IT von OT (Klima/Gebaeude) trennen; betroffene Segmente abkapseln; AD/zentrale Dienste schuetzen.'),
        s('ran-e-creds', 'check', 'Admin-Zugaenge sperren/zuruecksetzen', 'Privilegierte Konten zuruecksetzen, **KRBTGT** ggf. (2x) ruecksetzen, Dienste-Konten pruefen.'),
        s('ran-e-ioc', 'check', 'IOCs blocken', 'C2/Tooling/Hashes als IOC erfassen und blockieren.')
      ] },
      { id: 'bereinigung', title: 'Bereinigung', steps: [
        s('ran-b-rebuild', 'check', 'Neu aufsetzen statt entschluesseln-und-weiter', 'Betroffene Systeme **neu aufsetzen** (Image). Persistenz/Backdoors entfernen. Schwachstelle des Erstzugangs schliessen.'),
        s('ran-b-patch', 'check', 'Erstzugang schliessen', 'Ausgenutzten Weg (RDP/VPN/Exploit/Phishing) abstellen: patchen, MFA, RDP/VPN haerten.')
      ] },
      { id: 'wiederanlauf', title: 'Wiederherstellung & sicherer Wiederanlauf', steps: [
        s('ran-w-priority', 'check', 'Wiederanlauf priorisieren', 'Kritische Prozesse zuerst (Kasse/Verkauf, Kuehlung/Klima fuer Ware). Notbetrieb definieren.'),
        s('ran-w-restore', 'check', 'Aus verifiziert sauberen Backups', 'Restore nur aus geprueften Backups in **gesaeubertem** Netz; vor Wiederanschluss EDR/Monitoring aktiv.', { showIf: { flag: 'backups_ok' } }),
        s('ran-w-norestore', 'check', 'Ohne Backup: Decryptor/Neuaufbau', 'Ohne saubere Backups: Decryptor-Pruefung, sonst Daten-Neuaufbau; Zahlung nur nach Recht/Behoerden-Ruecksprache.', { showIf: { flag: 'backups_ok', equals: false } })
      ].concat(recoveryCommon('ran')) },
      { id: 'ermittlung', title: 'Ermittlung / Analyse', steps: [
        s('ran-i-rootcause', 'check', 'Root Cause & Zeitachse', 'Erstzugang, Verweildauer, Lateral Movement, Verschluesselungszeitpunkt, Exfil. Fuer Anzeige/DSGVO aufbereiten.'),
        s('ran-i-attrib', 'check', 'Variante/Gruppe & Exfil bewerten', 'Ransomware-Familie, Leak-Site pruefen (Daten veroeffentlicht?), Betroffenheit personenbez. Daten bewerten.')
      ] },
      { id: 'abschluss', title: 'Abschluss', steps: closeout('ran') }
    ]
  };

  // ====================================================================== //
  //  FALL 5 – AD-Brute-Force -> Domain-Admin kompromittiert (Molkerei)
  // ====================================================================== //
  var ad = {
    id: 'ad-bruteforce',
    title: 'Active Directory – Brute Force auf Domain-Admin, dann erfolgreich',
    category: 'IT · Identitaet / AD-Kompromittierung',
    severity: 'kritisch',
    oneLiner: 'IDS meldet ~400 fehlgeschlagene Logins gegen einen Domain-Admin in der Produktion, danach ein erfolgreicher.',
    derivation:
      '**Symptom:** Brute-Force/Password-Spray gegen Domain-Admin, dann Erfolg – **Tier-0-Kompromittierung**.\n' +
      '**Hypothesen:** Angreifer hat DA-Zugang -> Gefahr Golden Ticket, DCSync, GPO-Missbrauch, domaenenweite Kontrolle, Bruecke IT->OT (Produktion).\n' +
      '**Beweis-Ableitung:** DC-Security-Logs (4625/4624/4768/4769/4672), Quelle der Anmeldungen, NTDS.dit/lsass-Zugriff, neue Konten/Gruppen/GPO, Logon-Typen, Zeiten.',
    phases: [
      { id: 'triage', title: 'Identifikation & Sofortmassnahmen', steps: [
        s('ad-t-confirm', 'input', 'Erfolg & Quelle bestaetigen', 'Welcher Account, ab wann erfolgreich (Event 4624), von welcher Quell-IP/Host, Logon-Typ?', { field: { name: 'confirm', label: 'Account / Zeit / Quelle / Logon-Typ', kind: 'textarea' } }),
        s('ad-t-disable', 'check', 'Kompromittiertes DA-Konto sofort sperren', 'Betroffenes Domain-Admin-Konto deaktivieren/Passwort zuruecksetzen, **Sessions/Tickets invalidieren**. Nicht den eigenen Notfallzugang aussperren.'),
        s('ad-t-isolate', 'check', 'Quell-Host isolieren', 'Angreifer-Quellhost(e) vom Netz trennen (nicht ausschalten – RAM).'),
        s('ad-t-tier0', 'check', 'Tier-0 schuetzen', 'DCs, ADFS/AAD-Connect, PKI als Tier-0 absichern; privilegierte Anmeldungen einschraenken.')
      ] },
      { id: 'comms', title: 'Krisenkommunikation & Meldepflichten', steps: [
        commManagement('ad'),
        commPolice('ad'),
        commLegalDSGVO('ad'),
        s('ad-c-prod', 'comms', 'Produktion/OT-Verantwortliche warnen', 'Da Domain in der **Produktion**: OT/Anlagenverantwortliche einbinden (Bruecke IT->OT, Sicherheits-/Lebensmittelrisiko).', { commsId: 'ot_warning' })
      ] },
      { id: 'forensik', title: 'Beweissicherung', steps: [
        ev('ad-f-dclogs', 'DC-Security-Logs sichern', 'Alle DCs: Security-EventLogs (4625/4624/4768/4769/4672/4720/4728/4672), zeitlich um den Erfolg. (Tool: **AD-Triage**).', { name: 'DC-Security-Logs', type: 'log', volatility: 'mittel', method: 'EVTX-Export' }),
        ev('ad-f-source', 'Quell-Host forensisch sichern', 'RAM + Triage des erfolgreich anmeldenden Hosts (Tools, Mimikatz-Spuren, Tickets). (Tool: **Windows-Triage**).', { name: 'Quell-Host Triage/RAM', type: 'memory', volatility: 'hoch', method: 'RAM+Triage' }),
        ev('ad-f-ntds', 'DCSync/NTDS-Zugriff pruefen', 'Hinweise auf DCSync (4662 Replikation), lsass-Dump, NTDS.dit-Zugriff sichern/bewerten.', { name: 'NTDS/DCSync-Indikatoren', type: 'log', volatility: 'mittel', method: 'Analyse' }),
        ev('ad-f-changes', 'AD-Aenderungen sichern', 'Neue Konten/Gruppenmitgliedschaften (Domain Admins), neue/geaenderte GPOs, Aufgabenplanungen.', { name: 'AD-Aenderungsspuren', type: 'log', volatility: 'mittel', method: 'Export' })
      ] },
      { id: 'eindaemmung', title: 'Eindaemmung', steps: [
        s('ad-e-krbtgt', 'check', 'KRBTGT zweimal zuruecksetzen', 'Bei DA-Kompromittierung **KRBTGT-Passwort 2x** (mit Replikationspause) ruecksetzen -> Golden Tickets ungueltig.'),
        s('ad-e-admins', 'check', 'Privilegierte Konten bereinigen', 'Alle Tier-0-/Admin-Passwoerter rotieren, fremde/neue Admin-Konten entfernen, Gruppen bereinigen.'),
        s('ad-e-block', 'check', 'Quelle blocken / Spray stoppen', 'Quell-IPs blockieren, Account-Lockout/Smart-Lockout, exponierte Auth (RDP/VPN/OWA) absichern.')
      ] },
      { id: 'bereinigung', title: 'Bereinigung', steps: [
        s('ad-b-persistence', 'check', 'Persistenz jagen & entfernen', 'Skeleton-Key, AdminSDHolder, GPO-Backdoors, geplante Tasks, Dienste, neue Zertifikate (AD CS) pruefen/bereinigen.'),
        s('ad-b-rebuild', 'check', 'Kompromittierte Hosts neu aufsetzen', 'Quell-/lateral betroffene Systeme neu aufsetzen. Bei DC-Kompromittierung Wiederaufbau-Strategie pruefen.')
      ] },
      { id: 'wiederanlauf', title: 'Sicherer Wiederanlauf', steps: recoveryCommon('ad').concat([
        s('ad-w-tiering', 'check', 'Tiering & MFA einfuehren', 'Admin-Tier-Modell, getrennte Admin-Workstations (PAW), MFA/lange Passphrasen, Monitoring auf 4625/4768-Anomalien.')
      ]) },
      { id: 'ermittlung', title: 'Ermittlung / Analyse', steps: [
        s('ad-i-timeline', 'check', 'Zeitachse & Reichweite', 'Von Spray bis Erfolg, danach: Welche Systeme/Daten? Bruecke in OT? Datenabfluss?'),
        s('ad-i-scope', 'check', 'Vollstaendigkeit pruefen', 'Erst Normalbetrieb, wenn Persistenz ausgeschlossen und alle Tier-0-Geheimnisse rotiert sind.')
      ] },
      { id: 'abschluss', title: 'Abschluss', steps: closeout('ad') }
    ]
  };

  // ====================================================================== //
  //  FALL 6 – Supply-Chain: Wartungstechniker-Laptop mit Malware (Solar/BESS)
  // ====================================================================== //
  var solar = {
    id: 'supplychain-solar',
    title: 'Supply-Chain – Wartungslaptop mit Malware (4 MW Solar + 500 kW Speicher)',
    category: 'OT/ICS · Energie / Lieferkette',
    severity: 'hoch',
    oneLiner: 'Lieferant meldet: Laptop des gestrigen Wartungstechnikers hat Malware mit C2 nach Russland.',
    derivation:
      '**Symptom:** Fremdgeraet mit aktiver Malware war gestern direkt an der Anlage (Wechselrichter/BMS/SCADA).\n' +
      '**Hypothesen:** Uebertragung auf Anlagensteuerung (HMI/PLC/Inverter/BMS), Persistenz/Backdoor, Fernsteuerbarkeit von Einspeisung/Speicher, Datenabfluss. **Annahme: kompromittiert, bis widerlegt.**\n' +
      '**Beweis-Ableitung:** Forensik des Techniker-Laptops (ueber Lieferant), Anlagen-HMI/Engineering-PC, Inverter-/BMS-Logs, Netzwerk-Capture (C2/Russland-IOC), USB-/Verbindungsspuren, Zeitfenster des Einsatzes.',
    phases: [
      { id: 'triage', title: 'Identifikation & Sofortmassnahmen', steps: [
        s('sol-t-assume', 'check', 'Anlage als potenziell kompromittiert behandeln', 'Annahme: Steuerung evtl. infiziert. **Sicherheit/Netzstabilitaet zuerst** – keine unsichere Schalthandlung an Speicher/Einspeisung.'),
        s('sol-t-ioc', 'input', 'IOCs vom Lieferanten anfordern', 'Hashes, C2-Domains/IPs (Russland), Malware-Familie, Einsatzzeitfenster, welche Geraete der Techniker beruehrte/verband.', { field: { name: 'iocs', label: 'IOCs / Zeitfenster / beruehrte Geraete', kind: 'textarea' } }),
        s('sol-t-isolate', 'check', 'Fernzugriff der Anlage einschraenken', 'Fernwartung/Cloud-Anbindung der Wechselrichter/BMS/SCADA kontrolliert isolieren (mit Netzbetreiber/Betrieb abstimmen).'),
        s('sol-t-decide', 'choice', 'Hinweise auf Manipulation der Steuerung?', 'Auffaellige Sollwerte/Schaltzustaende/Verbindungen an Inverter/BMS/HMI?', { options: [
          { label: 'Ja – aktive Manipulation', setFlag: { k: 'plant_manipulated', v: true } },
          { label: 'Nein / unklar', setFlag: { k: 'plant_manipulated', v: false } }
        ] })
      ] },
      { id: 'comms', title: 'Krisenkommunikation & Meldepflichten', steps: [
        commManagement('sol'),
        s('sol-c-supplier', 'comms', 'Lieferant: Forensik & Haftung', 'Lieferant verbindlich einbinden: **forensisches Image des Techniker-Laptops** sichern lassen, IOCs, welche Kundenanlagen noch betroffen (Supply-Chain-Breite!), Haftung/Vertrag.', { commsId: 'supplier_forensics' }),
        s('sol-c-kritis', 'comms', 'BSI/BNetzA & Netzbetreiber', 'Je nach Groesse/Einspeisung Melde-/Informationswege Energie (BSI/BNetzA), Netzbetreiber informieren; CERT einbinden.', { commsId: 'kritis_bsi' }),
        commPolice('sol')
      ] },
      { id: 'forensik', title: 'Beweissicherung', steps: [
        ev('sol-f-laptop', 'Techniker-Laptop forensisch sichern (ueber Lieferant)', 'Vollstaendiges Image + RAM des Laptops sicherstellen (Beweis: was wurde mit der Anlage gemacht, welche Tools/Verbindungen).', { name: 'Techniker-Laptop Image/RAM', type: 'image', volatility: 'hoch', method: 'Image via Lieferant' }),
        ev('sol-f-hmi', 'Anlagen-HMI/Engineering-PC triagieren', 'HMI/SCADA-/Engineering-PC: Autostarts, USB-Historie, neue Dienste, Projekt-/Config-Aenderungen, Logs. (Tool: **Windows-Triage**).', { name: 'HMI/Engineering-PC Triage', type: 'datei', volatility: 'hoch', method: 'Triage-Skript' }),
        ev('sol-f-net', 'Netzwerk-Capture: C2 nach Russland', 'Am Anlagen-Uplink passiv mitschneiden; auf die gemeldeten C2-IOCs/Russland-Ziele pruefen. (Tool: **OT-Netzwerk-Capture**).', { name: 'Netzwerk-Capture (C2)', type: 'netzwerk', volatility: 'hoch', method: 'TAP/SPAN' }),
        ev('sol-f-devlogs', 'Inverter-/BMS-/SCADA-Logs', 'Ereignis-/Parameter-/Firmware-Logs der Wechselrichter, BMS und SCADA zum Einsatzzeitfenster sichern.', { name: 'Inverter/BMS/SCADA-Logs', type: 'log', volatility: 'mittel', method: 'Export' })
      ] },
      { id: 'eindaemmung', title: 'Eindaemmung', steps: [
        s('sol-e-block', 'check', 'C2-IOCs blockieren', 'Gemeldete Russland-C2 (IP/Domain/Hash) ueberall blockieren; Anlagen-Internetzugang minimieren.'),
        s('sol-e-segment', 'check', 'Anlage segmentieren', 'Wechselrichter/BMS/SCADA von Office/Internet trennen; nur noetige Verbindungen.'),
        s('sol-e-control', 'check', 'Steuerung sicherstellen', 'Bei Manipulationsverdacht Sollwerte/Schutz-/Lade-Parameter pruefen, manuell ueberwachen.', { showIf: { flag: 'plant_manipulated' } })
      ] },
      { id: 'bereinigung', title: 'Bereinigung', steps: [
        s('sol-b-rebuild', 'check', 'Betroffene Steuerrechner neu aufsetzen', 'HMI/Engineering-PC neu aufsetzen; Projekt/Firmware nur aus verifizierter Hersteller-Quelle.'),
        s('sol-b-firmware', 'check', 'Firmware-Integritaet Inverter/BMS', 'Firmware/Konfig gegen Hersteller-Referenz pruefen; bei Zweifel Hersteller einbinden.')
      ] },
      { id: 'wiederanlauf', title: 'Sicherer Wiederanlauf', steps: recoveryCommon('sol').concat([
        s('sol-w-access', 'check', 'Wartungszugang neu regeln', 'Fremdgeraete-Policy: keine Lieferanten-Laptops direkt an OT; geprueftes Wartungsnotebook, USB-Kontrolle, Protokollierung, Begleitung.')
      ]) },
      { id: 'ermittlung', title: 'Ermittlung / Analyse', steps: [
        s('sol-i-scope', 'check', 'Wirkung auf die Anlage feststellen', 'Hat die Malware die Steuerung erreicht? Was wurde geaendert/abgeflossen? Zeitachse Einsatz vs. Anlagen-Events.'),
        s('sol-i-supply', 'check', 'Lieferketten-Breite klaeren', 'Welche weiteren Kundenanlagen hat derselbe Techniker/Laptop besucht? Koordinierte Warnung.')
      ] },
      { id: 'abschluss', title: 'Abschluss', steps: closeout('sol') }
    ]
  };

  // ====================================================================== //
  //  FALL 7 – Phishing-Welle / Credential-Diebstahl
  // ====================================================================== //
  var phish = {
    id: 'phishing-wave',
    title: 'Phishing-Welle – Zugangsdaten abgegriffen',
    category: 'IT · Phishing / Identitaet',
    severity: 'hoch',
    oneLiner: 'Mehrere Mitarbeiter haben auf eine Phishing-Mail geklickt/Zugangsdaten eingegeben; Folgeanmeldungen aus dem Ausland.',
    derivation:
      '**Symptom:** Phishing-Mail an viele Empfaenger, Klicks/Credential-Eingaben, evtl. MFA-Fatigue.\n' +
      '**Hypothesen:** Credential-Diebstahl -> Kontomissbrauch (BEC/Datenabfluss), Token-/Session-Diebstahl trotz MFA (AiTM), Verteilung weiterer Mails intern.\n' +
      '**Beweis-Ableitung:** Mail (Header/URL/Payload), Klick-/Eingabe-Telemetrie (Proxy/Mailgateway), Sign-in-Logs (Land/IP/Geraet), MFA-Events, Postfachregeln, betroffene Empfaengerliste.',
    phases: [
      { id: 'triage', title: 'Identifikation & Sofortmassnahmen', steps: [
        s('ph-t-scope', 'input', 'Welle eingrenzen', 'Betreff/Absender/URL der Phishing-Mail, Empfaengerzahl, wer hat geklickt/Daten eingegeben?', { field: { name: 'scope', label: 'Mail / Empfaenger / Klicks', kind: 'textarea' } }),
        s('ph-t-pull', 'check', 'Mail aus Postfaechern entfernen', 'Nach Sicherung eines Originals die Phishing-Mail organisationsweit zurueckholen/quarantaenen (z.B. Search-and-Purge).'),
        s('ph-t-reset', 'check', 'Betroffene Konten zuruecksetzen', 'Passwoerter + **Sessions/Token invalidieren** der Nutzer, die Daten eingegeben haben; MFA pruefen/neu registrieren.'),
        s('ph-t-aitm', 'choice', 'Anzeichen fuer Token-/Session-Diebstahl (AiTM)?', 'Erfolgreiche Anmeldungen trotz MFA, neue MFA-Methoden, fremde Geraete?', { options: [
          { label: 'Ja – Session-Diebstahl', setFlag: { k: 'aitm', v: true } },
          { label: 'Nein / unklar', setFlag: { k: 'aitm', v: false } }
        ] })
      ] },
      { id: 'comms', title: 'Krisenkommunikation & Meldepflichten', steps: [
        commManagement('ph'),
        s('ph-c-warn', 'comms', 'Mitarbeiter warnen', 'Belegschaft ueber die Welle informieren: nicht klicken, melden; betroffene Nutzer gezielt ansprechen.', { commsId: 'holding_statement' }),
        commLegalDSGVO('ph'),
        commPolice('ph')
      ] },
      { id: 'forensik', title: 'Beweissicherung', steps: [
        ev('ph-f-mail', 'Phishing-Mail + URL/Payload sichern', 'Original .eml mit Headern, Ziel-URL (entschaerft), evtl. Landingpage. (Tool: **Mail-Header**).', { name: 'Phishing-Mail + IOCs', type: 'datei', volatility: 'mittel', method: 'Export' }),
        ev('ph-f-signin', 'Sign-in-/MFA-Logs sichern', 'Anmelde-Logs (IP/Land/Geraet), MFA-Events, neue Auth-Methoden, OAuth-Grants. (Tool: **M365-Triage**).', { name: 'Sign-in/MFA-Logs', type: 'log', volatility: 'mittel', method: 'Audit-Export' }),
        ev('ph-f-rules', 'Postfachregeln pruefen/sichern', 'Bei kompromittierten Konten Inbox-Rules/Weiterleitungen exportieren (Folge-BEC erkennen).', { name: 'Postfachregeln', type: 'log', volatility: 'mittel', method: 'Export' })
      ] },
      { id: 'eindaemmung', title: 'Eindaemmung', steps: [
        s('ph-e-block', 'check', 'IOCs blockieren', 'Absender/Domain/URL/IP sperren (Mailgateway, Proxy, DNS).'),
        s('ph-e-revoke', 'check', 'Sessions/Token global widerrufen', 'Bei AiTM Tokens/Refresh-Token widerrufen, Geraete entfernen, Conditional Access verschaerfen.', { showIf: { flag: 'aitm' } }),
        s('ph-e-hunt', 'check', 'Intern verteilte Mails jagen', 'Pruefen, ob kompromittierte Konten weitere Phishing-Mails intern/extern versandt haben.')
      ] },
      { id: 'bereinigung', title: 'Bereinigung', steps: [
        s('ph-b-rules', 'check', 'Boesartige Regeln/Grants entfernen', 'Nach Export verdaechtige Regeln, OAuth-App-Grants, MFA-Methoden bereinigen.'),
        s('ph-b-harden', 'check', 'Auth haerten', 'Phishing-resistente MFA (FIDO2), Conditional Access, Mailauthentifizierung (DMARC) staerken.')
      ] },
      { id: 'wiederanlauf', title: 'Sicherer Wiederanlauf', steps: recoveryCommon('ph') },
      { id: 'ermittlung', title: 'Ermittlung / Analyse', steps: [
        s('ph-i-impact', 'check', 'Auswirkung je Konto', 'Pro kompromittiertem Konto: Datenzugriff/Abfluss, BEC, laterale Nutzung. DSGVO-Relevanz bewerten.'),
        s('ph-i-camp', 'check', 'Kampagne attribuieren', 'Infrastruktur/Muster, ggf. Branchen-Welle; Warnung an Partner/CERT.')
      ] },
      { id: 'abschluss', title: 'Abschluss', steps: closeout('ph') }
    ]
  };

  // ====================================================================== //
  //  FALL 8 – Wasserwerk / Trinkwasser-OT-Manipulation
  // ====================================================================== //
  var water = {
    id: 'ot-wasserwerk',
    title: 'Wasserwerk – Manipulation der Trinkwasser-Steuerung (OT/KRITIS)',
    category: 'OT/ICS · Wasser (KRITIS, Gesundheit)',
    severity: 'kritisch',
    oneLiner: 'Auffaellige Sollwerte/Schaltzustaende in der Wasseraufbereitung (z.B. Dosierung/Chlorung) – Verdacht auf Manipulation.',
    derivation:
      '**Symptom:** Ungewoehnliche Steuer-/Sollwerte (Dosierpumpen, Chlorung, Pegel), evtl. Fernzugriff auf SCADA/PLC.\n' +
      '**Hypothesen:** Manipulierte Sollwerte/SPS-Logik (Gesundheitsgefahr durch Ueber-/Unterdosierung), kompromittierte HMI/Fernwartung, Internet-exponierte PLC.\n' +
      '**Konflikt:** **Gesundheit/Versorgung vor Forensik.** Erst Wasserqualitaet sichern (manuelle Kontrolle, ggf. Einspeisung stoppen/Reservoir), dann fluechtige Beweise.',
    phases: [
      { id: 'triage', title: 'Sicherheit & Sofortmassnahmen', steps: [
        s('wat-t-safety', 'check', 'Wasserqualitaet zuerst sichern', 'Mit Betriebsleitung/Wassermeister: Dosierung **manuell** verifizieren, ggf. auf Handbetrieb/sichere Voreinstellung, betroffene Einspeisung stoppen, Beprobung veranlassen.'),
        s('wat-t-health', 'choice', 'Akute Gesundheitsgefahr (Dosierung)?', 'Hinweis auf gefaehrliche Dosierwerte?', { options: [
          { label: 'Ja – Gesundheitsamt + Abkochgebot pruefen', setFlag: { k: 'health_risk', v: true } },
          { label: 'Nein / kontrolliert', setFlag: { k: 'health_risk', v: false } }
        ] }),
        s('wat-t-observe', 'check', 'Steuerung beobachten, nicht voreilig kappen', 'Auffaellige Sollwerte/Verbindungen dokumentieren (Foto/HMI-Screens). Fluechtige Beweise vor Trennung sichern.')
      ] },
      { id: 'comms', title: 'Krisenkommunikation & Meldepflichten', steps: [
        commManagement('wat'),
        s('wat-c-health', 'comms', 'Gesundheitsamt informieren', 'Bei moeglicher Beeintraechtigung der Trinkwasserqualitaet **Gesundheitsamt** einbinden (Trinkwasserverordnung), ggf. Abkochgebot.', { commsId: 'health_authority' }),
        s('wat-c-kritis', 'comms', 'BSI/KRITIS (Wasser) + Behoerden', 'KRITIS Sektor Wasser: BSI-Meldung, zustaendige Aufsichtsbehoerde; CERT einbinden.', { commsId: 'kritis_bsi' }),
        commPolice('wat')
      ] },
      { id: 'forensik', title: 'Beweissicherung (OT)', steps: [
        ev('wat-f-hmi', 'HMI/Engineering-PC sichern', 'HMI/SCADA-/Engineering-Rechner: RAM + Disk/Triage, Projekt-/Logik-Aenderungen, USB-Historie. (Tool: **Windows-Triage**).', { name: 'HMI/Engineering Triage', type: 'image', volatility: 'hoch', method: 'RAM+Triage' }),
        ev('wat-f-plc', 'PLC-/Sollwert-Aenderungen sichern', 'SPS-Programm/Parametersaetze gegen Referenz vergleichen, Aenderungs-/Event-Logs sichern.', { name: 'PLC-Programm/Parameter', type: 'log', volatility: 'mittel', method: 'Engineering-Export' }),
        ev('wat-f-net', 'OT-Netzwerk-Capture', 'Passiv am SCADA-Netz mitschneiden (Modbus/S7/104) – fremde Master/Kommandos. (Tool: **OT-Netzwerk-Capture**).', { name: 'OT-Capture (pcap)', type: 'netzwerk', volatility: 'hoch', method: 'TAP/SPAN' })
      ] },
      { id: 'eindaemmung', title: 'Eindaemmung', steps: [
        s('wat-e-isolate', 'check', 'Fernzugriff/Exposition schliessen', 'Internet-exponierte PLC/HMI/Fernwartung kontrolliert isolieren; nur noetige Verbindungen.'),
        s('wat-e-restore', 'check', 'Sollwerte/Logik auf Soll', 'Manipulierte Sollwerte/Logik gegen signierte Referenz pruefen und nach Freigabe zuruecksetzen.', { showIf: { flag: 'health_risk' } })
      ] },
      { id: 'bereinigung', title: 'Bereinigung', steps: [
        s('wat-b-rebuild', 'check', 'Kompromittierte Rechner neu aufsetzen', 'HMI/Engineering-PC neu aufsetzen; Projekt/Firmware nur aus verifizierter Quelle.'),
        s('wat-b-fw', 'check', 'PLC-Integritaet pruefen', 'SPS-/Firmware-Integritaet gegen Hersteller pruefen.')
      ] },
      { id: 'wiederanlauf', title: 'Sicherer Wiederanlauf', steps: recoveryCommon('wat').concat([
        s('wat-w-quality', 'check', 'Freigabe nach Wasserqualitaet', 'Rueckkehr in Automatik erst nach bestaetigter Wasserqualitaet (Beprobung) und verifizierter Steuerung.')
      ]) },
      { id: 'ermittlung', title: 'Ermittlung / Analyse', steps: [
        s('wat-i-corr', 'check', 'Zugang & Wirkung rekonstruieren', 'Wie kam der Angreifer rein (Fernwartung/Internet), welche Sollwerte wann geaendert, Wirkung auf Qualitaet.'),
        s('wat-i-expo', 'check', 'Exposition pruefen', 'Shodan-aehnliche Exposition/Standardpasswoerter der Anlagen pruefen und schliessen.')
      ] },
      { id: 'abschluss', title: 'Abschluss', steps: closeout('wat') }
    ]
  };

  // ====================================================================== //
  //  FALL 9 – Cloud/M365 Tenant-Takeover (Global Admin)
  // ====================================================================== //
  var cloud = {
    id: 'cloud-m365-takeover',
    title: 'Cloud/M365 – Tenant-Uebernahme (Global Admin)',
    category: 'Cloud · Identitaet (M365/Entra)',
    severity: 'kritisch',
    oneLiner: 'Verdacht auf Uebernahme des M365/Entra-Tenants: neue Global Admins, OAuth-Consent, fremde Mailregeln/Exfiltration.',
    derivation:
      '**Symptom:** Privilegierte Aenderungen in der Cloud (neue Admins, App-Registrierungen, Federation), Datenabfluss aus SharePoint/Mail.\n' +
      '**Hypothesen:** Kompromittierter Admin (Phishing/AiTM), boesartige **OAuth-App** mit weitreichenden Rechten, Federation/Domain-Manipulation, Persistenz ueber Service Principals.\n' +
      '**Beguenstigt:** Token-Diebstahl, fehlendes Conditional Access/MFA.\n' +
      '**Beweis-Ableitung:** Entra-Audit + Sign-in-Logs, Unified Audit Log, OAuth-Grants/Service Principals, Rollenzuweisungen, Mailregeln/Exfil, neue Domains/Federation.',
    phases: [
      { id: 'triage', title: 'Identifikation & Sofortmassnahmen', steps: [
        s('cl-t-scope', 'input', 'Verdacht konkretisieren', 'Welche Aenderungen (neue Admins/Apps/Regeln), seit wann, welche Konten?', { field: { name: 'scope', label: 'Auffaellige Aenderungen / Zeit', kind: 'textarea' } }),
        s('cl-t-secure', 'check', 'Break-Glass-Konto sichern & nutzen', 'Notfall-(Break-Glass-)Global-Admin absichern (langes PW, FIDO2). Ueber dieses sauber arbeiten, nicht ueber verdaechtige Konten.'),
        s('cl-t-revoke', 'check', 'Sessions/Token der Admins widerrufen', 'Alle Sessions/Refresh-Token privilegierter Konten widerrufen; verdaechtige Admins sperren/PW-Reset + MFA neu.'),
        s('cl-t-oauth', 'choice', 'Boesartige OAuth-App / Service Principal?', 'Neue App-Registrierungen/Enterprise-Apps mit weitreichenden Graph-Rechten?', { options: [
          { label: 'Ja – App-Consent-Angriff', setFlag: { k: 'oauth_abuse', v: true } },
          { label: 'Nein / unklar', setFlag: { k: 'oauth_abuse', v: false } }
        ] })
      ] },
      { id: 'comms', title: 'Krisenkommunikation & Meldepflichten', steps: [
        commManagement('cl'),
        commLegalDSGVO('cl'),
        commPolice('cl'),
        s('cl-c-msp', 'comms', 'Microsoft/MSP & Stakeholder', 'Microsoft-Support/Provider einbinden; betroffene Bereiche informieren (kontrolliert).', { commsId: 'holding_statement' })
      ] },
      { id: 'forensik', title: 'Beweissicherung', steps: [
        ev('cl-f-audit', 'Entra-/Unified-Audit-Log sichern', 'Audit + Sign-in-Logs exportieren (Rollenaenderungen, App-Consent, Regeln). (Tool: **M365-Triage**).', { name: 'M365/Entra Audit-Logs', type: 'log', volatility: 'mittel', method: 'Audit-Export' }),
        ev('cl-f-oauth', 'OAuth-Grants & Service Principals', 'Enterprise-Apps/App-Registrierungen, delegierte/Application-Permissions, Geheimnisse/Zertifikate, Erstell-Datum.', { name: 'OAuth-Grants/Service Principals', type: 'log', volatility: 'mittel', method: 'Graph-Export' }),
        ev('cl-f-roles', 'Rollen- & Federation-Aenderungen', 'Privilegierte Rollenzuweisungen, neue Domains/Federation (Token-Faelschung), Partner-/Delegated-Admin.', { name: 'Rollen/Federation-Aenderungen', type: 'log', volatility: 'mittel', method: 'Export' }),
        ev('cl-f-exfil', 'Mailregeln & Exfil pruefen', 'Postfachregeln/Weiterleitungen, SharePoint/OneDrive-Massendownloads, eDiscovery-Missbrauch.', { name: 'Exfil-/Regel-Indikatoren', type: 'log', volatility: 'mittel', method: 'Audit-Analyse' })
      ] },
      { id: 'eindaemmung', title: 'Eindaemmung', steps: [
        s('cl-e-app', 'check', 'Boesartige App/SP entfernen', 'Nach Export verdaechtige Enterprise-Apps/Service Principals deaktivieren, Grants/Geheimnisse widerrufen.', { showIf: { flag: 'oauth_abuse' } }),
        s('cl-e-admins', 'check', 'Privilegierte Konten bereinigen', 'Fremde Global Admins entfernen, alle Admin-Credentials rotieren, Federation/Domains pruefen.'),
        s('cl-e-ca', 'check', 'Conditional Access verschaerfen', 'MFA erzwingen, Legacy-Auth blocken, Laender/Geraete-Policies, Admin-Login einschraenken.')
      ] },
      { id: 'bereinigung', title: 'Bereinigung', steps: [
        s('cl-b-persist', 'check', 'Cloud-Persistenz jagen', 'Service Principals mit Secrets, App-Rollen, Inbox-Rules, eDiscovery, neue Federation/Domains entfernen.'),
        s('cl-b-mfa', 'check', 'Phishing-resistente MFA', 'FIDO2/Passkeys fuer Admins, Break-Glass dokumentiert, Token-Schutz.')
      ] },
      { id: 'wiederanlauf', title: 'Sicherer Wiederanlauf', steps: recoveryCommon('cl') },
      { id: 'ermittlung', title: 'Ermittlung / Analyse', steps: [
        s('cl-i-impact', 'check', 'Datenabfluss bewerten', 'Welche Postfaecher/Sites/Daten abgeflossen? DSGVO-Meldung konkretisieren.'),
        s('cl-i-root', 'check', 'Erstzugang & Persistenz', 'Wie kam der Angreifer an Admin (Phishing/AiTM)? Alle Persistenzpfade ausgeschlossen?')
      ] },
      { id: 'abschluss', title: 'Abschluss', steps: closeout('cl') }
    ]
  };

  IR.playbooks = [bec, sub, rail, ransom, ad, solar, phish, water, cloud];

  // -------------------------------------------------------------------- //
  //  Erstbewertungs-Gate ("Vorfall oder Fehlalarm?") + Benign-Pfad.
  //  Nicht jeder Anruf ist ein Angriff. Das eigentliche Angriffs-Playbook
  //  wird erst sichtbar, wenn als bestaetigt/Verdacht eingestuft. Bei
  //  "kein Angriff" greift der De-Eskalations-/Dokumentationspfad.
  // -------------------------------------------------------------------- //
  var benignNotes = {
    'bec-iban': 'Vor "Betrug": pruefen, ob die IBAN-Aenderung **legitim** ist (echte Bankverbindungsaenderung des Lieferanten, telefonisch ueber bekannte Nummer bestaetigt) oder ein reiner Anzeige-/OCR-Fehler. Erst dann Betrugsfall.',
    'ot-umspannwerk': 'Moeglich **kein Cyber-Angriff**: reiner physischer Einbruch/Metalldiebstahl-Versuch ohne IT-Bezug; vermeintliche Relais-Auffaelligkeit = normale Schutzauesloesung, Wartung oder Fehlbedienung. Manipulation erst per Config-/Firmware-/Pruefsummen-Vergleich belegen.',
    'ot-stellwerk': 'Haeufige harmlose Ursachen: defekte/optische Maus auf reflektierender Flaeche, klemmende Taste, Funkmaus-Stoerung, Bildschirmschoner/Demo — vor allem eine **legitime, angekuendigte Fernwartungssitzung**. Erst legitime Remote-Session mit IT/Wartung ausschliessen, bevor ein RAT angenommen wird.',
    'ransomware': 'Selten benigne: grossflaechiger Storage-/Dateisystem-Defekt, Test/Uebung, fehlkonfigurierte Verschluesselungssoftware. Eine echte Ransom-Note + Verschluesselung bestaetigt i.d.R. den Angriff.',
    'ad-bruteforce': 'Sehr haeufiger Fehlalarm: ein **fehlkonfiguriertes Dienst-/Servicekonto** mit altem Passwort erzeugt Massen-Fehlversuche; der "Erfolg" ist die legitime Anmeldung nach Passwort-Reset. Quelle/IP/Logon-Typ pruefen, bevor Kompromittierung angenommen wird.',
    'supplychain-solar': 'Moeglich **kein Anlagen-Angriff**: Malware nur auf dem persoenlichen Techniker-Laptop ohne Anlagenkontakt; "C2 nach Russland" evtl. Fehlalarm (legitimer Dienst/CDN mit RU-Geolocation). Anlagenbezug erst ueber Verbindungs-/USB-/Engineering-Spuren belegen.',
    'phishing-wave': 'Pruefen, ob es echtes Phishing oder eine **erwartete/legitime** Mail bzw. eine **interne Phishing-Simulation** ist.',
    'ot-wasserwerk': 'Auffaellige Sollwerte koennen aus **normaler Regelung, Wartung oder Sensordrift** stammen. Erst Manipulation belegen, bevor ein Cyber-Incident ausgerufen wird – Wasserqualitaet aber vorsorglich sichern.',
    'cloud-m365-takeover': 'Aenderungen evtl. durch **legitimen Admin/MSP** oder eine genehmigte automatisierte App. Erst unautorisierte Aktivitaet (kein bekannter Urheber) belegen.'
  };
  // Erstbewertungs-Gate zentral aus framework.js anwenden + generisches Playbook anhaengen.
  IR.playbooks.forEach(function (pb) { IR.framework.applyGate(pb, benignNotes[pb.id]); });
  if (IR.genericPlaybook) IR.playbooks.push(IR.genericPlaybook);

  if (typeof module !== 'undefined' && module.exports) module.exports = IR.playbooks;
})(typeof window !== 'undefined' ? window : globalThis);
