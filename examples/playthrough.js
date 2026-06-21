/* Durchspielen eines realen Vorfalls mit IR-Pilot (Framework + Tools + Restore).
 * Szenario: Heizungs-/SHK-Betrieb mit eigener Fertigung. Anruf: "alle Monitore
 * schwarz, Strom ist da, nichts geht mehr." Reproduzierbar:  node examples/playthrough.js
 */
'use strict';
require('../js/core.js'); require('../data/catalog.js'); require('../data/comms.js');
require('../data/toolkit.js'); require('../data/questions.js'); require('../js/framework.js');
require('../data/playbooks.js'); require('../js/report.js');
var IR = globalThis.IR, line = '-'.repeat(70);
function hd(t) { console.log('\n' + line + '\n' + t + '\n' + line); }

// 1) Assistent: Umgebung + Beobachtung + Fragebogen (Kundensicht)
var sel = {
  envId: 'shk_mfg',
  impactIds: ['encrypted'],
  answers: {
    q_when: 'vor ~20 Min, waehrend Mittag', q_what: 'alle Monitore schwarz, Strom ist da, nichts geht mehr',
    q_safety: 'nein', q_scope: '2' /* praktisch alles */, q_changed: 'nein', q_vendor: 'nein'
  }
};
hd('1) ASSISTENT – Erste Vermutung (ohne Technikwissen erfasst)');
var ranked = IR.framework.suggest(sel.envId, sel.impactIds, sel.answers);
console.log('Umgebung : ' + IR.catalog.env(sel.envId).name);
console.log('Beobachtung: ' + IR.catalog.impact('encrypted').name);
ranked.slice(0, 4).forEach(function (r, i) { console.log('  ' + (i + 1) + '. ' + r.h.name + '  (Score ' + r.score + ')'); });
sel.hypothesisId = ranked[0].h.id;
console.log('-> Top-Vermutung: ' + IR.catalog.hyp(sel.hypothesisId).name + ' (aber "Monitore schwarz/Strom da" kann auch Ausfall sein -> Erstbewertung = Verdacht)');

// 2) Playbook generieren + Fall anlegen
var pb = IR.framework.buildPlaybook(sel);
var c = IR.Case.create({ playbookId: pb.id, title: pb.title, org: 'Muster Heizung & Fertigung GmbH', responder: 'IR (du)', classification: 'TLP:AMBER' });
c.playbook = pb; c.selection = sel;
Object.keys(sel.answers).forEach(function (k) { c.answers[k] = sel.answers[k]; });
c.answers['summary'] = sel.answers.q_what;
hd('2) GENERIERTES PLAYBOOK: ' + pb.title);
pb.phases.forEach(function (ph) { console.log('  [' + ph.id + '] ' + ph.title + '  (' + ph.steps.length + ' Schritte)'); });

// 3) Erstbewertung: zunaechst Verdacht (Angriffs-Playbook sichtbar, irreversibles nein)
hd('3) ERSTBEWERTUNG – Vorfall oder Fehlalarm?');
IR.Case.check(c, pb.id + '-v-doc', true);
IR.Case.setFlag(c, 'status', 'suspected');
console.log('Einstufung: VERDACHT -> Schutzmassnahmen ja, irreversible Schritte nein.');

// 4) Triage + Krisenkommunikation
hd('4) TRIAGE & KRISENKOMMUNIKATION');
visible('triage').forEach(function (s) { if (s.type === 'check') doCheck(s); });
console.log('Sofort: betroffene Systeme vom Netz getrennt (NICHT ausgeschaltet), Erpresserschreiben gesucht, Backups geprueft.');
visible('comms').forEach(function (s) { if (s.type === 'comms') { IR.Case.check(c, s.id, true); IR.Case.addComm(c, { audience: IR.comms[s.commsId].audience, status: 'vorbereitet' }); console.log('Kommunikation: ' + IR.comms[s.commsId].audience); } });

