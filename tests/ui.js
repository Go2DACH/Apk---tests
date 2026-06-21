/* IR-Pilot – UI-Smoke-Test mit jsdom: laedt index.html, erzeugt einen Fall,
 * rendert alle Ansichten, simuliert Klicks (Check, Choice, IOC) ohne Fehler. */
'use strict';
var fs = require('fs'), path = require('path');
var JSDOM = require('jsdom').JSDOM;

var html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
var dom = new JSDOM(html, {
  runScripts: 'dangerously',
  resources: 'usable',
  url: 'file://' + path.join(__dirname, '..') + '/',
  beforeParse: function (w) {
    w.confirm = function () { return true; };
    w.prompt = function () { return 'Polizei XY'; };
    w.alert = function () {};
    w.scrollTo = function () {};
    Object.defineProperty(w.HTMLElement.prototype, 'scrollIntoView', { value: function () {}, writable: true });
    w.URL.createObjectURL = function () { return 'blob:x'; };
    w.URL.revokeObjectURL = function () {};
  }
});

var fails = 0, passes = 0;
function ok(c, m) { if (c) passes++; else { fails++; console.log('  FAIL:', m); } }

dom.window.addEventListener('load', function () {
  setTimeout(run, 200);
});

function run() {
  try {
    var w = dom.window, d = w.document, IR = w.IR;
    ok(IR && IR.playbooks.filter(function (p) { return p.id !== 'generic'; }).length === 9, 'IR geladen, 9 kuratierte Playbooks');
    ok(d.querySelectorAll('.pbcard').length === 9, 'Home zeigt 9 Szenario-Karten');
    ok(IR.environments.length >= 50 && IR.hypotheses.length >= 15, 'Kataloge geladen (>=50 Umgebungen, >=15 Hypothesen)');

    // Fall 1 (BEC) anlegen
    var becCard = [].slice.call(d.querySelectorAll('.pbcard')).filter(function (b) { return b.dataset.id === 'bec-iban'; })[0];
    becCard.click();
    ok(d.querySelector('.derivation'), 'Playbook-Ansicht mit forensischer Ableitung');
    ok(d.querySelectorAll('.phase').length >= 6, 'Phasen gerendert');

    // ersten Check abhaken
    var chk = d.querySelector('[data-act="toggle"]');
    chk.click();
    ok(d.querySelector('.step.done'), 'Check als erledigt markiert');

    // Choice setzen (mailbox kompromittiert)
    var opt = d.querySelector('[data-act="choice"]');
    if (opt) { opt.click(); ok(d.querySelector('.opt.sel'), 'Choice-Option ausgewaehlt'); }

    // Navigation durch alle Tabs
    ['evidence', 'ioc', 'comms', 'tools', 'report'].forEach(function (v) {
      [].slice.call(d.querySelectorAll('.nav-btn')).filter(function (b) { return b.dataset.view === v; })[0].click();
      ok(d.querySelector('#app').innerHTML.length > 50, 'Ansicht ' + v + ' gerendert');
    });

    // IOC hinzufuegen
    [].slice.call(d.querySelectorAll('.nav-btn')).filter(function (b) { return b.dataset.view === 'ioc'; })[0].click();
    d.querySelector('#iocVal').value = 'LT12 3456 7890';
    d.querySelector('[data-act="ioc-add"]').click();
    ok(/LT12/.test(d.querySelector('#app').innerHTML), 'IOC erscheint in Liste');

    // Befund erscheint automatisch im Playbook (Forensik-Phase)
    [].slice.call(d.querySelectorAll('.nav-btn')).filter(function (b) { return b.dataset.view === 'pb'; })[0].click();
    ok(!!d.querySelector('.findings') && /Befunde aus Daten/.test(d.querySelector('#app').innerHTML), 'Befunde aus Daten im Playbook sichtbar');
    ok(/LT12/.test(d.querySelector('.findings').innerHTML), 'importierter IOC steht im Forensik-Befund');

    // Beweise-Ansicht: Foto-Bereich vorhanden
    [].slice.call(d.querySelectorAll('.nav-btn')).filter(function (b) { return b.dataset.view === 'evidence'; })[0].click();
    ok(/Fotos &(amp;)? Screenshots/.test(d.querySelector('#app').innerHTML) && !!d.querySelector('[data-act="photo-cam"]') && !!d.querySelector('[data-act="photo-pick"]'), 'Foto-Bereich in Beweise');

    // Comms protokollieren
    [].slice.call(d.querySelectorAll('.nav-btn')).filter(function (b) { return b.dataset.view === 'comms'; })[0].click();
    var clog = d.querySelector('[data-act="comm-log"]');
    if (clog) { clog.click(); }

    // Tools sichtbar mit Skript
    [].slice.call(d.querySelectorAll('.nav-btn')).filter(function (b) { return b.dataset.view === 'tools'; })[0].click();
    ok(d.querySelectorAll('.tool').length >= 5, 'Tools-Ansicht listet Skripte');

    // Bericht enthaelt Kernabschnitte
    [].slice.call(d.querySelectorAll('.nav-btn')).filter(function (b) { return b.dataset.view === 'report'; })[0].click();
    var rep = d.querySelector('.report').textContent;
    ok(/Incident-Report/.test(rep) && /Chain of Custody/.test(rep), 'Bericht gerendert');
    ok(!!d.querySelector('[data-act="rep-pdf"]'), 'PDF-Bericht-Button vorhanden');
    ok(typeof IR.report.printableHTML === 'function', 'printableHTML verfuegbar');

    // ---- Assistent (Wizard) durchspielen ----
    d.querySelector('#home').click();
    d.querySelector('[data-act="wiz-start"]').click();
    ok(d.querySelector('.wizsteps'), 'Wizard gestartet (Schrittanzeige)');
    d.querySelector('[data-act="wiz-env"]').click();          // Umgebung waehlen
    d.querySelector('[data-act="wiz-next"]').click();          // -> Beobachtung
    d.querySelector('[data-act="wiz-impact"]').click();        // Impact waehlen
    d.querySelector('[data-act="wiz-next"]').click();          // -> Fragebogen
    d.querySelector('[data-act="wiz-next"]').click();          // -> Vermutung
    ok(d.querySelector('.hypitem'), 'Wizard zeigt Hypothesen-Vorschlag');
    d.querySelector('[data-act="wiz-generate"]').click();      // Playbook erzeugen
    ok(d.querySelector('.derivation'), 'Generiertes Playbook wird angezeigt');
    ok(IR.store.list().some(function (x) { return x.playbook && x.playbook.generated; }), 'Generierter Fall gespeichert');

    // ---- Geraete/Native-Ansicht (Browser-Fallback) ----
    d.querySelector('#home').click();
    d.querySelector('[data-act="goto-native"]').click();
    ok(d.querySelectorAll('.nativecap').length >= 4, 'Geraete-Ansicht zeigt Faehigkeiten');
    ok(/Browser/.test(d.querySelector('#app').innerHTML), 'zeigt Plattform/Fallback (Browser)');
    ok(!!d.querySelector('[data-act="kit-export"]') && /Werkzeug-Kit/.test(d.querySelector('#app').innerHTML), 'Kit-Download in Geraete-Ansicht');

    // ---- Forensik-Hosts: hinzufuegen (bis 10) ----
    d.querySelector('#home').click();
    d.querySelector('[data-act="goto-hosts"]').click();
    ok(/Forensik-Hosts/.test(d.querySelector('#app').innerHTML), 'Hosts-Ansicht');
    d.querySelector('#hLabel').value = 'Kasse-PC';
    d.querySelector('#hBase').value = '10.13.37.1:8080';
    d.querySelector('#hToken').value = 'tok123';
    d.querySelector('[data-act="host-add"]').click();
    ok(d.querySelectorAll('.hostcard').length === 1 && /10\.13\.37\.1:8080/.test(d.querySelector('#app').innerHTML), 'Host erscheint in Liste');
    ok(IR.hosts.list().length === 1, 'Host persistiert');

    // ---- Live-Dashboard: PIN-Gate (1374) ----
    d.querySelector('#home').click();
    d.querySelector('[data-act="goto-dashboard"]').click();
    ok(/Live-Dashboard/.test(d.querySelector('#app').innerHTML), 'Dashboard-Ansicht');
    ok(!!d.querySelector('#dashPin'), 'Dateien zunaechst PIN-gesperrt');
    d.querySelector('#dashPin').value = '0000';
    d.querySelector('[data-act="dash-unlock"]').click();
    ok(/Falsche PIN/.test(d.querySelector('#app').innerHTML), 'falsche PIN abgewiesen');
    d.querySelector('#dashPin').value = '1374';
    d.querySelector('[data-act="dash-unlock"]').click();
    ok(!d.querySelector('#dashPin') && /Sperren/.test(d.querySelector('#app').innerHTML), 'PIN 1374 entsperrt Downloads');
    IR.hosts.list().slice().forEach(function (h) { IR.hosts.remove(h.id); });

    // ---- Cloud-Konfiguration (Git-Speicher) ----
    d.querySelector('#home').click();
    d.querySelector('[data-act="goto-cloud"]').click();
    ok(/Cloud/.test(d.querySelector('#app').innerHTML) && !!d.querySelector('#clOwner'), 'Cloud-Ansicht mit Formular');
    d.querySelector('#clOwner').value = 'go2dach';
    d.querySelector('#clRepo').value = 'data-repo';
    d.querySelector('#clToken').value = 'ghp_demo';
    d.querySelector('[data-act="cloud-save"]').click();
    ok(IR.cloud.enabled() === true && IR.cloud.config().owner === 'go2dach', 'Cloud-Config persistiert + aktiv');
    ok(/data-repo\/dashboard.html/.test(d.querySelector('#app').innerHTML), 'Dashboard-Link gezeigt');
    IR.cloud.setConfig({ owner: '', repo: '', token: '' });

    // ---- KI-Assistent ----
    d.querySelector('#home').click();
    d.querySelector('[data-act="goto-assistant"]').click();
    ok(/Assistent/.test(d.querySelector('#app').innerHTML) && !!d.querySelector('#asstKey'), 'Assistent-Ansicht mit Key-Feld');
    ok(/SIPROTEC 4/.test(d.querySelector('#app').innerHTML), 'SIPROTEC-Beispielfrage angezeigt');
    d.querySelector('#asstKey').value = 'sk-ant-demo';
    d.querySelector('[data-act="asst-save"]').click();
    ok(IR.assistant.enabled() === true, 'Assistent-Key gespeichert');
    IR.assistant.setConfig({ apiKey: '' });

    console.log('\nUI: ' + passes + ' ok, ' + fails + ' fail');
    process.exit(fails ? 1 : 0);
  } catch (e) {
    console.log('  FAIL: Exception', e && e.stack || e);
    process.exit(1);
  }
}
setTimeout(function () { console.log('  FAIL: Timeout (load nicht ausgeloest)'); process.exit(1); }, 8000);
