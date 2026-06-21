/* IR-Pilot – Geführtes Tabletop (Krisenstabs-/Techniker-Übung).
 * Der Übungsleiter waehlt Zielgruppe + Szenario, spielt Injects durch und
 * bewertet die Reaktionen. Ergebnis: IR-Plan + Manoeverkritik + technische
 * Verbesserungen (als PDF). Baut auf den vorhandenen Szenarien/Playbooks auf.
 */
(function (root) {
  'use strict';
  var IR = root.IR || (root.IR = {});
  var U = IR.util;

  var RATINGS = [
    { v: 0, label: 'nicht behandelt', cls: 'r0' },
    { v: 1, label: 'lückenhaft', cls: 'r1' },
    { v: 2, label: 'solide', cls: 'r2' },
    { v: 3, label: 'exzellent', cls: 'r3' }
  ];

  // Inject-Bibliothek. audience: 'mgmt' | 'tech' | 'both'.
  // scenarioTags (optional): nur einblenden, wenn das Szenario passt (sonst immer).
  var INJECTS = [
    { id: 'first-alert', phase: 'Erkennung', audience: 'both', title: 'Erste Meldung',
      situation: 'Die erste Meldung trifft ein: {oneLiner} Die Lage ist unklar, die Uhr läuft.',
      prompts: ['Wer wird in den ersten 15 Minuten informiert (Meldekette)?', 'Wie verifiziert ihr, ob es ein echter Vorfall ist?', 'Welche Sofortmaßnahme – ohne Beweise zu zerstören?'],
      good: ['Definierte Erstmelde-/Eskalationskette (24/7)', 'Verifikation vor Aktion', 'Isolieren statt ausschalten'],
      improvement: 'Erstmelde- und Eskalationskette mit 24/7-Erreichbarkeit dokumentieren und üben.' },

    { id: 'crisis-team', phase: 'Organisation', audience: 'mgmt', title: 'Krisenstab',
      situation: 'Die Lage eskaliert. Es ist Führung nötig.',
      prompts: ['Wer beruft den Krisenstab ein, wer leitet ihn?', 'Welche Rollen sitzen am Tisch (GF, Recht, Kommunikation, IT/OT, DSB)?', 'Wer vertritt wen bei Ausfall/Urlaub?'],
      good: ['Klare Krisenstab-Geschäftsordnung', 'Benannte Rollen + Stellvertreter', 'Entscheidungsbefugnisse definiert'],
      improvement: 'Krisenstab-Geschäftsordnung mit Rollen, Stellvertretern und Entscheidungsbefugnissen festlegen.' },

    { id: 'classification', phase: 'Bewertung', audience: 'both', title: 'Vorfall oder Fehlalarm?',
      situation: 'Erste Daten sind da, aber widersprüchlich. Eine Einstufung ist nötig.',
      prompts: ['Wer entscheidet die Einstufung – und auf welcher Basis?', 'Welche Kriterien unterscheiden Vorfall von Fehlalarm?', 'Wie wird die Entscheidung dokumentiert?'],
      good: ['Definierte Einstufungs-/Schweregrad-Kriterien', 'Dokumentierte Entscheidung', 'De-Eskalations-Pfad bei Fehlalarm'],
      improvement: 'Einstufungs- und Schweregrad-Kriterien (inkl. De-Eskalation) definieren.' },

    { id: 'evidence-first', phase: 'Forensik', audience: 'tech', title: 'Beweise zuerst',
      situation: 'Ein Mitarbeiter hat das verdächtige System bereits heruntergefahren bzw. neu gestartet.',
      prompts: ['Wie bewertet ihr den Beweisverlust?', 'Was lässt sich vom Restzustand noch sichern?', 'Order of Volatility – was zuerst?'],
      good: ['Beweisverlust bewerten/dokumentieren', 'Order of Volatility (RAM vor Disk)', 'Hash + Chain of Custody'],
      improvement: 'First-Responder-Karten verteilen: nicht ausschalten, isolieren, Beweise nach Volatilität sichern.' },

    { id: 'forensics-order', phase: 'Forensik', audience: 'tech', title: 'Beweissicherung',
      situation: 'Das betroffene System läuft noch. Ihr müsst Beweise sichern.',
      prompts: ['Sichert ihr zuerst RAM oder Disk – und womit?', 'Wie stellt ihr Integrität sicher (Hash, Write-Blocker)?', 'Wo lagert ihr Asservate, wer hat Zugriff?'],
      good: ['RAM zuerst, dann Image', 'SHA256 + Chain of Custody', 'Read-only / Write-Blocker'],
      improvement: 'Forensik-Kit + Acquisition-Runbook (RAM/Disk, Hashing, CoC) bereitstellen und schulen.' },

    { id: 'containment', phase: 'Eindämmung', audience: 'both', title: 'Ausbreitung stoppen',
      situation: 'Der Vorfall breitet sich aus – weitere Systeme bzw. die OT-/Produktionsumgebung sind bedroht.',
      prompts: ['Wie dämmt ihr ein, ohne alles lahmzulegen?', 'Wer autorisiert einen Produktions-/Netz-Stopp (Mgmt) bzw. wie segmentiert ihr gezielt (Tech)?', 'Welche Abhängigkeiten beachtet ihr (OT/Safety)?'],
      good: ['Gezielte Segmentierung statt Total-Abschaltung', 'Klare Autorisierung für Stopp', 'OT/Safety-Abhängigkeiten bedacht'],
      improvement: 'Netzsegmentierung + Notfall-Isolationsplan (mit Autorisierungsweg) als Playbook erstellen.' },

    { id: 'exfil', phase: 'Forensik', audience: 'tech', title: 'Datenabfluss?',
      situation: 'Es gibt Hinweise auf Datenexfiltration nach außen.',
      prompts: ['Wie bestätigt oder widerlegt ihr den Abfluss?', 'Welche Logs braucht ihr (Proxy, DNS, NetFlow, Firewall)?', 'Was bedeutet das für Meldepflichten?'],
      good: ['Egress-/Proxy-/DNS-Logs ausgewertet', 'Volumen + Ziel-IPs bewertet', 'Konsequenz für DSGVO erkannt'],
      improvement: 'Egress-Logging/NetFlow + DLP verbessern, Aufbewahrung sicherstellen.' },

    { id: 'media', phase: 'Kommunikation', audience: 'mgmt', title: 'Öffentlichkeit & Presse',
      situation: 'Ein Kunde postet öffentlich über die Störung, ein Journalist ruft an.',
      prompts: ['Wer spricht – eine Stimme nach außen?', 'Was ist eure Kernbotschaft (Holding Statement)?', 'Wie informiert ihr Kunden/Partner proaktiv?'],
      good: ['Vorbereitetes Holding-Statement', 'Eine Sprecherregelung', 'Proaktive, abgestimmte Kundeninfo'],
      improvement: 'Krisenkommunikations-Vorlagen + Sprecherregelung vorbereiten.' },

    { id: 'legal-report', phase: 'Meldepflichten', audience: 'mgmt', title: 'Melde­pflichten & Fristen',
      situation: 'Es sind personenbezogene Daten betroffen. Die 72-Stunden-Frist (DSGVO) läuft.',
      prompts: ['Wer meldet an die Aufsichtsbehörde – und ab wann läuft die Frist?', 'Welche weiteren Pflichten greifen (BSI/KRITIS, BaFin/BNetzA, Versicherung)?', 'Wann/ob Polizei/ZAC einschalten?'],
      good: ['72h-Frist + Verantwortlicher klar', 'Meldepflichten-Matrix genutzt', 'Versicherung früh eingebunden'],
      improvement: 'Meldepflichten-Matrix (DSGVO, BSI/KRITIS, Branche, Versicherung) mit Fristen + Verantwortlichen pflegen.' },

    { id: 'ransom', phase: 'Entscheidung', audience: 'mgmt', title: 'Lösegeldforderung', scenarioTags: ['ransom'],
      situation: 'Eine Lösegeldforderung trifft ein (z. B. 500.000 €), mit Frist.',
      prompts: ['Zahlt ihr – wer entscheidet das?', 'Welche Rollen sind eingebunden (Recht, Versicherung, Polizei, Verhandler)?', 'Welche rechtlichen/sanktionsrechtlichen Risiken seht ihr?'],
      good: ['Klare Entscheidungsrichtlinie', 'Recht/Versicherung/Polizei eingebunden', 'Sanktionsprüfung bedacht'],
      improvement: 'Ransom-Entscheidungsrichtlinie + Cyber-Versicherung/Verhandler-Kontakt klären.' },

    { id: 'business-continuity', phase: 'Notbetrieb', audience: 'mgmt', title: 'Geschäftsbetrieb',
      situation: 'Kernprozesse stehen still. Kunden und Lieferanten sind betroffen.',
      prompts: ['Gibt es einen Notbetrieb – welche Prozesse zuerst?', 'Was sind RTO/RPO für die wichtigsten Prozesse?', 'Wie haltet ihr Lieferanten/Kunden handlungsfähig?'],
      good: ['Priorisierte Kernprozesse (BIA)', 'RTO/RPO bekannt', 'Notbetrieb-Optionen vorbereitet'],
      improvement: 'BCM/Notfallpläne je Kernprozess mit RTO/RPO und Notbetriebs-Optionen erstellen.' },

    { id: 'eradication', phase: 'Bereinigung', audience: 'tech', title: 'Angreifer raus?',
      situation: 'Vor dem Wiederanlauf muss sichergestellt sein, dass der Angreifer keinen Zugriff mehr hat.',
      prompts: ['Wie stellt ihr sicher, dass keine Persistenz mehr besteht?', 'IOC-Sweep, Passwort-Reset, Re-Image – was, in welcher Reihenfolge?', 'Wie verhindert ihr Re-Infektion?'],
      good: ['IOC-Sweep + Persistenz-Prüfung', 'Credentials flächendeckend erneuert', 'Neu aufsetzen statt „säubern und weiter"'],
      improvement: 'Threat-Hunting/IOC-Sweep-Prozess + saubere Re-Image-Strategie etablieren.' },

    { id: 'logging-gaps', phase: 'Forensik', audience: 'tech', title: 'Logs vorhanden?',
      situation: 'Forensik/Behörde fragt nach Logs der letzten 30–90 Tage.',
      prompts: ['Habt ihr die Logs – zentral und vollständig?', 'Wie lange werden sie aufbewahrt?', 'Welche Lücken fallen jetzt auf?'],
      good: ['Zentrales Logging (SIEM)', 'Aufbewahrung 90+ Tage', 'Abdeckung kritischer Quellen'],
      improvement: 'Zentrales Logging (SIEM) + Aufbewahrung 90+ Tage für kritische Quellen einführen.' },

    { id: 'recovery-clean', phase: 'Wiederanlauf', audience: 'both', title: 'Sauberer Wiederanlauf',
      situation: 'Es soll wieder hochgefahren werden. Druck vom Geschäft ist hoch.',
      prompts: ['Beweise gesichert – ist die Freigabe zum Restore erteilt (Tech: Voraussetzungen / Mgmt: Go-Live-Freigabe)?', 'Aus welcher – nachweislich sauberen – Quelle stellt ihr wieder her?', 'Wie wird der Wiederanlauf überwacht/validiert?'],
      good: ['Beweissicherung VOR Restore', 'Saubere, validierte Backups (offline)', 'Verschärftes Monitoring + Go-Live-Freigabe'],
      improvement: 'Offline/immutable Backups + Restore-Tests + Go-Live-Freigabekriterien festlegen.' },

    { id: 'lessons', phase: 'Abschluss', audience: 'both', title: 'Manöverkritik',
      situation: 'Die Übung endet. Jetzt die ehrliche Manöverkritik.',
      prompts: ['Was lief gut, was nicht?', 'Welche 3 Maßnahmen mit der höchsten Wirkung?', 'Wer ist bis wann verantwortlich?'],
      good: ['Konkrete, terminierte Maßnahmen', 'Verantwortliche benannt', 'Erkenntnisse dokumentiert'],
      improvement: 'Lessons-Learned mit terminierten Maßnahmen und Verantwortlichen nachhalten (und nachprüfen).' }
  ];

  function aud(inject, audience) {
    if (audience === 'mixed') return true;
    return inject.audience === 'both' || inject.audience === audience;
  }
  function scenarioMatch(inject, pb) {
    if (!inject.scenarioTags) return true;
    var hay = ((pb && pb.id) || '') + ' ' + ((pb && pb.category) || '');
    return inject.scenarioTags.some(function (t) { return hay.toLowerCase().indexOf(t) >= 0; });
  }

  IR.tabletop = {
    RATINGS: RATINGS,
    audiences: [
      { id: 'mgmt', name: 'Management / Krisenstab', desc: 'Führung, Entscheidungen, Kommunikation, Meldepflichten.' },
      { id: 'tech', name: 'Techniker / IR-Team', desc: 'Forensik, Eindämmung, Bereinigung, Wiederanlauf.' },
      { id: 'mixed', name: 'Gemischt (alle)', desc: 'Krisenstab + Technik im selben Durchlauf.' }
    ],
    scenarios: function () {
      return (IR.playbooks || []).filter(function (p) { return p.id !== 'generic'; })
        .map(function (p) { return { id: p.id, title: p.title, oneLiner: p.oneLiner, category: p.category, severity: p.severity }; });
    },
    // Übung zusammenstellen: Injects nach Zielgruppe + Szenario filtern.
    build: function (opts) {
      opts = opts || {};
      var pb = IR.engine.playbook(opts.scenarioId);
      var injects = INJECTS.filter(function (i) { return aud(i, opts.audience) && scenarioMatch(i, pb); })
        .map(function (i) {
          var sit = i.situation.replace('{oneLiner}', (pb && pb.oneLiner) || 'Ein sicherheitsrelevanter Vorfall ist eingetreten.');
          return { id: i.id, phase: i.phase, title: i.title, situation: sit, prompts: i.prompts, good: i.good, improvement: i.improvement };
        });
      return { audience: opts.audience, scenarioId: opts.scenarioId, playbook: pb,
        title: (pb ? pb.title : 'Generisches Szenario'), injects: injects,
        meta: opts.meta || {} };
    },
    score: function (ex, records) {
      var rated = ex.injects.filter(function (i) { return records[i.id] && records[i.id].rating != null; });
      if (!rated.length) return { pct: 0, avg: 0, rated: 0, total: ex.injects.length };
      var sum = rated.reduce(function (a, i) { return a + (+records[i.id].rating); }, 0);
      return { pct: Math.round(sum / (rated.length * 3) * 100), avg: (sum / rated.length).toFixed(1), rated: rated.length, total: ex.injects.length };
    },
    improvements: function (ex, records) {
      var out = [], seen = {};
      ex.injects.forEach(function (i) {
        var r = records[i.id] || {};
        if (r.rating != null && r.rating <= 1 && !seen[i.improvement]) { seen[i.improvement] = 1; out.push({ from: i.title, text: i.improvement }); }
        if (r.flagged) out.push({ from: i.title + ' (notiert)', text: r.flagged });
      });
      return out;
    },

    audName: function (a) { var x = this.audiences.filter(function (y) { return y.id === a; })[0]; return x ? x.name : a; },

    // IR-Plan (aus dem Szenario-Playbook) als Markdown
    irPlanMd: function (ex) {
      var pb = ex.playbook, L = ['# IR-Plan – ' + ex.title];
      if (pb) {
        L.push('> ' + pb.oneLiner); L.push('');
        L.push('**Schweregrad:** ' + pb.severity + ' · **Kategorie:** ' + pb.category);
        L.push('\n## Forensische Ableitung'); L.push(pb.derivation || '');
        pb.phases.forEach(function (ph) {
          L.push('\n### ' + ph.title);
          (ph.steps || []).forEach(function (s) {
            var meld = (s.commsId && IR.comms[s.commsId]) ? ' — Meldung: ' + IR.comms[s.commsId].audience + (IR.comms[s.commsId].frist ? ' (' + IR.comms[s.commsId].frist + ')' : '') : '';
            L.push('- ' + s.title + meld);
          });
        });
      } else { L.push('_Generisches Szenario – generischen Lifecycle anwenden._'); }
      return L.join('\n');
    },

    // Manöverkritik (After-Action-Review) als Markdown
    afterActionMd: function (ex, records) {
      var sc = this.score(ex, records), L = ['# Manöverkritik – ' + ex.title];
      L.push('- **Zielgruppe:** ' + this.audName(ex.audience));
      L.push('- **Datum:** ' + (ex.meta.date || U.fmtTs(U.nowISO())));
      if (ex.meta.org) L.push('- **Organisation:** ' + ex.meta.org);
      if (ex.meta.facilitator) L.push('- **Übungsleitung:** ' + ex.meta.facilitator);
      if (ex.meta.participants) L.push('- **Teilnehmer:** ' + ex.meta.participants);
      L.push('- **Gesamtbewertung:** ' + sc.pct + ' % (' + sc.rated + '/' + sc.total + ' Injects bewertet, Ø ' + sc.avg + '/3)');
      L.push('\n## Bewertung je Inject');
      ex.injects.forEach(function (i) {
        var r = records[i.id] || {}, lab = (r.rating != null ? IR.tabletop.RATINGS[r.rating].label : '—');
        L.push('\n**' + i.title + '** (' + i.phase + ') — ' + lab);
        if (r.response) L.push('- Reaktion: ' + r.response);
        if (r.flagged) L.push('- Notiz: ' + r.flagged);
      });
      var strong = ex.injects.filter(function (i) { var r = records[i.id]; return r && r.rating >= 2; });
      var weak = ex.injects.filter(function (i) { var r = records[i.id]; return r && r.rating != null && r.rating <= 1; });
      L.push('\n## Stärken'); if (!strong.length) L.push('_—_'); strong.forEach(function (i) { L.push('- ' + i.title); });
      L.push('\n## Schwächen / Lücken'); if (!weak.length) L.push('_—_'); weak.forEach(function (i) { L.push('- ' + i.title); });
      return L.join('\n');
    },

    // Druckfertiger HTML-Body (IR-Plan + Manöverkritik + Verbesserungen)
    reportBody: function (ex, records) {
      var imp = this.improvements(ex, records);
      var impMd = '# Technische & organisatorische Verbesserungen\n' +
        (imp.length ? imp.map(function (x, n) { return (n + 1) + '. **' + x.text + '** — _aus: ' + x.from + '_'; }).join('\n') : '_keine offenen Punkte erkannt_');
      return '<div class="ttp">' + U.md(this.irPlanMd(ex)) +
        '<hr>' + U.md(this.afterActionMd(ex, records)) +
        '<hr>' + U.md(impMd) + '</div>';
    }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = IR.tabletop;
})(typeof window !== 'undefined' ? window : globalThis);
