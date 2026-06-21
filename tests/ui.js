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
    ok(IR && IR.playbooks.length === 6, 'IR geladen, 6 Playbooks');
    ok(d.querySelectorAll('.pbcard').length === 6, 'Home zeigt 6 Szenario-Karten');

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

    console.log('\nUI: ' + passes + ' ok, ' + fails + ' fail');
    process.exit(fails ? 1 : 0);
  } catch (e) {
    console.log('  FAIL: Exception', e && e.stack || e);
    process.exit(1);
  }
}
setTimeout(function () { console.log('  FAIL: Timeout (load nicht ausgeloest)'); process.exit(1); }, 8000);
