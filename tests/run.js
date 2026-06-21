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

var EXPECTED = ['bec-iban', 'ot-umspannwerk', 'ot-stellwerk', 'ransomware', 'ad-bruteforce', 'supplychain-solar', 'phishing-wave', 'ot-wasserwerk', 'cloud-m365-takeover'];
var PHASES = ['triage', 'comms', 'forensik', 'eindaemmung', 'bereinigung', 'wiederanlauf', 'ermittlung', 'abschluss'];

group('Playbooks vorhanden & vollstaendig', function () {
  ok(IR.playbooks.length === 9, 'genau 9 Playbooks (ist ' + IR.playbooks.length + ')');
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
  IR.Case.setFlag(c, 'status', 'confirmed');   // Gate: Angriffs-Schritte sichtbar
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

group('Erstbewertungs-Gate & Benign-Pfad ("kein Angriff")', function () {
  IR.playbooks.forEach(function (pb) {
    ok(pb.phases[0].id === 'verifikation', pb.id + ': Verifikation ist erste Phase');
    ok(IR.engine.playbook(pb.id).phases[0].steps.some(function (s) { return /-v-assess$/.test(s.id); }), pb.id + ': Einstufungs-Choice vorhanden');
  });
  // Ohne Einstufung: Angriffs-Phasen versteckt
  var pb = IR.engine.playbook('ot-stellwerk');
  var c = IR.Case.create({ playbookId: 'ot-stellwerk' });
  var triage = pb.phases.filter(function (p) { return p.id === 'triage'; })[0];
  ok(IR.engine.visibleSteps(triage, c).length === 0, 'Angriffs-Triage ohne Einstufung versteckt');
  // benign: nur De-Eskalationspfad sichtbar
  IR.Case.setFlag(c, 'status', 'benign');
  var verif = pb.phases[0];
  var visB = IR.engine.visibleSteps(verif, c).map(function (s) { return s.id; });
  ok(visB.indexOf('ot-stellwerk-v-bclose') >= 0, 'benign: Schliessen-Schritt sichtbar');
  ok(visB.indexOf('ot-stellwerk-v-proceed') < 0, 'benign: Proceed-Hinweis versteckt');
  ok(IR.engine.visibleSteps(triage, c).length === 0, 'benign: Angriffs-Triage bleibt versteckt');
  // confirmed: Angriffs-Phasen sichtbar, benign-Pfad versteckt
  IR.Case.setFlag(c, 'status', 'confirmed');
  ok(IR.engine.visibleSteps(triage, c).length > 0, 'confirmed: Angriffs-Triage sichtbar');
  ok(IR.engine.visibleSteps(verif, c).map(function (s) { return s.id; }).indexOf('ot-stellwerk-v-bclose') < 0, 'confirmed: benign-Pfad versteckt');
  // Report im Benign-Fall funktioniert
  var cb = IR.Case.create({ playbookId: 'ot-stellwerk', title: 'Fehlalarm Maus' });
  IR.Case.setFlag(cb, 'status', 'benign');
  IR.Case.answer(cb, 'ot-stellwerk-deesc', 'Legitime Fernwartung (angekuendigt) bestaetigt.');
  ['ot-stellwerk-v-doc', 'ot-stellwerk-v-bverify', 'ot-stellwerk-v-bclose'].forEach(function (id) { IR.Case.check(cb, id, true); });
  var md = IR.report.markdown(cb);
  ok(/Erstbewertung/.test(md), 'Benign-Report enthaelt Erstbewertung');
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

group('Ingest / Import (Smartphone & Desktop)', function () {
  var c = IR.Case.create({ playbookId: 'bec-iban' });
  var bundle = {
    source: 'phone-recon',
    iocs: [{ type: 'ip', value: '203.0.113.9', note: 'C2' }, { type: 'ip', value: '203.0.113.9' }],
    hosts: [{ ip: '10.0.0.5', name: 'kasse01', ports: '445,3389' }],
    notes: ['ARP-Scan: 12 Hosts aktiv'],
    timeline: [{ kind: 'recon', text: 'nmap -sn 10.0.0.0/24' }],
    evidence: [{ name: 'capture.pcap', type: 'netzwerk', hash: 'deadbeef', location: 'USB' }]
  };
  var r = IR.ingest.merge(c, bundle);
  ok(r.iocs === 1, 'IOC-Dedupe (1 statt 2)');
  ok(c.iocs.length === 2, 'IOC + Host als IOC');
  ok(r.evidence === 1 && c.evidence.length === 1, 'Beweis importiert');
  ok(c.timeline.some(function (t) { return /nmap/.test(t.text); }), 'Timeline-Eintrag importiert');
  // Freitext-Extraktion
  var b2 = IR.ingest.fromText('Kontakt a@b.de IP 8.8.8.8 Hash ' + 'a'.repeat(64) + ' IBAN LT12 1000 0111 0100 1000 URL http://evil.example/x');
  var types = b2.iocs.map(function (x) { return x.type; });
  ['email', 'ip', 'hash', 'iban', 'url'].forEach(function (t) { ok(types.indexOf(t) >= 0, 'fromText erkennt ' + t); });
});

group('Timeline-CSV', function () {
  var c = IR.Case.create({ playbookId: 'ad-bruteforce' });
  IR.Case.log(c, 'action', 'Test "mit Anfuehrungszeichen"');
  var csv = IR.report.timelineCSV(c);
  ok(/"timestamp","kind","text","by"/.test(csv), 'CSV-Header');
  ok(/""mit Anfuehrungszeichen""/.test(csv), 'CSV maskiert Anfuehrungszeichen');
});

console.log('\n' + passes + ' ok, ' + fails + ' fail');
process.exit(fails ? 1 : 0);