// 5) Beweissicherung mit Tools + worauf achten -> Entscheidung
hd('5) BEWEISSICHERUNG (mit Tools) + WORAUF ACHTEN');
visible('forensik').forEach(function (s) {
  if (s.type === 'tool') { IR.Case.check(c, s.id, true); console.log('  Tool genutzt: ' + s.toolId); }
  else if (s.type === 'evidence') {
    IR.Case.check(c, s.id, true);
    var look = (s.do.match(/Worauf achten[^\n]*/) || [''])[0].replace('**Worauf achten (Entscheidung):** ', '   ');
    IR.Case.addEvidence(c, { name: s.evidence.name, type: s.evidence.type, volatility: s.evidence.volatility, hash: 'sha256:' + Math.random().toString(16).slice(2, 14), collectedBy: 'IR', location: 'USB:/evidence', method: 'Triage/Acquisition' });
    console.log('  Beweis gesichert: ' + s.evidence.name + ' [' + s.evidence.volatility + ']');
    if (look) console.log(look);
  }
});
// IOCs aus dem Befund
IR.Case.addIoc(c, 'hash', '44d88612fea8a8f36de82e1278abb02f', 'Ransomware-Binary');
IR.Case.addIoc(c, 'ip', '185.220.101.5', 'C2 (RAM/Capture)');
// Befund + Entscheidung
var dstep = pb.phases.filter(function (p) { return p.id === 'forensik'; })[0].steps.filter(function (s) { return /-decide-/.test(s.id); })[0];
IR.Case.answer(c, dstep.id, 'Ransom-Note "RESTORE-FILES.txt" + Dateien .lockedX umbenannt; Logs: vssadmin delete shadows; RAM: Verschluesselungsprozess + C2. -> RANSOMWARE BESTAETIGT.');
console.log('\nENTSCHEIDUNG: ' + c.answers[dstep.id]);
IR.Case.setFlag(c, 'status', 'confirmed');

// 6) Eindaemmung + Bereinigung
hd('6) EINDAEMMUNG & BEREINIGUNG');
['eindaemmung', 'bereinigung'].forEach(function (ph) { visible(ph).forEach(function (s) { if (s.type === 'check') doCheck(s); }); });

// 7) Wiederherstellung – BEWEISE ZUERST, dann begleiteter Restore
hd('7) WIEDERHERSTELLUNG & SICHERER WIEDERANLAUF (Beweise zuerst!)');
visible('wiederanlauf').forEach(function (s) {
  if (s.type === 'check') { doCheck(s); }
  else if (s.type === 'input') { IR.Case.answer(c, s.id, s.id.indexOf('restore_order') >= 0 ? 'demo' : 'Freigabe IT-Leitung' ); }
});
IR.Case.answer(c, fieldId('restore_order'), '1) Kuehlung/Steuerung (Discounter-Baustelle), 2) Fertigung/CNC, 3) Buero/ERP, 4) Kasse');
IR.Case.answer(c, fieldId('golive'), 'Freigabe durch IT-Leitung nach Validierung; Restrisiko: Re-Infektion -> 2 Wochen Intensiv-Monitoring.');

// 8) Ermittlung + Abschluss
hd('8) ERMITTLUNG & ABSCHLUSS');
['ermittlung', 'abschluss'].forEach(function (ph) { visible(ph).forEach(function (s) { if (s.type === 'check') doCheck(s); }); });

var prog = IR.engine.progress(pb, c);
console.log('\nFortschritt: ' + prog.done + '/' + prog.total + ' (' + prog.pct + '%)  ·  Beweise: ' + c.evidence.length + '  ·  IOCs: ' + c.iocs.length + '  ·  Meldungen: ' + c.comms.length);

hd('LAGEBERICHT');
console.log(IR.report.sitrep(c));

// Report speichern
var fs = require('fs'), path = require('path');
var out = path.join(__dirname, '..', 'dist'); fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'playthrough-report.md'), IR.report.markdown(c));
console.log('\nVollstaendiger Bericht: dist/playthrough-report.md');

// ---- Helpers ----
function visible(phaseId) { var ph = pb.phases.filter(function (p) { return p.id === phaseId; })[0]; return IR.engine.visibleSteps(ph, c); }
function doCheck(s) { IR.Case.check(c, s.id, true); console.log('  [x] ' + s.title); }
function fieldId(name) { var f = null; pb.phases.forEach(function (ph) { ph.steps.forEach(function (s) { if (s.field && s.field.name === name) f = s.id; }); }); return f; }
