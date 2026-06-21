/* IR-Pilot – Headless-Tests (Node). Validiert Daten, Engine, Bericht, Comms. */
'use strict';
require('../js/core.js');
require('../data/playbooks.js');
require('../data/comms.js');
require('../data/toolkit.js');
require('../js/report.js');
var IR = globalThis.IR;

var fails = 0, passes = 0;
function ok(cond, msg) { if (cond) { passes++; } else { fails++; console.log('  FAIL:', msg); } }
function group(name, fn) { console.log('# ' + name); fn(); }

var EXPECTED = ['bec-iban', 'ot-umspannwerk', 'ot-stellwerk', 'ransomware', 'ad-bruteforce', 'supplychain-solar'];
var PHASES = ['triage', 'comms', 'forensik', 'eindaemmung', 'bereinigung', 'wiederanlauf', 'ermittlung', 'abschluss'];

group('Playbooks vorhanden & vollstaendig', function () {
  ok(IR.playbooks.length === 6, 'genau 6 Playbooks (ist ' + IR.playbooks.length + ')');
  EXPECTED.forEach(function (id) {
    ok(IR.engine.playbook(id), 'Playbook ' + id + ' existiert');
  });
  IR.playbooks.forEach(function (pb) {
    ok(pb.title && pb.oneLiner && pb.derivation, pb.id + ': Titel/oneLiner/derivation');
    var ph = (pb.phases || []).map(function (p) { return p.id; });
    PHASES.forEach(function (need) { ok(ph.indexOf(need) >= 0, pb.id + ': Phase ' + need + ' vorhanden'); });
  });
});

group('Schritt-IDs eindeutig & Felder ok', function () {
  IR.playbooks.forEach(function (pb) {
    var seen = {};
    (pb.phases || []).forEach(function (phase) {
      (phase.steps || []).forEach(function (s) {
        ok(!seen[s.id], pb.id + ': Step-ID eindeutig (' + s.id + ')'); seen[s.id] = 1;
        ok(s.title && s.type, pb.id + '/' + s.id + ': title+type');
        ok(['check', 'input', 'choice', 'evidence', 'comms', 'tool', 'note'].indexOf(s.type) >= 0, s.id + ': bekannter Typ');
        if (s.type === 'choice') ok((s.options || []).length >= 2, s.id + ': choice hat Optionen');
        if (s.type === 'input') ok(s.field && s.field.name, s.id + ': input hat field');
        if (s.type === 'evidence') ok(s.evidence && s.evidence.name, s.id + ': evidence-spec');
        if (s.type === 'comms') ok(s.commsId && IR.comms[s.commsId], s.id + ': comms-Template existiert (' + s.commsId + ')');
      });
    });
  });
});

group('Comms-Templates & Fuellung', function () {
  Object.keys(IR.comms).forEach(function (k) {
    var t = IR.comms[k];
    ok(t.audience && t.body, 'comms ' + k + ': audience+body');
  });
  var filled = IR.fillTemplate(IR.comms.bank_recall.body, { org: 'Muster GmbH', responder: 'IR-Team' });
  ok(filled.indexOf('Muster GmbH') >= 0, 'Platzhalter {{org}} ersetzt');
  ok(filled.indexOf('{{') < 0, 'keine Platzhalter offen');
});

group('Toolkit', function () {
  ok(IR.toolkit.length >= 5, 'mind. 5 Tools');
  IR.toolkit.forEach(function (t) {
    ok(t.id && t.name && t.script && t.filename, t.id + ': Felder');
    ok(t.script.length > 100, t.id + ': Skript nicht leer');
  });
  var ids = IR.toolkit.map(function (t) { return t.id; });
  ['Windows-Triage', 'AD-Triage', 'OT-Netzwerk-Capture', 'M365-Triage', 'Mail-Header'].forEach(function (id) {
    ok(ids.indexOf(id) >= 0, 'Tool ' + id + ' vorhanden');
  });
});

