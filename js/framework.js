/* IR-Pilot – Framework: aus Umgebung + Impact + Fragebogen eine Hypothese
 * ableiten und daraus ein massgeschneidertes Playbook generieren (mit Tools an
 * der richtigen Stelle). Enthaelt auch das zentrale Erstbewertungs-Gate und ein
 * generisches Playbook. */
(function (root) {
  'use strict';
  var IR = root.IR || (root.IR = {});

  function s(id, type, title, md, extra) { return Object.assign({ id: id, type: type, title: title, do: md }, extra || {}); }
  var VOL = { hoch: 0, mittel: 1, niedrig: 2 };

  /* -------------------------------------------------- Erstbewertungs-Gate */
  var GATE = { any: [{ flag: 'status', equals: 'confirmed' }, { flag: 'status', equals: 'suspected' }] };
  var BEN = { flag: 'status', equals: 'benign' };

  function verifySteps(p, note) {
    return [
      s(p + '-v-doc', 'check', 'Erstbewertung & Quelle dokumentieren', 'Wer meldet **was genau**? Quelle/Verlaesslichkeit, Zeitpunkt, betroffene Systeme. Fakten von Vermutung trennen.'),
      s(p + '-v-benign', 'note', 'Nicht-boeswillige Erklaerung pruefen', note || 'Pruefen, ob eine legitime/harmlose Ursache vorliegt (Fehlkonfiguration, Wartung, Defekt), bevor ein Angriff angenommen wird.'),
      s(p + '-v-assess', 'choice', 'Einstufung – Vorfall oder Fehlalarm?', 'Aufgrund der ersten Fakten einstufen. **Bei Safety-/Versorgungsrisiko trotz Unsicherheit vorsorglich wie einen Vorfall behandeln** (Schutzmassnahmen ja, irreversible Schritte nein).', { options: [
        { label: 'Bestaetigter Angriff/Vorfall', setFlag: { k: 'status', v: 'confirmed' } },
        { label: 'Verdacht – weiter pruefen', setFlag: { k: 'status', v: 'suspected' } },
        { label: 'Fehlalarm / kein Angriff', setFlag: { k: 'status', v: 'benign' } }
      ] }),
      s(p + '-v-bverify', 'check', 'Benigne Ursache positiv bestaetigen & belegen', 'Die harmlose Erklaerung **belegen** (nicht nur annehmen).', { showIf: BEN }),
      s(p + '-v-bevid', 'check', 'Minimal-Doku/Beweis sichern', 'Kurzdoku + relevante Logs/Screenshots fuer die Nachvollziehbarkeit.', { showIf: BEN }),
      s(p + '-v-bdeesc', 'comms', 'Entwarnung kommunizieren', 'Eskalation kontrolliert zuruecknehmen, Stakeholder informieren.', { commsId: 'holding_statement', showIf: BEN }),
      s(p + '-v-breason', 'input', 'Begruendung der Entwarnung', 'Warum **kein** sicherheitsrelevanter Vorfall?', { field: { name: p + '-deesc', label: 'Begruendung kein Vorfall', kind: 'textarea' }, showIf: BEN }),
      s(p + '-v-bclose', 'check', 'Als „kein sicherheitsrelevanter Vorfall" schliessen', 'Begruendet schliessen; bei neuen Hinweisen reaktivieren.', { showIf: BEN }),
      s(p + '-v-proceed', 'note', 'Weiter mit dem Playbook', 'Einstufung bestaetigt → mit den Phasen unten fortfahren. **Sicherheit und fluechtige Beweise zuerst.**', { showIf: GATE })
    ];
  }

  function applyGate(pb, note) {
    if (pb.phases[0] && pb.phases[0].id === 'verifikation') return pb; // idempotent
    pb.phases.unshift({ id: 'verifikation', title: 'Erstbewertung – Vorfall oder Fehlalarm?', steps: verifySteps(pb.id, note) });
    pb.phases.forEach(function (ph) {
      if (ph.id === 'verifikation') return;
      ph.steps.forEach(function (st) { st.showIf = st.showIf ? { all: [GATE, st.showIf] } : GATE; });
    });
    return pb;
  }

  /* ---------------------------------------------------------- Hypothesen-Scoring */
  function suggest(envId, impactIds, answers) {
    var env = IR.catalog.env(envId);
    var score = {};
    IR.hypotheses.forEach(function (h) { score[h.id] = 0; });
    (impactIds || []).forEach(function (iid) {
      var im = IR.catalog.impact(iid);
      if (im) Object.keys(im.hyp).forEach(function (hid) { score[hid] = (score[hid] || 0) + im.hyp[hid]; });
    });
    if (env) IR.hypotheses.forEach(function (h) {
      var ov = (h.envTags || []).filter(function (t) { return env.tags.indexOf(t) >= 0; }).length;
      score[h.id] += ov * 2;
    });
    var ev = IR.qeval(answers || {});
    Object.keys(ev.boosts).forEach(function (hid) { if (score[hid] != null) score[hid] += ev.boosts[hid]; });
    return IR.hypotheses
      .map(function (h) { return { h: h, score: score[h.id] || 0 }; })
      .filter(function (x) { return x.score > 0; })
      .sort(function (a, b) { return b.score - a.score; });
  }

  /* ---------------------------------------------------------- Playbook-Generator */
  function severity(env, hyp) {
    if (env && (env.tags.indexOf('safety') >= 0 || env.tags.indexOf('kritis') >= 0)) return 'kritisch';
    if (['ransomware', 'wiper', 'ot_manipulation', 'identity_ad', 'cloud_takeover', 'rat', 'exfil'].indexOf(hyp.id) >= 0) return 'hoch';
    if (hyp.benign) return 'mittel';
    return 'hoch';
  }

  function commsList(env, imps, hyp) {
    var list = ['mgmt_briefing'].concat(hyp.comms || []);
    if (env && env.tags.indexOf('kritis') >= 0) list.push('kritis_bsi');
    if (env && env.tags.indexOf('health') >= 0) list.push('health_authority');
    if (!hyp.benign && imps.some(function (i) { return i.tags.indexOf('data') >= 0 || i.tags.indexOf('identity') >= 0; })) list.push('dsgvo_breach');
    // dedupe, nur existierende
    var seen = {}, out = [];
    list.forEach(function (id) { if (!seen[id] && IR.comms && IR.comms[id]) { seen[id] = 1; out.push(id); } });
    return out;
  }

  function toolsList(env, hyp) {
    var t = (hyp.tools || []).slice();
    if (env) {
      if (env.tags.indexOf('ot') >= 0 || env.tags.indexOf('scada') >= 0) t.push('OT-Netzwerk-Capture');
      if (env.tags.indexOf('ad') >= 0) t.push('AD-Triage');
      if (env.tags.indexOf('cloud') >= 0 || env.tags.indexOf('payment') >= 0) t.push('M365-Triage');
    }
    var seen = {}, out = [];
    t.forEach(function (id) { if (!seen[id]) { seen[id] = 1; out.push(id); } });
    return out;
  }

  function buildPlaybook(sel) {
    sel = sel || {};
    var env = IR.catalog.env(sel.envId) || { name: 'Unbekannte Umgebung', tags: [], group: '' };
    var imps = (sel.impactIds || []).map(IR.catalog.impact).filter(Boolean);
    var hyp = IR.catalog.hyp(sel.hypothesisId) || IR.catalog.hyp('endpoint_malware');
    var p = 'gen-' + hyp.id;
    var n = 0; function id(x) { return p + '-' + x + '-' + (n++); }

    var oneLiner = (imps.map(function (i) { return i.name; }).join('; ') || 'Sicherheitsvorfall') + ' – ' + env.name;
    var derivation = '**Umgebung:** ' + env.name + ' (' + env.group + ')\n' +
      '**Beobachtung (Kundensicht):** ' + (imps.map(function (i) { return i.name; }).join('; ') || '–') + '\n' +
      '**Erste technische Vermutung:** ' + hyp.name + ' – ' + hyp.tech;

    // Triage
    var triage = [];
    if (env.tags.indexOf('safety') >= 0 || env.tags.indexOf('kritis') >= 0) {
      triage.push(s(id('safety'), 'choice', 'Sicherheit/Versorgung zuerst', '**Gefahr fuer Mensch/Umwelt/Versorgung?** Mit Anlagen-/Betriebsverantwortlichem in sicheren Zustand; keine irreversiblen Schalthandlungen ohne Freigabe.', { options: [
        { label: 'Ja – Schutzmassnahmen + Verantwortliche/Behoerden', setFlag: { k: 'safety', v: true } },
        { label: 'Stabil/kontrolliert', setFlag: { k: 'safety', v: false } }
      ] }));
    }
    imps.forEach(function (im) { (im.immediate || []).forEach(function (t, k) { triage.push(s(id('imm'), 'check', t, '')); }); });
    triage.push(s(id('scope'), 'input', 'Umfang & Beobachtung erfassen', 'Betroffene Systeme/Prozesse, seit wann, Auswirkung, wer meldet.', { field: { name: 'summary', label: 'Umfang / Beobachtung', kind: 'textarea' } }));

    // Comms
    var comms = commsList(env, imps, hyp).map(function (cid) {
      var t = IR.comms[cid];
      return s(id('comm'), 'comms', t.audience, t.frist ? '**Frist:** ' + t.frist : '', { commsId: cid });
    });
    if (!comms.length) comms.push(s(id('comm'), 'comms', 'Geschaeftsleitung briefen', '', { commsId: 'mgmt_briefing' }));

    // Forensik: Beweise (nach Volatilitaet) + worauf achten + Tools + Entscheidung
    var forensik = [];
    (hyp.forensic || []).slice().sort(function (a, b) { return (VOL[a.volatility] || 1) - (VOL[b.volatility] || 1); })
      .forEach(function (f) {
        var md = 'Fluechtigkeit: **' + (f.volatility || '—') + '** – sichern, hashen, Chain of Custody.' +
          (f.look ? '\n**Worauf achten (Entscheidung):** ' + f.look : '');
        forensik.push(s(id('ev'), 'evidence', f.name, md, { evidence: { name: f.name, type: f.type, volatility: f.volatility } }));
      });
    toolsList(env, hyp).forEach(function (tid) {
      forensik.push(s(id('tool'), 'tool', 'Tool: ' + tid, 'Passendes Werkzeug zur Sicherung/Analyse – im Tab **Tools** oeffnen.', { toolId: tid }));
    });
    forensik.push(s(id('decide'), 'input', 'Befund & Entscheidung: bestaetigt sich die Vermutung?',
      '**Entscheidungskriterien:** ' + (hyp.decide || 'Pruefen, ob die Vermutung durch die Daten gestuetzt wird.') +
      '\n\nBefund festhalten; bei Bedarf Einstufung in der Erstbewertung anpassen.',
      { field: { name: 'befund', label: 'Forensischer Befund / Entscheidung', kind: 'textarea' } }));

    // Eindaemmung / Bereinigung
    var contain = (hyp.contain || []).map(function (t) { return s(id('cont'), 'check', t, ''); });
    var eradicate = (hyp.eradicate || []).map(function (t) { return s(id('erad'), 'check', t, ''); });

    // Wiederherstellung & sicherer Wiederanlauf – begleitet, Beweise ZUERST
    var recovery = [
      s(id('w'), 'check', 'STOP: Beweissicherung VOR Restore abgeschlossen?', '**Erst sichern, dann restoren!** Restore/Neuaufsetzen ueberschreibt fluechtige Spuren unwiderruflich. Pruefen: alle relevanten Beweise (RAM, Images/Triage, Logs) gesichert, **gehasht** und in der Beweisliste mit Chain of Custody erfasst. Im Zweifel zusaetzlich ein Voll-Image ziehen.'),
      s(id('w'), 'check', 'Saubere Wiederherstellungsquelle bestimmen & pruefen', 'Verifiziert sauberes Backup/Image VON VOR der Kompromittierung. Integritaet/Hash pruefen, Backup offline halten (Schutz vor Mitverschluesselung/Wiper).'),
      s(id('w'), 'input', 'Wiederanlauf-Reihenfolge priorisieren', 'Kritische Prozesse zuerst (z.B. Kuehlung/Produktion/Kasse). Reihenfolge + Verantwortliche festhalten.', { field: { name: 'restore_order', label: 'Priorisierte Reihenfolge', kind: 'textarea' } }),
      s(id('w'), 'check', 'Erstzugang/Schwachstelle geschlossen (vor dem Restore)', 'Ausgenutzten Weg (RDP/VPN/Phishing/Exploit/Konto) abstellen, sonst Re-Infektion.'),
      s(id('w'), 'check', 'In gesaeubertem/segmentiertem Netz wiederherstellen', 'Nicht ins noch kompromittierte Netz zurueck; saubere VLANs/Segmente.'),
      s(id('w'), 'check', 'Alle Zugaenge erneuern (Passwoerter/Keys/Tokens, MFA)', 'Priorisiert Admin-/Dienstkonten; bei AD KRBTGT 2x zuruecksetzen.'),
      s(id('w'), 'check', 'Vor Go-Live: Monitoring/EDR scharf, IOCs geblockt', 'Erhoehte Protokollierung; auf Wiederauftauchen von IOCs/Persistenz achten.'),
      s(id('w'), 'check', 'Integritaet & Funktion validieren', 'Keine Restpersistenz, keine IOC-Kommunikation; Funktionstest der Kernprozesse.'),
      s(id('w'), 'check', 'Stufenweiser, beobachteter Wiederanlauf', 'System fuer System hochfahren, beobachten, dann das naechste.'),
      s(id('w'), 'input', 'Go-Live-Entscheidung dokumentieren', 'Wer gibt frei? Welche Kriterien erfuellt? Restrisiken benannt.', { field: { name: 'golive', label: 'Go-Live-Freigabe', kind: 'textarea' } })
    ];
    var ermittlung = [
      s(id('i'), 'check', 'Root Cause & Zeitachse rekonstruieren', 'Erstzugang, Verweildauer, Wirkung, Datenabfluss.'),
      s(id('i'), 'check', 'Vollstaendigkeit pruefen (Persistenz ausgeschlossen?)', '')
    ];
    var abschluss = [
      s(id('x'), 'check', 'Abschlussbericht erzeugen', 'Im Tab **Bericht** exportieren.'),
      s(id('x'), 'input', 'Lessons Learned', '', { field: { name: 'lessons', label: 'Lessons Learned', kind: 'textarea' } }),
      s(id('x'), 'check', 'Fall abschliessen & Asservate uebergeben', '')
    ];

    var pb = {
      id: p, generated: true, title: sel.title || (hyp.name + ' – ' + env.name),
      category: env.group + ' · ' + hyp.name, severity: severity(env, hyp),
      oneLiner: oneLiner, derivation: derivation,
      selection: { envId: env.id, impactIds: imps.map(function (i) { return i.id; }), hypothesisId: hyp.id },
      phases: [
        { id: 'triage', title: 'Identifikation & Sofortmassnahmen', steps: triage },
        { id: 'comms', title: 'Krisenkommunikation & Meldepflichten', steps: comms },
        { id: 'forensik', title: 'Beweissicherung (Order of Volatility)', steps: forensik },
        { id: 'eindaemmung', title: 'Eindaemmung', steps: contain.length ? contain : [s(id('cont'), 'check', 'Betroffene Systeme isolieren', '')] },
        { id: 'bereinigung', title: 'Bereinigung', steps: eradicate.length ? eradicate : [s(id('erad'), 'check', 'Ursache beseitigen / neu aufsetzen', '')] },
        { id: 'wiederanlauf', title: 'Wiederherstellung & sicherer Wiederanlauf', steps: recovery },
        { id: 'ermittlung', title: 'Ermittlung / Analyse', steps: ermittlung },
        { id: 'abschluss', title: 'Abschluss', steps: abschluss }
      ]
    };
    applyGate(pb, hyp.benign ? 'Diese Einstufung geht von KEINEM Cyber-Angriff aus – bitte positiv bestaetigen.' : null);
    return pb;
  }

  function genericPlaybook() {
    var pb = buildPlaybook({ envId: null, impactIds: [], hypothesisId: 'endpoint_malware', title: 'Generisches Playbook (jeder Vorfall)' });
    pb.id = 'generic'; pb.generated = false; pb.category = 'Generisch';
    pb.oneLiner = 'Allgemeiner IR-Ablauf fuer jeden Vorfall – Einstufung, Sicherung, Eindaemmung, Wiederanlauf.';
    return pb;
  }

  IR.framework = { applyGate: applyGate, suggest: suggest, buildPlaybook: buildPlaybook, gate: GATE };
  IR.genericPlaybook = genericPlaybook();

  if (typeof module !== 'undefined' && module.exports) module.exports = IR.framework;
})(typeof window !== 'undefined' ? window : globalThis);
