/* IR-Pilot – Headless-Tests (Node). Validiert Daten, Engine, Bericht, Comms. */
'use strict';
require('../js/core.js');
require('../js/native.js');
require('../js/hosts.js');
require('../js/sources.js');
require('../js/cloud.js');
require('../js/assistant.js');
require('../data/catalog.js');
require('../data/comms.js');
require('../data/toolkit.js');
require('../data/questions.js');
require('../js/framework.js');
require('../data/playbooks.js');
require('../js/report.js');
require('../js/tabletop.js');
var IR = globalThis.IR;

var fails = 0, passes = 0;
function ok(cond, msg) { if (cond) { passes++; } else { fails++; console.log('  FAIL:', msg); } }
function group(name, fn) { console.log('# ' + name); fn(); }

var EXPECTED = ['bec-iban', 'ot-umspannwerk', 'ot-stellwerk', 'ransomware', 'ad-bruteforce', 'supplychain-solar', 'phishing-wave', 'ot-wasserwerk', 'cloud-m365-takeover'];
var PHASES = ['triage', 'comms', 'forensik', 'eindaemmung', 'bereinigung', 'wiederanlauf', 'ermittlung', 'abschluss'];

group('Playbooks vorhanden & vollstaendig', function () {
  ok(IR.playbooks.filter(function (p) { return p.id !== 'generic'; }).length === 9, '9 kuratierte Playbooks');
  ok(IR.engine.playbook('generic'), 'generisches Playbook vorhanden');
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

group('Framework: Kataloge', function () {
  ok(IR.environments.length >= 50, '>=50 Umgebungen (ist ' + IR.environments.length + ')');
  ok(IR.impacts.length >= 10, '>=10 Impacts (ist ' + IR.impacts.length + ')');
  ok(IR.hypotheses.length >= 15, '>=15 Hypothesen (ist ' + IR.hypotheses.length + ')');
  // gewuenschte Spezial-Umgebungen vorhanden
  ['brewery', 'sawmill', 'machine_builder', 'maintenance', 'fire_dept', 'facility_mgmt'].forEach(function (id) {
    ok(IR.catalog.env(id), 'Umgebung ' + id + ' vorhanden');
  });
  // Eindeutige IDs
  ['environments', 'impacts', 'hypotheses'].forEach(function (k) {
    var seen = {}, dup = 0; IR[k].forEach(function (x) { if (seen[x.id]) dup++; seen[x.id] = 1; });
    ok(dup === 0, k + ': IDs eindeutig');
  });
});

group('Framework: Hypothesen-Scoring', function () {
  // Brauerei + Maschine seltsam + "Maschine falsche Werte=ja" -> OT-Manipulation oben
  var r = IR.framework.suggest('brewery', ['machine_weird'], { q_machine: 'ja', q_safety: 'ja' });
  ok(r.length > 0, 'Scoring liefert Hypothesen');
  ok(r[0].h.id === 'ot_manipulation', 'Top-Hypothese OT-Manipulation (ist ' + r[0].h.id + ')');
  // Bueroumgebung + Geld/Rechnung -> BEC oben
  var r2 = IR.framework.suggest('law_office', ['money_fraud'], { q_money: 'ja' });
  ok(r2[0].h.id === 'bec', 'Top-Hypothese BEC bei Rechnungsbetrug');
  // Maus bewegt sich + legitime Fernwartung=ja -> benign hoch bewertet
  var r3 = IR.framework.suggest('rail_signal', ['remote_seen'], { q_remote: 'ja', q_remote_legit: 'ja' });
  ok(r3.some(function (x) { return x.h.id === 'benign_misconfig' && x.score > 0; }), 'Benigne Erklaerung wird gewichtet');
});

group('Framework: Playbook-Generierung', function () {
  var sel = { envId: 'sawmill', impactIds: ['safety_event', 'machine_weird'], hypothesisId: 'ot_manipulation', answers: { q_safety: 'ja' } };
  var pb = IR.framework.buildPlaybook(sel);
  ok(pb.phases[0].id === 'verifikation', 'Gate als erste Phase');
  ['triage', 'comms', 'forensik', 'eindaemmung', 'bereinigung', 'wiederanlauf', 'ermittlung', 'abschluss'].forEach(function (need) {
    ok(pb.phases.some(function (p) { return p.id === need; }), 'Phase ' + need + ' vorhanden');
  });
  // Step-IDs eindeutig & Refs gueltig
  var seen = {}, dup = 0, toolSteps = 0;
  pb.phases.forEach(function (ph) { ph.steps.forEach(function (s) {
    if (seen[s.id]) dup++; seen[s.id] = 1;
    if (s.type === 'comms') ok(IR.comms[s.commsId], 'comms-Ref gueltig (' + s.commsId + ')');
    if (s.type === 'tool') { toolSteps++; ok(IR.toolkit.some(function (t) { return t.id === s.toolId; }), 'tool-Ref gueltig (' + s.toolId + ')'); }
  }); });
  ok(dup === 0, 'generierte Step-IDs eindeutig');
  ok(toolSteps > 0, 'Tools im Playbook platziert');
  // KRITIS-Umgebung -> BSI-Meldung enthalten
  var commsIds = []; pb.phases.forEach(function (ph) { ph.steps.forEach(function (s) { if (s.commsId) commsIds.push(s.commsId); }); });
  ok(commsIds.indexOf('kritis_bsi') >= 0, 'KRITIS-Umgebung -> BSI-Meldung');
  // Forensische Entscheidungskriterien + Restore-Begleitung + Beweise-vor-Restore
  var fore = pb.phases.filter(function (p) { return p.id === 'forensik'; })[0];
  ok(fore.steps.some(function (s) { return /Worauf achten/.test(s.do || ''); }), 'Beweise nennen Entscheidungskriterien (worauf achten)');
  ok(fore.steps.some(function (s) { return /-decide-/.test(s.id) && /Entscheidungskriterien/.test(s.do || ''); }), 'Entscheidungs-Stufe in Forensik');
  var wied = pb.phases.filter(function (p) { return p.id === 'wiederanlauf'; })[0];
  ok(wied.steps[0] && /Beweissicherung VOR Restore/.test(wied.steps[0].title), 'Beweissicherung-vor-Restore als erster Wiederanlauf-Schritt');
  ok(wied.steps.some(function (s) { return /Go-Live-Entscheidung/.test(s.title); }), 'Begleiteter Wiederanlauf inkl. Go-Live-Entscheidung');

  // Voller Durchlauf -> Report
  var c = IR.Case.create({ playbookId: pb.id, title: pb.title }); c.playbook = pb;
  IR.Case.setFlag(c, 'status', 'confirmed');
  pb.phases.forEach(function (ph) { IR.engine.visibleSteps(ph, c).forEach(function (s) {
    if (['check', 'evidence', 'comms', 'tool'].indexOf(s.type) >= 0) c.checks[s.id] = true;
  }); });
  var md = IR.report.markdown(c);
  ok(/Incident-Report/.test(md) && /Durchgefuehrte Massnahmen/.test(md), 'Report fuer generiertes Playbook');
  ok(IR.engine.progress(pb, c).pct === 100, 'Fortschritt 100% nach Durchlauf');
});

group('Native-Schicht (Browser-Fallback)', function () {
  ok(IR.native && IR.native.isNative() === false, 'im Node/Browser nicht nativ');
  ok(IR.native.platform() === 'web', 'Plattform = web ohne Bruecke');
  var caps = IR.native.capabilities();
  ok(caps.length >= 4, '>=4 Faehigkeiten (Capture/Scan/Flash/USB)');
  ok(caps.every(function (x) { return x.id && x.name && x.webHint; }), 'jede Faehigkeit hat Web-Fallback-Hinweis');
  ok(caps.some(function (x) { return x.id === 'capture'; }) && caps.some(function (x) { return x.id === 'flash'; }), 'Capture + Flash vorhanden');
  ok(IR.native.run('capture') === false, 'native Aktion ohne Bruecke -> false');
  ok(IR.native.save('x.txt', 'y') === false, 'save ohne Bruecke -> false');
  // Mit simulierter Bruecke
  var called = {};
  globalThis.AndroidIR = { platform: function () { return 'android-34'; }, startCapture: function () { called.cap = 1; }, saveFile: function () { called.save = 1; }, exportAsset: function (n) { called.kit = n; return true; } };
  delete require.cache[require.resolve('../js/native.js')]; require('../js/native.js');
  ok(IR.native.isNative() === true, 'mit Bruecke nativ');
  ok(IR.native.platform() === 'android-34', 'Plattform von Bruecke');
  ok(IR.native.run('capture') === true && called.cap === 1, 'native Capture ausgefuehrt');
  ok(IR.native.exportKit() === true && called.kit === 'ir-pilot-kit.zip', 'Kit-Export ruft native exportAsset');
  delete globalThis.AndroidIR;
  delete require.cache[require.resolve('../js/native.js')]; require('../js/native.js');
});

group('Forensik-Hosts (bis 10)', function () {
  var H = IR.hosts;
  ok(H && H.MAX === 10, 'Maximum 10 Hosts');
  ok(H.DASH_PIN === '1374', 'Dashboard-PIN = 1374');
  H.list().slice().forEach(function (h) { H.remove(h.id); });
  ok(H.list().length === 0, 'Start ohne Hosts');
  var a = H.add({ label: 'Kasse', base: '10.13.37.1:8080', token: 'abc' });
  ok(a.id && a.base === 'http://10.13.37.1:8080', 'Adresse normalisiert (http, ohne Slash)');
  ok(H.get(a.id).label === 'Kasse', 'Host abrufbar');
  H.update(a.id, { token: 'xyz', label: 'Kasse-PC' });
  ok(H.get(a.id).token === 'xyz' && H.get(a.id).label === 'Kasse-PC', 'Host aktualisiert');
  ok(H.downloadUrl(a, 'intake/x.zip').indexOf('t=xyz') >= 0 && H.downloadUrl(a, 'intake/x.zip').indexOf('path=intake') >= 0, 'Download-URL mit Token+Pfad');
  ok(H.intakeUrl(a, 'r.json').indexOf('/api/intake?') >= 0, 'Intake-URL gebaut');
  var thrown = false; try { H.add({ base: '' }); } catch (e) { thrown = true; }
  ok(thrown, 'leere Adresse abgelehnt');
  for (var i = 0; i < 9; i++) H.add({ base: '10.0.0.' + i + ':8080', token: 't' });
  ok(H.list().length === 10, '10 Hosts moeglich');
  var capped = false; try { H.add({ base: '10.0.0.99:8080' }); } catch (e) { capped = true; }
  ok(capped, '11. Host abgelehnt (Cap 10)');
  H.list().slice().forEach(function (h) { H.remove(h.id); });
  ok(H.list().length === 0, 'aufgeraeumt');
});

group('Fotos & PDF-Bericht', function () {
  var c = IR.Case.create({ playbookId: 'ransomware', title: 'Foto-Test' });
  var p = IR.Case.addPhoto(c, { name: 'Kasse.jpg', host: 'Kasse-PC', dataUrl: 'data:image/jpeg;base64,AAAA', note: 'Display schwarz' });
  ok(c.photos.length === 1 && p.id, 'Foto erfasst');
  ok(c.timeline.some(function (t) { return /Foto\/Screenshot erfasst/.test(t.text); }), 'Foto im Verlauf protokolliert');
  var html = IR.report.printableHTML(c);
  ok(typeof html === 'string' && /Incident-Report/.test(html) && /Foto-Test/.test(html), 'PDF-HTML enthaelt Report');
  ok(/Fotos &amp;? ?Screenshots/.test(html) && html.indexOf('data:image/jpeg;base64,AAAA') >= 0, 'PDF-HTML bindet Foto ein');
  IR.Case.removePhoto(c, p.id);
  ok(c.photos.length === 0, 'Foto entfernt');
});

group('KI-Assistent (Request)', function () {
  var A = IR.assistant;
  ok(A && A.SUGGESTIONS.some(function (s) { return /SIPROTEC 4/.test(s); }), 'SIPROTEC-4-Beispielfrage vorhanden');
  ok(A.enabled() === false, 'ohne Key nicht bereit');
  A.setConfig({ apiKey: 'sk-ant-test', model: 'claude-opus-4-8' });
  ok(A.enabled() === true, 'mit Key bereit');
  var req = A.buildRequest([{ role: 'user', content: 'SIPROTEC 4 Logs offline sichern?' }]);
  ok(req.url === 'https://api.anthropic.com/v1/messages', 'Messages-Endpoint');
  ok(req.opts.headers['x-api-key'] === 'sk-ant-test', 'API-Key im Header');
  ok(req.opts.headers['anthropic-dangerous-direct-browser-access'] === 'true', 'Browser-Access-Header gesetzt');
  ok(req.opts.headers['anthropic-version'] === '2023-06-01', 'API-Version gesetzt');
  var body = JSON.parse(req.opts.body);
  ok(body.model === 'claude-opus-4-8', 'Modell uebernommen');
  ok(typeof body.system === 'string' && /SIPROTEC/.test(body.system), 'System-Prompt mit OT/SIPROTEC');
  ok(body.max_tokens >= 2048, 'max_tokens ausreichend fuer lange Antworten');
  ok(body.messages.length === 1 && body.messages[0].role === 'user', 'Nachricht im Body');
});

group('Tabletop-Übung', function () {
  var T = IR.tabletop;
  ok(T.scenarios().length === 9, '9 Szenarien');
  ok(T.audiences.length === 3, '3 Zielgruppen (mgmt/tech/mixed)');
  var mgmt = T.build({ scenarioId: 'ransomware', audience: 'mgmt' });
  var tech = T.build({ scenarioId: 'ransomware', audience: 'tech' });
  var mix = T.build({ scenarioId: 'ransomware', audience: 'mixed' });
  ok(mgmt.injects.length >= 5 && tech.injects.length >= 5, 'mgmt/tech haben Injects');
  ok(mix.injects.length >= mgmt.injects.length, 'mixed >= mgmt');
  ok(mgmt.injects.every(function (i) { return i.situation.indexOf('{oneLiner}') < 0; }), 'Szenario-Kontext eingesetzt');
  // scenario-conditional inject
  ok(mgmt.injects.some(function (i) { return i.id === 'ransom'; }), 'Ransom-Inject bei Ransomware');
  ok(!T.build({ scenarioId: 'phishing-wave', audience: 'mgmt' }).injects.some(function (i) { return i.id === 'ransom'; }), 'kein Ransom-Inject bei Phishing');
  // scoring + outputs
  var rec = {}; mix.injects.forEach(function (i, n) { rec[i.id] = { rating: n % 4, response: 'r' + n }; });
  var sc = T.score(mix, rec);
  ok(sc.rated === mix.injects.length && sc.pct >= 0 && sc.pct <= 100, 'Score berechnet (' + sc.pct + '%)');
  ok(T.improvements(mix, rec).length > 0, 'Verbesserungen aus schwachen Injects');
  var body = T.reportBody(mix, rec);
  ok(/IR-Plan/.test(body) && /Man.{0,2}verkritik/.test(body) && /Verbesserungen/.test(body), 'Report enthaelt alle 3 Teile');
  ok(/Ransomware/.test(body), 'Report bezieht Szenario ein');
});

group('Speicher-Quota (Daten-Sicherheit)', function () {
  var realLs = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  var memBackup = IR._mem;
  // Fake-localStorage, das bei setItem eine Quota-Exception wirft
  globalThis.localStorage = { _d: { ir_pilot_cases: '[]' }, getItem: function (k) { return this._d[k] || null; }, setItem: function () { throw new Error('QuotaExceededError'); } };
  var c = IR.Case.create({ playbookId: 'ransomware', title: 'Quota' });
  var ok1 = IR.store.save(c);
  ok(ok1 === false, 'save() meldet false bei Quota (kein Absturz)');
  ok(IR.store.quotaError === true, 'quotaError-Flag gesetzt');
  ok(IR.store.list().length >= 0, 'list() bleibt benutzbar nach Quota');
  if (realLs) Object.defineProperty(globalThis, 'localStorage', realLs); else { try { delete globalThis.localStorage; } catch (e) { globalThis.localStorage = undefined; } }
  IR._mem = memBackup; IR.store.quotaError = false;
});

group('IDS-Datenquelle & Ingest (Assets/Vulns/Alerts)', function () {
  var c = IR.Case.create({ playbookId: 'ransomware', title: 'IDS-Test' });
  var bundle = {
    source: 'mein-ids',
    assets: [{ name: 'KASSE-01', ip: '10.20.0.21', type: 'POS', os: 'Windows 10', criticality: 'hoch' },
             { name: 'KASSE-01', ip: '10.20.0.21' }],  // Dublette -> 1
    vulns: [{ asset: 'KASSE-01', cve: 'CVE-2024-12345', cvss: 9.8, severity: 'kritisch', title: 'RCE' }],
    alerts: [{ ts: '2026-06-21T10:00:00Z', signature: 'C2 Beacon', severity: 'high', src_ip: '10.20.0.21', dest_ip: '203.0.113.66' }]
  };
  var r = IR.ingest.merge(c, bundle);
  ok(r.assets === 1 && c.assets.length === 1, 'Asset uebernommen + dedupliziert');
  ok(r.vulns === 1 && c.vulns[0].cve === 'CVE-2024-12345', 'Schwachstelle uebernommen');
  ok(r.iocs >= 2 && c.iocs.some(function (x) { return x.value === '203.0.113.66'; }), 'IDS-Alert-IPs als IOC');
  ok(c.timeline.some(function (t) { return t.kind === 'ids' && /C2 Beacon/.test(t.text); }), 'Alert in Zeitachse');
  ok(c.timeline.some(function (t) { return /Kritische Schwachstelle/.test(t.text); }), 'kritische Vuln protokolliert');
  var md = IR.report.markdown(c);
  ok(/Asset-Inventar & Schwachstellen/.test(md) && /KASSE-01/.test(md) && /CVE-2024-12345/.test(md), 'Bericht listet Assets/Vulns');

  var S = IR.sources;
  S.list().slice().forEach(function (s) { S.remove(s.id); });
  var src = S.add({ label: 'Mein-IDS', url: 'ids.local/api/export', token: 'tok' });
  ok(src.url === 'http://ids.local/api/export', 'URL normalisiert');
  var req = S.buildRequest(src);
  ok(req.opts.headers.Authorization === 'Bearer tok', 'Token als Bearer-Header');
  ok(S.toBundle([{ name: 'A', ip: '1.2.3.4' }], 'x').assets.length === 1, 'reines Array -> Asset-Liste');
  ok(S.toBundle({ vulnerabilities: [{ cve: 'X' }] }, 'x').vulns.length === 1, 'Alias vulnerabilities->vulns');
  // Discovery-Helfer
  ok(S.PORT === 8244, 'IDS-Port 8244');
  var ips = S.expandBase('192.168.1');
  ok(ips.indexOf('192.168.1.1') >= 0 && ips.indexOf('192.168.1.254') >= 0 && ips.length >= 254, 'expandBase erzeugt /24');
  ok(S.expandBase('10.0.0.5').indexOf('10.0.0.5') >= 0, 'expandBase einzelne IP');
  S.add({ label: 'x', url: 'http://192.168.7.50:8244/api/ir-pilot/export' });
  ok(S.guessSubnet() === '192.168.7', 'guessSubnet aus vorhandener Quelle');
  S.list().slice().forEach(function (s) { S.remove(s.id); });
});

function finish() { console.log('\n' + passes + ' ok, ' + fails + ' fail'); process.exit(fails ? 1 : 0); }

// Async: Datenquelle abrufen (pullInto) gegen simuliertes IDS
function sourcesAsync() {
  var S = IR.sources;
  globalThis.fetch = function (url, opts) {
    var auth = opts && opts.headers && opts.headers.Authorization;
    return Promise.resolve({ ok: !!auth, status: auth ? 200 : 401,
      json: function () { return Promise.resolve({ source: 'ids', assets: [{ name: 'SRV1', ip: '10.0.0.9' }], vulns: [{ cve: 'CVE-1', severity: 'hoch' }] }); } });
  };
  var c = IR.Case.create({ playbookId: 'ransomware', title: 'Pull-Test' });
  var src = S.add({ label: 'IDS', url: 'http://ids/api', token: 'tok' });
  return S.pullInto(src, c).then(function (r) {
    ok(r.assets === 1 && r.vulns === 1 && c.assets[0].name === 'SRV1', 'pullInto holt + merged Assets/Vulns');
    S.list().slice().forEach(function (s) { S.remove(s.id); });
    delete globalThis.fetch;
  });
}

// Async: IDS-Discovery (Port 8244) – genau eine IP "antwortet"
function discoveryAsync() {
  var S = IR.sources;
  globalThis.fetch = function (url) {
    // Appliance: LAN-HTTPS auf 443, Token noetig (401). Andere offline.
    if (url === 'https://192.168.5.42/api/ir-pilot/export') return Promise.resolve({ status: 401 });
    return Promise.reject(new Error('nope'));
  };
  return S.discover('192.168.5', { timeout: 50, concurrency: 64 }).then(function (found) {
    ok(found.length === 1 && found[0].ip === '192.168.5.42' && found[0].needsToken === true, 'Discovery findet IDS (https:443)');
    ok(found[0].url === 'https://192.168.5.42/api/ir-pilot/export' && found[0].scheme === 'https', 'Discovery bevorzugt LAN-HTTPS');
    delete globalThis.fetch;
  });
}

// Async: Assistent ask() gegen simulierte Anthropic-API
function assistantAsync() {
  globalThis.fetch = function (url, opts) {
    var auth = opts && opts.headers && opts.headers['x-api-key'];
    return Promise.resolve({ ok: !!auth, status: auth ? 200 : 401,
      json: function () { return Promise.resolve(auth ? { content: [{ type: 'text', text: '1. Spannungsfrei? 2. DIGSI offline...' }] } : { error: { message: 'auth' } }); } });
  };
  IR.assistant.setConfig({ apiKey: 'sk-ant-test', model: 'claude-sonnet-4-6' });
  return IR.assistant.ask([{ role: 'user', content: 'SIPROTEC 4?' }]).then(function (txt) {
    ok(/DIGSI/.test(txt), 'Assistent liefert Antworttext');
    delete globalThis.fetch;
  });
}

// ---- Cloud-Sync (Git als Speicher), mit simuliertem GitHub-fetch ----
function fakeGitHub() {
  var store = {};  // path -> {sha, content}
  globalThis.fetch = function (url, opts) {
    opts = opts || {}; var method = opts.method || 'GET';
    function res(ok, status, json) { return Promise.resolve({ ok: ok, status: status, json: function () { return Promise.resolve(json); } }); }
    if (url.indexOf('raw.githubusercontent.com') >= 0) {
      var rm = url.match(/\/main\/(.+?)\?/); var rp = rm && rm[1];
      var rf = store[rp];
      return res(!!rf, rf ? 200 : 404, rf ? JSON.parse(rf.content) : { incidents: [] });
    }
    var m = url.match(/\/contents\/([^?]+)/); var path = m && decodeURIComponent(m[1]);
    if (method === 'GET') {
      var f = store[path];
      if (!f) return res(false, 404, {});
      return res(true, 200, { sha: f.sha, content: Buffer.from(f.content, 'utf8').toString('base64') });
    }
    if (method === 'PUT') {
      var body = JSON.parse(opts.body);
      var content = Buffer.from(body.content, 'base64').toString('utf8');
      store[path] = { sha: 'sha' + (Object.keys(store).length + 1), content: content };
      return res(true, 200, { content: { path: path } });
    }
    return res(false, 405, {});
  };
  return store;
}

group('Cloud-Sync (Git-Speicher)', function () {
  var C = IR.cloud;
  ok(C && C.DASH_PIN === '1374', 'Dashboard-PIN 1374');
  ok(C.config().owner === 'go2dach' && C.config().repo === 'Apk---tests', 'Pfad vorbelegt (aenderbar)');
  ok(C.enabled() === false, 'ohne Token nicht aktiv (trotz vorbelegtem Pfad)');
  C.setConfig({ owner: 'go2dach', repo: 'data-repo', branch: 'main', token: 'ghp_x' });
  ok(C.enabled() === true, 'mit Owner/Repo/Token aktiv');
  ok(C.apiUrl('cloud/incidents/index.json').indexOf('api.github.com/repos/go2dach/data-repo/contents/') >= 0, 'API-URL korrekt');
  ok(C.rawUrl('cloud/incidents/index.json').indexOf('raw.githubusercontent.com/go2dach/data-repo/main/') >= 0, 'raw-URL korrekt');
  ok(C.dashboardUrl() === 'https://go2dach.github.io/data-repo/dashboard.html', 'Dashboard-URL korrekt');
  var c = IR.Case.create({ playbookId: 'generic', title: 'Cloud-Test', org: 'Muster GmbH', classification: 'TLP:AMBER' });
  c.playbook = IR.engine.playbook('generic');
  var snap = C.snapshot(c, [{ path: 'intake/x.zip', size: 10, host: 'Kasse', url: 'http://h/download' }]);
  ok(snap.id === c.id && snap.title === 'Cloud-Test' && snap.files.length === 1, 'Snapshot mit Datei-Verweis');
  ok(typeof snap.report === 'string' && snap.report.indexOf('Incident-Report') >= 0, 'Snapshot enthaelt Report');
  ok(typeof snap.phase === 'string' && snap.phase.length > 0, 'Snapshot enthaelt Playbook-Phase (' + snap.phase + ')');
  ok(C.indexEntry(snap).phase === snap.phase, 'Index-Eintrag traegt Phase fuers Dashboard');
  ok(C.indexEntry(snap).files === 1 && C.indexEntry(snap).report === undefined, 'Index-Eintrag schlank (Datei-Anzahl, kein Report)');
});

group('Auto-Discovery & Host-Befunde', function () {
  var H = IR.hosts;
  H.list().slice().forEach(function (h) { H.remove(h.id); });
  ok(H.candidates().indexOf('http://10.13.37.1:8080') >= 0, 'netup-Default-Kandidat enthalten');
  var a = H.adopt('http://10.13.37.1:8080', { name: 'Stick-1' });
  ok(a && a.token === '' && a.label === 'Stick-1', 'adopt legt Host ohne Token an');
  ok(H.adopt('http://10.13.37.1:8080', {}).id === a.id, 'adopt doppelt -> selber Host');
  H.list().slice().forEach(function (h) { H.remove(h.id); });
});

// Async: discover() + fetchFileText() gegen simulierten Control-Server
function hostFindingsAsync() {
  var H = IR.hosts;
  globalThis.fetch = function (url) {
    function res(ok, status, json, text) {
      return Promise.resolve({ ok: ok, status: status,
        headers: { get: function (k) { return k.toLowerCase() === 'content-type' ? (json ? 'application/json' : 'text/plain') : ''; } },
        json: function () { return Promise.resolve(json); }, text: function () { return Promise.resolve(text); } });
    }
    if (url.indexOf('10.13.37.1:8080/api/info') >= 0) return res(true, 200, { app: 'ir-pilot-control', name: 'Stick-1' });
    if (url.indexOf('/api/info') >= 0) return Promise.reject(new Error('nope'));
    if (url.indexOf('/download') >= 0) return res(true, 200, null, 'BEFUND-INHALT');
    return res(false, 404, {});
  };
  return H.discover(['http://10.13.37.1:8080', 'http://1.2.3.4:8080']).then(function (found) {
    ok(found.length === 1 && found[0].base === 'http://10.13.37.1:8080', 'discover findet genau 1 Host');
    ok(found[0].info && found[0].info.name === 'Stick-1', 'discover liefert Host-Info');
    var hh = H.adopt(found[0].base, found[0].info);
    return H.fetchFileText(hh, 'intake/win-ingest.json').then(function (t) {
      ok(t === 'BEFUND-INHALT', 'fetchFileText laedt Datei-Inhalt (fuers Playbook-Feeding)');
      H.list().slice().forEach(function (h) { H.remove(h.id); });
      delete globalThis.fetch;
    });
  });
}

var store = fakeGitHub();
IR.cloud.publish(IR.Case.create({ playbookId: 'generic', title: 'Publish-Test', org: 'X' }), [])
  .then(function (r) {
    ok(r && r.ok === true, 'publish meldet ok');
    ok(Object.keys(store).some(function (p) { return /cloud\/incidents\/.+\.json/.test(p) && p.indexOf('index') < 0; }), 'Fall-Snapshot geschrieben');
    var idx = store['cloud/incidents/index.json'];
    ok(idx && JSON.parse(idx.content).incidents.length === 1, 'Index enthaelt 1 Vorfall');
    return IR.cloud.pullIndex();
  })
  .then(function (idx) {
    ok(idx && idx.incidents && idx.incidents.length === 1, 'pullIndex liest Vorfall (raw)');
    ok(idx.incidents[0].title === 'Publish-Test', 'pullIndex Titel korrekt');
    delete globalThis.fetch;
    return hostFindingsAsync();
  })
  .then(function () { return assistantAsync(); })
  .then(function () { return sourcesAsync(); })
  .then(function () { return discoveryAsync(); })
  .then(function () { finish(); })
  .catch(function (e) { ok(false, 'Cloud/Host Async Exception: ' + (e && e.stack || e)); delete globalThis.fetch; finish(); });
