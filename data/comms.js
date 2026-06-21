/* IR-Pilot – Krisenkommunikation: Vorlagen + Meldepflichten.
 * Platzhalter {{org}} {{date}} {{responder}} {{summary}} werden beim Einfuegen ersetzt.
 */
(function (root) {
  'use strict';
  var IR = root.IR || (root.IR = {});

  IR.comms = {
    mgmt_briefing: {
      audience: 'Geschaeftsleitung / Krisenstab', channel: 'muendlich + Kurznotiz',
      frist: 'sofort',
      subject: 'Sicherheitsvorfall – Lagebild {{date}}',
      body:
        'Lagebild zum Sicherheitsvorfall ({{org}}):\n\n' +
        '1) Was ist passiert: {{summary}}\n' +
        '2) Aktuelle Auswirkung: (Systeme/Prozesse/Versorgung)\n' +
        '3) Sofortmassnahmen: (laufend)\n' +
        '4) Naechste Schritte / Entscheidungsbedarf: \n' +
        '5) Externe Meldungen: (Behoerden/Polizei/Versicherung – siehe unten)\n\n' +
        'Krisenstab benannt. Single Point of Contact: {{responder}}. Keine Schuldzuweisungen, Fakten dokumentieren.'
    },
    holding_statement: {
      audience: 'Mitarbeiter / Kunden / Oeffentlichkeit', channel: 'abgestimmt',
      frist: 'nach Freigabe',
      subject: 'Information zu einer technischen Stoerung',
      body:
        'Wir haben eine technische Stoerung festgestellt und arbeiten mit Hochdruck und externen Fachleuten an der Loesung. ' +
        'Betroffene Prozesse: (…). Wir informieren, sobald belastbare Aussagen moeglich sind. ' +
        'Bitte richten Sie Rueckfragen an: (…). Stand: {{date}}.'
    },
    dsgvo_breach: {
      audience: 'Datenschutz-Aufsichtsbehoerde / DSB', channel: 'Meldeportal',
      frist: 'binnen 72 h ab Kenntnis (Art. 33 DSGVO)',
      subject: 'Meldung einer Verletzung des Schutzes personenbezogener Daten',
      body:
        'Verantwortlicher: {{org}}\nKenntnis seit: {{date}}\n' +
        'Art der Verletzung: (Vertraulichkeit/Integritaet/Verfuegbarkeit)\n' +
        'Kategorien & ungefaehre Zahl Betroffener / Datensaetze: \n' +
        'Wahrscheinliche Folgen: \nErgriffene/geplante Massnahmen: \n' +
        'Kontakt DSB: \n\nHinweis: Bei hohem Risiko zusaetzlich Betroffenenbenachrichtigung (Art. 34).'
    },
    police_report: {
      audience: 'Polizei – Zentrale Ansprechstelle Cybercrime (ZAC)', channel: 'Telefon/Anzeige',
      frist: 'zeitnah',
      subject: 'Strafanzeige Cybervorfall',
      body:
        'Geschaedigter: {{org}}\nSachverhalt: {{summary}}\nTatzeit(raum): \n' +
        'Gesicherte Asservate (Chain of Custody): siehe Beweisliste\n' +
        'Ansprechpartner vor Ort: {{responder}}\n\n' +
        'Bitte um Aktenzeichen. Beweise nicht veraendern, Originale sichern.'
    },
    bank_recall: {
      audience: 'Hausbank + Empfaengerbank', channel: 'Telefon + Schriftform',
      frist: 'sofort (Zeit kritisch)',
      subject: 'Betrugsverdacht – Bitte um SEPA-Recall / Kontosperre',
      body:
        'Wir sind Opfer einer Rechnungs-/IBAN-Manipulation. Bitte:\n' +
        '- Ueberweisung(en) vom (Datum/Betrag/Empfaenger-IBAN) zurueckrufen (SEPA-Recall),\n' +
        '- Empfaengerkonto als Betrugskonto melden/sperren,\n' +
        '- weitere Zahlungen an diese IBAN stoppen.\n' +
        'Geschaedigter: {{org}}, Kontakt: {{responder}}. Strafanzeige ist veranlasst.'
    },
    partner_warning: {
      audience: 'Kunden / Lieferanten', channel: 'Telefon (verifiziert!) + separater Kanal',
      frist: 'sofort',
      subject: 'Warnung: gefaelschte Bankverbindung auf Rechnungen',
      body:
        'Achtung: Auf an Sie versendeten Rechnungen koennte eine **falsche IBAN** stehen. ' +
        'Bitte zahlen Sie NICHT auf neue/geaenderte Bankverbindungen. Unsere korrekte IBAN lautet (…); ' +
        'bestaetigen Sie Aenderungen ausschliesslich telefonisch ueber (verifizierte Nummer). Stand: {{date}}.'
    },
    kritis_bsi: {
      audience: 'BSI (+ BNetzA, CERT)', channel: 'Meldewege KRITIS',
      frist: 'unverzueglich (§8b BSIG / sektorspezifisch)',
      subject: 'Meldung erheblicher IT-Sicherheitsvorfall (KRITIS)',
      body:
        'Betreiber: {{org}} (Sektor Energie)\nVorfall: {{summary}}\nZeitpunkt: {{date}}\n' +
        'Betroffene Anlagen/Funktionen: \nAuswirkung auf Versorgung: \n' +
        'Ergriffene Massnahmen: \nKontakt: {{responder}}\n\n' +
        'Zusaetzlich: Netzbetreiber/UeNB informieren, EnergieCERT/CERT-Bund einbinden.'
    },
    kritis_bahn: {
      audience: 'Eisenbahn-Bundesamt (EBA) + BSI', channel: 'Meldewege KRITIS Bahn',
      frist: 'unverzueglich',
      subject: 'Sicherheitsvorfall Bahninfrastruktur (KRITIS)',
      body:
        'Betreiber: {{org}}\nVorfall: {{summary}}\nBetroffene Stellwerke/Strecken: \n' +
        'Betriebliche Massnahme (Rueckfallebene): \nAuswirkung auf Bahnbetrieb/Sicherheit: \n' +
        'Kontakt: {{responder}}. Konzern-CERT/SOC eingebunden.'
    },
    ransomware_id: {
      audience: 'Intern / No More Ransom', channel: 'nomoreransom.org, ID-Ransomware',
      frist: 'vor Wiederherstellung',
      subject: 'Ransomware-Variante bestimmen / Decryptor pruefen',
      body:
        'Ransom-Note und verschluesselte Beispieldatei ueber nomoreransom.org / ID-Ransomware pruefen. ' +
        'Variante: (…). Decryptor verfuegbar? (ja/nein). KEINE Zahlung ohne Recht/Behoerden-Ruecksprache (Sanktionsrisiko).'
    },
    ot_warning: {
      audience: 'OT-/Anlagenverantwortliche', channel: 'direkt',
      frist: 'sofort',
      subject: 'IT-Kompromittierung mit moeglichem OT-Bezug',
      body:
        'Eine IT-Kompromittierung ({{summary}}) kann die Produktion/OT betreffen (Bruecke IT->OT). ' +
        'Bitte Anlagen ueberwachen, sicherheitsrelevante Funktionen pruefen, ungewoehnliche Befehle/Sollwerte melden. Kontakt: {{responder}}.'
    },
    health_authority: {
      audience: 'Gesundheitsamt (Trinkwasser)', channel: 'Telefon + schriftlich',
      frist: 'unverzueglich bei Qualitaetsgefahr',
      subject: 'Moegliche Beeintraechtigung der Trinkwasserqualitaet (Cybervorfall)',
      body:
        'Versorger: {{org}}\nSachverhalt: {{summary}} (Verdacht auf Manipulation der Aufbereitungssteuerung)\n' +
        'Betroffener Bereich/Versorgungsgebiet: \nGemessene/erwartete Auswirkung (Dosierung/Parameter): \n' +
        'Sofortmassnahmen: (Handbetrieb/Beprobung/ggf. Abkochgebot)\nKontakt: {{responder}}\n' +
        'Stand: {{date}}. Abstimmung Trinkwasserverordnung / weitere Schritte erbeten.'
    },
    supplier_forensics: {
      audience: 'Lieferant / Wartungsfirma', channel: 'schriftlich verbindlich',
      frist: 'sofort',
      subject: 'Forensische Sicherung Wartungslaptop + Lieferketten-Information',
      body:
        'Ihr Techniker war am (Datum) mit einem nachweislich mit Malware infizierten Laptop an unserer Anlage. Bitte:\n' +
        '- forensisches Image + RAM des Laptops unveraendert sichern,\n' +
        '- alle IOCs (Hashes/C2/Familie) und das Einsatzprotokoll uebermitteln,\n' +
        '- welche weiteren Anlagen mit diesem Geraet gewartet wurden,\n' +
        '- Stellungnahme zu Haftung/Massnahmen.\nKontakt: {{responder}} ({{org}}).'
    }
  };

  IR.fillTemplate = function (tpl, ctx) {
    ctx = ctx || {};
    return String(tpl).replace(/\{\{(\w+)\}\}/g, function (_, k) {
      return ctx[k] != null ? ctx[k] : '(' + k + ')';
    });
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = IR.comms;
})(typeof window !== 'undefined' ? window : globalThis);