group('Engine: showIf, Flags, Fortschritt', function () {
  var pb = IR.engine.playbook('ransomware');
  var c = IR.Case.create({ playbookId: 'ransomware', org: 'Baeckerei', responder: 'IR' });
  // showIf: Restore-aus-Backup nur sichtbar wenn backups_ok=true
  var recov = pb.phases.filter(function (p) { return p.id === 'wiederanlauf'; })[0];
  var visBefore = IR.engine.visibleSteps(recov, c).map(function (s) { return s.id; });
  ok(visBefore.indexOf('ran-w-restore') < 0, 'Backup-Restore zunaechst versteckt');
  IR.Case.setFlag(c, 'backups_ok', true);
  var visAfter = IR.engine.visibleSteps(recov, c).map(function (s) { return s.id; });
  ok(visAfter.indexOf('ran-w-restore') >= 0, 'Backup-Restore nach Flag sichtbar');
  ok(visAfter.indexOf('ran-w-norestore') < 0, 'No-Backup-Pfad bei backups_ok versteckt');
  // Fortschritt
  var p0 = IR.engine.progress(pb, c); ok(p0.total > 0 && p0.done === 0, 'Fortschritt startet bei 0');
  IR.Case.check(c, 'ran-t-isolate', true);
  ok(IR.engine.progress(pb, c).done === 1, 'Fortschritt zaehlt Check');
});

group('Voller Durchlauf je Fall -> Bericht', function () {
  EXPECTED.forEach(function (id) {
    var pb = IR.engine.playbook(id);
    var c = IR.Case.create({ playbookId: id, org: 'Test', responder: 'Responder', title: pb.title });
    IR.Case.answer(c, 'summary', 'Testlauf ' + id);
    // alle sichtbaren ausfuehrbaren Schritte abhaken + erste choice setzen
    pb.phases.forEach(function (ph) {
      IR.engine.visibleSteps(ph, c).forEach(function (s) {
        if (s.type === 'choice') IR.Case.setFlag(c, s.options[0].setFlag.k, s.options[0].setFlag.v);
        if (s.type === 'input') IR.Case.answer(c, s.id, 'wert');
        if (['check', 'evidence', 'comms', 'tool'].indexOf(s.type) >= 0) IR.Case.check(c, s.id, true);
        if (s.type === 'evidence') IR.Case.addEvidence(c, { name: s.evidence.name, type: s.evidence.type, hash: 'abc123def456', collectedBy: 'Responder', location: 'USB' });
        if (s.type === 'comms') IR.Case.addComm(c, { audience: IR.comms[s.commsId].audience, status: 'gesendet' });
      });
    });
    IR.Case.addIoc(c, 'ip', '203.0.113.7', 'C2');
    var md = IR.report.markdown(c);
    ok(md.indexOf('Incident-Report') >= 0, id + ': Report-Titel');
    ['Zeitachse', 'Chain of Custody', 'Indicators of Compromise', 'Kommunikation', 'Durchgefuehrte Massnahmen'].forEach(function (sec) {
      ok(md.indexOf(sec) >= 0, id + ': Abschnitt "' + sec + '"');
    });
    ok(c.evidence.length > 0, id + ': Beweise erfasst');
    ok(c.evidence[0].custody.length >= 1, id + ': Chain of Custody Eintrag');
    var sit = IR.report.sitrep(c);
    ok(sit.indexOf('LAGEBERICHT') >= 0, id + ': Sitrep');
  });
});

group('Persistenz (In-Memory-Fallback)', function () {
  var c = IR.Case.create({ playbookId: 'bec-iban', title: 'Persist' });
  IR.store.save(c);
  ok(IR.store.get(c.id), 'Case gespeichert & ladbar');
  IR.store.remove(c.id);
  ok(!IR.store.get(c.id), 'Case entfernt');
});

console.log('\n' + passes + ' ok, ' + fails + ' fail');
process.exit(fails ? 1 : 0);
