/* IR-Pilot – Katalog: Umgebungen (Unternehmens-/Anlagentypen), Impacts
 * (Kundensicht, ohne Technikbezug) und Cyber-Hypothesen (technischer Ansatz).
 * Daraus generiert framework.js ein massgeschneidertes Playbook.
 *
 * Tag-Vokabular (steuert Module/Tools/Meldewege):
 *   ot plc scada cnc       – Maschinen/Anlagensteuerung
 *   pos coldchain building – Kasse, Kuehlung, Gebaeudeautomation
 *   safety kritis          – Gefahr Mensch/Umwelt/Versorgung, kritische Infrastruktur
 *   ad cloud web payment    – Domaene, Cloud/M365, Web/Shop, Zahlung/Rechnung
 *   iot mobile network radio health
 */
(function (root) {
  'use strict';
  var IR = root.IR || (root.IR = {});

  // ---- Umgebungen ----  env(id, name, gruppe, tagsCSV)
  function E(id, name, group, tags) { return { id: id, name: name, group: group, tags: tags.split(' ').filter(Boolean) }; }
  IR.environments = [
    // Gastronomie / Lebensmittel
    E('restaurant', 'Restaurant / Gaststaette', 'Gastro', 'pos coldchain'),
    E('hotel', 'Hotel / Pension', 'Gastro', 'pos building web payment ad'),
    E('cafe_bakery', 'Baeckerei / Cafe', 'Gastro', 'pos coldchain ot'),
    E('catering', 'Catering / Grosskueche', 'Gastro', 'pos coldchain'),
    E('butcher', 'Metzgerei / Fleischerei', 'Lebensmittel', 'pos coldchain ot'),
    E('brewery', 'Brauerei', 'Lebensmittel', 'ot plc coldchain safety'),
    E('winery', 'Weingut / Kellerei', 'Lebensmittel', 'ot plc'),
    E('dairy', 'Molkerei', 'Lebensmittel', 'ot plc coldchain'),
    E('foodproc', 'Lebensmittelproduktion', 'Lebensmittel', 'ot plc coldchain safety'),
    E('bakery_chain', 'Baeckerei-Kette (mehrere Filialen)', 'Lebensmittel', 'pos coldchain ad ot'),
    // Handwerk
    E('carpentry', 'Schreinerei / Tischlerei', 'Handwerk', 'cnc ot'),
    E('sawmill', 'Saegewerk', 'Handwerk', 'ot plc safety'),
    E('metalwork', 'Metallbau / Schlosserei', 'Handwerk', 'cnc ot'),
    E('electrician', 'Elektrobetrieb', 'Handwerk', 'payment mobile'),
    E('plumber', 'Sanitaer / Heizung (SHK)', 'Handwerk', 'payment mobile'),
    E('painter', 'Maler / Lackierer', 'Handwerk', 'payment'),
    E('roofer', 'Dachdecker', 'Handwerk', 'payment'),
    E('autorepair', 'Kfz-Werkstatt', 'Handwerk', 'pos network'),
    E('printshop', 'Druckerei', 'Handwerk', 'ot cnc'),
    E('jeweler', 'Goldschmied / Juwelier', 'Handwerk', 'pos payment'),
    E('hairdresser', 'Friseur / Kosmetik', 'Handwerk', 'pos'),
    // Maschinenbau / Instandhaltung
    E('machine_builder', 'Maschinen-/Anlagenbauer', 'Industrie', 'cnc ot plc'),
    E('maintenance', 'Instandhaltung / Wartungsdienstleister', 'Industrie', 'ot mobile'),
    E('cnc_shop', 'CNC-Fertigung / Zerspanung', 'Industrie', 'cnc ot plc'),
    E('plastics', 'Kunststoff / Spritzguss', 'Industrie', 'ot plc safety'),
    E('packaging', 'Verpackungsbetrieb', 'Industrie', 'ot plc'),
    E('textile', 'Textilfertigung', 'Industrie', 'ot plc'),
    E('foundry', 'Giesserei', 'Industrie', 'ot plc safety'),
    E('pharma_mfg', 'Pharma- / Medizintechnik-Fertigung', 'Industrie', 'ot plc safety'),
    E('chemical_small', 'Chemiebetrieb (klein)', 'Industrie', 'ot plc safety kritis'),
    E('woodpellets', 'Pellet-/Holzwerk', 'Industrie', 'ot plc'),
    // Energie / Versorgung (KRITIS)
    E('solar_park', 'Solarpark / PV + Speicher', 'Energie', 'ot scada kritis'),
    E('wind_park', 'Windpark', 'Energie', 'ot scada kritis'),
    E('biogas', 'Biogasanlage', 'Energie', 'ot plc safety'),
    E('chp', 'BHKW / Heizkraftwerk', 'Energie', 'ot scada kritis safety'),
    E('substation', 'Umspannwerk', 'Energie', 'ot scada safety kritis'),
    E('districtheat', 'Fernwaerme', 'Energie', 'ot scada kritis'),
    E('gas_utility', 'Gasversorger (klein)', 'Energie', 'ot scada kritis safety'),
    E('waterworks', 'Wasserwerk', 'Wasser', 'ot scada safety kritis health'),
    E('wastewater', 'Klaeranlage', 'Wasser', 'ot plc kritis'),
    // Verkehr / Logistik
    E('rail_signal', 'Bahnstellwerk', 'Verkehr', 'ot safety kritis'),
    E('logistics', 'Spedition / Logistik', 'Verkehr', 'ad web iot'),
    E('warehouse', 'Lager / Hochregal', 'Verkehr', 'ot plc'),
    E('parking', 'Parkhaus-Betreiber', 'Verkehr', 'iot payment building'),
    E('charging', 'Ladepark E-Mobilitaet', 'Verkehr', 'ot iot payment'),
    // Gesundheit / Sozial
    E('clinic', 'Arztpraxis / MVZ', 'Gesundheit', 'ad payment health'),
    E('pharmacy', 'Apotheke', 'Gesundheit', 'pos coldchain payment health'),
    E('dentist', 'Zahnarztpraxis', 'Gesundheit', 'ad payment health'),
    E('carehome', 'Pflegeheim', 'Gesundheit', 'building ad health'),
    // Handel
    E('retail', 'Einzelhandel / Laden', 'Handel', 'pos payment'),
    E('supermarket', 'Supermarkt', 'Handel', 'pos coldchain ad'),
    E('ecommerce', 'Onlinehaendler / Shop', 'Handel', 'web cloud payment'),
    E('cardealer', 'Autohaus', 'Handel', 'pos ad payment'),
    // Landwirtschaft / Bau
    E('farm', 'Landwirtschaft / Hof', 'Agrar', 'iot ot'),
    E('greenhouse', 'Gaertnerei / Gewaechshaus', 'Agrar', 'ot building'),
    E('construction', 'Bauunternehmen', 'Bau', 'payment mobile'),
    E('quarry', 'Steinbruch / Kieswerk', 'Bau', 'ot plc safety'),
    // Oeffentlich / Gebaeude / IT
    E('fire_dept', 'Feuerwehr / Leitstelle', 'Oeffentlich', 'safety kritis radio network'),
    E('municipality', 'Kommune / Gemeindeverwaltung', 'Oeffentlich', 'ad web'),
    E('school', 'Schule / Bildungseinrichtung', 'Oeffentlich', 'ad web'),
    E('facility_mgmt', 'Gebaeudeautomation / Facility (GLT)', 'Gebaeude', 'building ot iot'),
    E('housing', 'Wohnungsgesellschaft', 'Gebaeude', 'building iot ad'),
    E('it_msp', 'IT-Dienstleister / MSP', 'IT', 'cloud ad network'),
    E('law_office', 'Kanzlei / Steuerberater', 'Buero', 'ad payment'),
    E('eng_office', 'Ingenieur- / Planungsbuero', 'Buero', 'ad cloud')
  ];

  // ---- Impacts (Kundensicht, ohne Technikbezug) ----
  // immediate: erste laienverstaendliche Sofortmassnahmen; hyp: Hypothesen-Gewichte
  function IM(id, name, tags, immediate, hyp) { return { id: id, name: name, tags: tags.split(' ').filter(Boolean), immediate: immediate, hyp: hyp }; }
  IR.impacts = [
    IM('encrypted', 'Alles gesperrt/verschluesselt – nichts geht mehr', 'data',
      ['Betroffene Geraete vom Netz trennen, aber NICHT ausschalten', 'Erpresserschreiben/Meldung fotografieren', 'Backups pruefen (vorhanden? getrennt?)'],
      { ransomware: 10, wiper: 4, benign_fault: 1 }),
    IM('money_fraud', 'Geld weg / falsche Bankdaten auf Rechnungen', 'payment',
      ['Zahlungen stoppen, Bank kontaktieren', 'Verdaechtige E-Mails/PDFs sichern (nicht loeschen)'],
      { bec: 10, endpoint_malware: 4, phishing: 3, exfil: 2 }),
    IM('machine_weird', 'Maschine/Anlage verhaelt sich seltsam / falsche Werte', 'ot',
      ['Anlagenverantwortlichen/Betrieb einbinden', 'Auf sichere Betriebsart/Handbetrieb pruefen', 'Nichts voreilig schalten'],
      { ot_manipulation: 10, rat: 5, benign_misconfig: 4, benign_fault: 3 }),
    IM('pos_down', 'Kasse / Abrechnung funktioniert nicht', 'pos',
      ['Notbetrieb (Bar/Beleg) organisieren', 'Kassensystem isolieren'],
      { ransomware: 5, endpoint_malware: 4, benign_fault: 4, ddos: 2 }),
    IM('data_gone', 'Daten weg oder gestohlen / Kundendaten betroffen', 'data',
      ['Umfang grob erfassen', 'Beweise sichern, nichts ueberschreiben'],
      { exfil: 8, ransomware: 5, insider: 5, cloud_takeover: 4 }),
    IM('extorted', 'Wir werden erpresst / Drohung', 'data',
      ['Nicht vorschnell zahlen/antworten', 'Erpressernachricht + Kanal sichern', 'Polizei vorbereiten'],
      { ransomware: 7, exfil: 7, extortion_only: 5 }),
    IM('login_locked', 'Logins gehen nicht / Konten uebernommen', 'identity',
      ['Betroffene Konten sperren/Passwort+MFA zuruecksetzen', 'Sessions/Token invalidieren'],
      { identity_ad: 8, phishing: 7, cloud_takeover: 6, brute_force: 5 }),
    IM('web_down', 'Webseite / Shop down oder veraendert', 'web',
      ['Hoster/Provider einbinden', 'Inhalte/Logs sichern, nichts ueberschreiben'],
      { webshell: 7, ddos: 7, cloud_takeover: 3, benign_fault: 3 }),
    IM('building_weird', 'Heizung/Kuehlung/Tueren/Gebaeude spinnt', 'building',
      ['Facility/Haustechnik einbinden', 'Auf manuelle Steuerung/Sicherheit pruefen'],
      { ot_manipulation: 7, rat: 5, benign_misconfig: 5, benign_fault: 4 }),
    IM('comms_down', 'Telefon/Internet/E-Mail tot', 'availability',
      ['Provider/Carrier pruefen', 'Ist nur extern oder auch intern betroffen?'],
      { ddos: 6, benign_fault: 6, ransomware: 3, identity_ad: 2 }),
    IM('remote_seen', 'Jemand greift fern zu / Bildschirm bewegt sich', 'identity',
      ['Beobachten/protokollieren, NICHT sofort Netz ziehen (fluechtige Beweise)', 'Legitime Fernwartung ausschliessen'],
      { rat: 10, benign_misconfig: 4, identity_ad: 3 }),
    IM('alert_only', 'Warnmeldung (Virenschutz/IDS/Lieferant) ohne sichtbaren Schaden', 'alert',
      ['Meldung/Quelle dokumentieren', 'Betroffenes Geraet identifizieren/isolieren (falls bestaetigt)'],
      { endpoint_malware: 6, supplychain: 6, phishing: 4, benign_misconfig: 4, benign_fault: 3 }),
    IM('safety_event', 'Sicherheitsvorfall mit Gefahr fuer Mensch/Umwelt/Versorgung', 'safety',
      ['LEBEN/SICHERHEIT zuerst: Betrieb in sicheren Zustand, Verantwortliche/Behoerden', 'Erst danach digitale Spuren'],
      { ot_manipulation: 8, rat: 5, benign_fault: 4, insider: 3 })
  ];

  // ---- Cyber-Hypothesen (technischer Ansatz) ----
  // forensic: {name,type,volatility}; tools: toolIds; comms: commsIds;
  // contain/eradicate: Schritt-Texte; envTags: bevorzugte Umgebungen; benign: bool
  function H(o) { return o; }
  IR.hypotheses = [
    H({ id: 'ransomware', name: 'Ransomware / Verschluesselung', tech: 'Massenverschluesselung nach Erstzugang, evtl. Datendiebstahl (Double Extortion).',
      tools: ['Windows-Triage', 'Memory-Acquisition', 'Velociraptor-Offline'], comms: ['police_report', 'ransomware_id', 'dsgvo_breach'],
      forensic: [{ name: 'Ransom-Note + verschluesselte Samples', type: 'datei', volatility: 'niedrig' }, { name: 'RAM Patient Zero', type: 'memory', volatility: 'hoch' }, { name: 'Endpoint-Triage', type: 'datei', volatility: 'hoch' }, { name: 'AD/VPN/Firewall-Logs', type: 'log', volatility: 'mittel' }],
      contain: ['Betroffene Systeme isolieren (nicht ausschalten)', 'Netz segmentieren, OT von IT trennen', 'Privilegierte Konten sperren/zuruecksetzen (KRBTGT)'],
      eradicate: ['Neu aufsetzen statt entschluesseln-und-weiter', 'Erstzugang schliessen (RDP/VPN/Phishing/Exploit)'], envTags: [] }),
    H({ id: 'bec', name: 'BEC / Mailbox-Kompromittierung (Rechnungsbetrug)', tech: 'Postfach kompromittiert, Regeln/Weiterleitungen, Anhang-/IBAN-Manipulation.',
      tools: ['M365-Triage', 'Mail-Header', 'CyberChef'], comms: ['bank_recall', 'partner_warning', 'police_report', 'dsgvo_breach'],
      forensic: [{ name: 'Verdaechtige E-Mails + Header', type: 'datei', volatility: 'mittel' }, { name: 'Postfach-Audit + Regeln/Weiterleitungen', type: 'log', volatility: 'mittel' }, { name: 'PDF-Diff gesendet/zugestellt', type: 'datei', volatility: 'niedrig' }],
      contain: ['Konten sichern: Passwort+MFA, Sessions/Token invalidieren', 'Boesartige Regeln/Weiterleitungen entfernen (nach Export)', 'IOCs blockieren (IBAN/Absender/Domains)'],
      eradicate: ['Mailflow haerten (SPF/DKIM/DMARC)', '4-Augen-Prinzip fuer Bankdaten/Zahlungen'], envTags: ['payment'] }),
    H({ id: 'endpoint_malware', name: 'Endpoint-Malware / Trojaner', tech: 'Schadsoftware auf Arbeitsplatz/Server (Loader/Stealer/RAT-Vorstufe).',
      tools: ['Windows-Triage', 'Memory-Acquisition', 'CyberChef'], comms: ['police_report'],
      forensic: [{ name: 'RAM des Hosts', type: 'memory', volatility: 'hoch' }, { name: 'Endpoint-Triage (Autostarts/Prozesse/Netz)', type: 'datei', volatility: 'hoch' }, { name: 'EDR-/AV-Alarme', type: 'log', volatility: 'mittel' }],
      contain: ['Host isolieren (nicht ausschalten)', 'IOCs (Hash/C2) blockieren', 'Verbreitung pruefen'],
      eradicate: ['Host neu aufsetzen', 'Erstinfektion (Makro/Download/USB) abstellen'], envTags: [] }),
    H({ id: 'identity_ad', name: 'Identitaets-/AD-Kompromittierung', tech: 'Privilegierter Account/AD uebernommen (Golden Ticket/DCSync-Risiko).',
      tools: ['AD-Triage', 'Windows-Triage'], comms: ['police_report', 'ot_warning', 'dsgvo_breach'],
      forensic: [{ name: 'DC-Security-Logs (4624/4625/4768/4769/4672)', type: 'log', volatility: 'mittel' }, { name: 'Quell-Host RAM+Triage', type: 'memory', volatility: 'hoch' }, { name: 'AD-Aenderungen (Konten/Gruppen/GPO)', type: 'log', volatility: 'mittel' }],
      contain: ['Kompromittierte Konten sperren/zuruecksetzen', 'KRBTGT 2x zuruecksetzen', 'Tier-0 (DCs/PKI) schuetzen'],
      eradicate: ['Persistenz jagen (AdminSDHolder/GPO/AD CS)', 'Tiering + MFA/PAW einfuehren'], envTags: ['ad'] }),
    H({ id: 'phishing', name: 'Phishing / Credential-Diebstahl', tech: 'Zugangsdaten/Token abgegriffen (evtl. AiTM trotz MFA).',
      tools: ['Mail-Header', 'M365-Triage', 'CyberChef'], comms: ['holding_statement', 'dsgvo_breach', 'police_report'],
      forensic: [{ name: 'Phishing-Mail + URL/Payload', type: 'datei', volatility: 'mittel' }, { name: 'Sign-in-/MFA-Logs', type: 'log', volatility: 'mittel' }, { name: 'Postfachregeln', type: 'log', volatility: 'mittel' }],
      contain: ['Betroffene Konten zuruecksetzen, Sessions/Token widerrufen', 'IOCs blocken', 'Intern verteilte Mails jagen'],
      eradicate: ['Phishing-resistente MFA (FIDO2)', 'Conditional Access/DMARC haerten'], envTags: [] }),
    H({ id: 'ot_manipulation', name: 'OT/ICS-Manipulation (PLC/SCADA)', tech: 'Manipulierte Sollwerte/Logik/Firmware an Steuerung/Schutzgeraeten.',
      tools: ['OT-Netzwerk-Capture', 'Windows-Triage', 'Memory-Acquisition'], comms: ['kritis_bsi', 'ot_warning', 'police_report'],
      forensic: [{ name: 'HMI/Engineering-PC RAM+Image', type: 'image', volatility: 'hoch' }, { name: 'PLC/Relais-Parameter + Pruefsumme vs. Soll', type: 'log', volatility: 'mittel' }, { name: 'OT-Netzwerk-Capture (pcap)', type: 'netzwerk', volatility: 'hoch' }],
      contain: ['Sicherheit/Versorgung zuerst, mit Betrieb abstimmen', 'Fernzugaenge zur Anlage schliessen', 'Sollwerte/Logik gegen signierte Referenz pruefen'],
      eradicate: ['Steuerrechner neu aufsetzen, Firmware/Konfig verifizieren', 'Schutz-/Funktionstest vor Freigabe'], envTags: ['ot', 'plc', 'scada'] }),
    H({ id: 'rat', name: 'Aktiver Fernzugriff / RAT', tech: 'Live-Fernsteuerung (RAT oder missbrauchte Fernwartung).',
      tools: ['OT-Netzwerk-Capture', 'Memory-Acquisition', 'Windows-Triage'], comms: ['police_report'],
      forensic: [{ name: 'Bildschirm-Foto/Video der Live-Session', type: 'foto', volatility: 'hoch' }, { name: 'RAM des Hosts', type: 'memory', volatility: 'hoch' }, { name: 'Netzwerk-Capture C2', type: 'netzwerk', volatility: 'hoch' }],
      contain: ['Fluechtige Beweise zuerst, dann Fernzugang kappen', 'Genutzten Sprung-/Fernwartungspunkt sperren', 'Ausbreitung pruefen'],
      eradicate: ['Host neu aufsetzen', 'Fernwartung haerten (MFA/Monitoring, keine Sammelkonten)'], envTags: [] }),
    H({ id: 'supplychain', name: 'Supply-Chain / Drittpartei', tech: 'Kompromittierung ueber Lieferant/Wartung/Update/Fremdgeraet.',
      tools: ['Windows-Triage', 'OT-Netzwerk-Capture', 'Velociraptor-Offline'], comms: ['supplier_forensics', 'kritis_bsi', 'police_report'],
      forensic: [{ name: 'Fremdgeraet/Update-Artefakt (ueber Lieferant)', type: 'image', volatility: 'hoch' }, { name: 'Beruehrte Systeme Triage', type: 'datei', volatility: 'hoch' }, { name: 'Netzwerk-Capture (C2)', type: 'netzwerk', volatility: 'hoch' }],
      contain: ['IOCs des Lieferanten blockieren', 'Betroffene Kopplung/Geraet isolieren', 'Lieferketten-Breite klaeren'],
      eradicate: ['Betroffene Systeme neu aufsetzen', 'Fremdgeraete-/Update-Policy verschaerfen'], envTags: ['ot', 'mobile'] }),
    H({ id: 'ddos', name: 'DDoS / Verfuegbarkeitsangriff', tech: 'Ueberlastung von Web/Netz/Diensten.',
      tools: ['OT-Netzwerk-Capture'], comms: ['holding_statement'],
      forensic: [{ name: 'Netz-/Firewall-/LB-Logs', type: 'log', volatility: 'mittel' }, { name: 'Traffic-Capture', type: 'netzwerk', volatility: 'hoch' }],
      contain: ['Upstream/ISP/CDN-Schutz aktivieren (Scrubbing)', 'Rate-Limiting/Geo-/Filter', 'Nicht betroffene Dienste schuetzen'],
      eradicate: ['DDoS-Schutz dauerhaft, Kapazitaet/Failover', 'Restpersistenz ausschliessen (Tarn-DDoS?)'], envTags: ['web'] }),
    H({ id: 'webshell', name: 'Webshell / Defacement / Server-Kompromittierung', tech: 'Web-Server uebernommen (Webshell/Exploit), Inhalte veraendert.',
      tools: ['Linux-Triage', 'CyberChef', 'Timeline'], comms: ['holding_statement', 'dsgvo_breach', 'police_report'],
      forensic: [{ name: 'Webserver-Logs (Access/Error)', type: 'log', volatility: 'mittel' }, { name: 'Webroot/Webshell-Dateien + Zeitstempel', type: 'datei', volatility: 'mittel' }, { name: 'Server-Triage (Prozesse/Cron/Netz)', type: 'datei', volatility: 'hoch' }],
      contain: ['Server isolieren / offline nehmen', 'Webshell sichern, dann entfernen', 'Zugaenge/Keys rotieren'],
      eradicate: ['Aus sauberem Stand neu aufbauen, CMS/Plugins patchen', 'WAF/Hardening, Datei-Integritaet'], envTags: ['web'] }),
    H({ id: 'insider', name: 'Insider / Sabotage', tech: 'Boeswillige/fahrlaessige interne Handlung (Daten/Manipulation).',
      tools: ['Windows-Triage', 'AD-Triage', 'Timeline'], comms: ['police_report', 'dsgvo_breach'],
      forensic: [{ name: 'Zugriffs-/Audit-Logs (wer/wann/was)', type: 'log', volatility: 'mittel' }, { name: 'Endpoint des Verdaechtigen (mit HR/Recht!)', type: 'datei', volatility: 'hoch' }, { name: 'USB-/Datenabfluss-Spuren', type: 'log', volatility: 'mittel' }],
      contain: ['Zugriffe des Verdaechtigen einschraenken (mit HR/Recht)', 'Beweise sichern (Vertraulichkeit!)'],
      eradicate: ['Rechte/Need-to-know bereinigen', 'Vier-Augen/Trennung kritischer Funktionen'], envTags: [] }),
    H({ id: 'exfil', name: 'Datenexfiltration / Breach', tech: 'Abfluss von Unternehmens-/Kundendaten.',
      tools: ['Windows-Triage', 'OT-Netzwerk-Capture', 'Timeline'], comms: ['dsgvo_breach', 'police_report', 'holding_statement'],
      forensic: [{ name: 'Proxy/Firewall/DNS-Logs (Uploads/Ziele)', type: 'log', volatility: 'mittel' }, { name: 'Tool-Spuren (rclone/mega/7z)', type: 'datei', volatility: 'hoch' }, { name: 'Betroffene Datenbestaende', type: 'datei', volatility: 'niedrig' }],
      contain: ['Abflusskanal blocken (Ziele/Tools)', 'Zugaenge rotieren'],
      eradicate: ['DLP/Egress-Kontrolle', 'Datenklassifizierung/Need-to-know'], envTags: [] }),
    H({ id: 'cloud_takeover', name: 'Cloud / M365-Takeover', tech: 'Tenant/Admin uebernommen, OAuth-Consent, Federation, Exfil.',
      tools: ['M365-Triage', 'CyberChef'], comms: ['dsgvo_breach', 'police_report', 'holding_statement'],
      forensic: [{ name: 'Entra-/Unified-Audit + Sign-in', type: 'log', volatility: 'mittel' }, { name: 'OAuth-Grants/Service Principals', type: 'log', volatility: 'mittel' }, { name: 'Rollen-/Federation-Aenderungen', type: 'log', volatility: 'mittel' }],
      contain: ['Sessions/Token der Admins widerrufen, Break-Glass sichern', 'Boesartige App/SP entfernen', 'Conditional Access/MFA verschaerfen'],
      eradicate: ['Cloud-Persistenz jagen (SP-Secrets/Federation)', 'Phishing-resistente MFA fuer Admins'], envTags: ['cloud'] }),
    H({ id: 'wiper', name: 'Wiper / Zerstoerung', tech: 'Daten/Systeme werden zerstoert (keine Entschluesselung moeglich).',
      tools: ['Windows-Triage', 'Memory-Acquisition'], comms: ['police_report', 'kritis_bsi', 'dsgvo_breach'],
      forensic: [{ name: 'RAM + Triage betroffener Systeme', type: 'memory', volatility: 'hoch' }, { name: 'Malware-Sample/Spuren', type: 'datei', volatility: 'hoch' }, { name: 'Zentrale Logs', type: 'log', volatility: 'mittel' }],
      contain: ['Sofort isolieren, Ausbreitung stoppen', 'Backups schuetzen (Ziel von Wipern!)'],
      eradicate: ['Aus sauberen Backups neu aufbauen', 'Erstzugang schliessen, Persistenz entfernen'], envTags: [] }),
    H({ id: 'brute_force', name: 'Brute-Force / Password-Spray', tech: 'Masse fehlgeschlagener Logins, ggf. Erfolg.',
      tools: ['AD-Triage', 'M365-Triage'], comms: ['police_report'],
      forensic: [{ name: 'Auth-Logs (Quelle/IP/Erfolg)', type: 'log', volatility: 'mittel' }, { name: 'Betroffenes Konto/Host', type: 'datei', volatility: 'hoch' }],
      contain: ['Quelle blocken, Lockout/Smart-Lockout', 'Bei Erfolg Konto sperren/zuruecksetzen'],
      eradicate: ['MFA, exponierte Auth (RDP/VPN/OWA) absichern', 'Dienstkonten-Hygiene'], envTags: ['ad'] }),
    H({ id: 'extortion_only', name: 'Reine Erpressung / Drohung (ohne Verschluesselung)', tech: 'Drohung mit Veroeffentlichung/Angriff, evtl. Bluff.',
      tools: ['Mail-Header', 'CyberChef'], comms: ['police_report', 'dsgvo_breach', 'holding_statement'],
      forensic: [{ name: 'Erpressernachricht + Kanal/Header', type: 'datei', volatility: 'mittel' }, { name: 'Belege fuer behaupteten Zugriff/Abfluss', type: 'log', volatility: 'mittel' }],
      contain: ['Nicht vorschnell zahlen/antworten', 'Behauptung verifizieren (echter Abfluss?)'],
      eradicate: ['Falls real: wie Exfil/Breach behandeln', 'Falls Bluff: dokumentieren, Monitoring'], envTags: [] }),
    // --- Benigne Hypothesen (kein Cyber-Angriff) ---
    H({ id: 'benign_physical', name: 'Kein Cyber: physisch / Diebstahl', tech: 'Physischer Einbruch/Diebstahl/Vandalismus ohne IT-Manipulation.', benign: true,
      tools: [], comms: ['police_report'],
      forensic: [{ name: 'Fotodokumentation / Spuren', type: 'foto', volatility: 'niedrig' }, { name: 'Zutritts-/Videologs', type: 'log', volatility: 'mittel' }],
      contain: ['Tatort sichern (Polizei)', 'Pruefen, ob doch IT/OT beruehrt wurde'],
      eradicate: ['Physische Sicherung verbessern'], envTags: [] }),
    H({ id: 'benign_misconfig', name: 'Kein Cyber: Fehlkonfiguration / Bedienfehler', tech: 'Fehlkonfig/Update/Bedienfehler erklaert das Symptom.', benign: true,
      tools: ['Timeline'], comms: [],
      forensic: [{ name: 'Aenderungs-/Update-Historie', type: 'log', volatility: 'mittel' }, { name: 'Konfig vs. Soll', type: 'log', volatility: 'niedrig' }],
      contain: ['Letzte Aenderung pruefen/zuruecknehmen'],
      eradicate: ['Change-Management/Tests, Bedien-Doku'], envTags: [] }),
    H({ id: 'benign_fault', name: 'Kein Cyber: Hardware-/Netz-/Stromausfall', tech: 'Technischer Defekt/Ausfall ohne Angriff.', benign: true,
      tools: [], comms: [],
      forensic: [{ name: 'System-/Hardware-Logs (SMART/Ereignis)', type: 'log', volatility: 'mittel' }],
      contain: ['Defektes Teil/Strecke identifizieren'],
      eradicate: ['Reparatur/Redundanz/USV'], envTags: [] })
  ];

  IR.catalog = {
    env: function (id) { return IR.environments.filter(function (e) { return e.id === id; })[0]; },
    impact: function (id) { return IR.impacts.filter(function (e) { return e.id === id; })[0]; },
    hyp: function (id) { return IR.hypotheses.filter(function (e) { return e.id === id; })[0]; },
    groups: function () { var g = {}; IR.environments.forEach(function (e) { (g[e.group] = g[e.group] || []).push(e); }); return g; }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = IR.catalog;
})(typeof window !== 'undefined' ? window : globalThis);
