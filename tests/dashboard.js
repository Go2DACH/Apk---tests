/* IR-Pilot – Pages-Dashboard-Smoke (jsdom): laedt dashboard.html mit
 * simuliertem fetch (Cloud-Index + Incident), prueft Rendering und PIN-Gate. */
'use strict';
var fs = require('fs'), path = require('path');
var JSDOM = require('jsdom').JSDOM;

var INDEX = { schema: 1, updated: '2026-06-21T10:00:00Z', incidents: [
  { id: 'abc123', title: 'Ransomware Kasse', org: 'Muster GmbH', status: 'bestaetigt',
    severity: 'kritisch', progress: 60, done: 6, total: 10, files: 2, updated: '2026-06-21T10:00:00Z' }
] };
var INC = { id: 'abc123', title: 'Ransomware Kasse', report: '# Incident-Report\nDetails…',
  files: [{ path: 'intake/win.zip', size: 2048, host: 'Kasse-PC', url: 'http://10.13.37.1:8080/download?path=intake/win.zip' }] };

var html = fs.readFileSync(path.join(__dirname, '..', 'dashboard.html'), 'utf8');
var dom = new JSDOM(html, {
  runScripts: 'dangerously', resources: 'usable',
  url: 'https://example.github.io/repo/dashboard.html',
  beforeParse: function (w) {
    w.fetch = function (url) {
      var body = /index\.json/.test(url) ? INDEX : INC;
      return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve(body); } });
    };
  }
});

var fails = 0, passes = 0;
function ok(c, m) { if (c) passes++; else { fails++; console.log('  FAIL:', m); } }

dom.window.addEventListener('load', function () { setTimeout(run, 200); });

function run() {
  try {
    var d = dom.window.document;
    ok(/Aktive Incidents \(1\)/.test(d.body.innerHTML), 'zeigt 1 aktiven Incident');
    ok(/Ransomware Kasse/.test(d.body.innerHTML), 'Incident-Titel gerendert');
    ok(!!d.querySelector('#pin'), 'Dateien zunaechst PIN-gesperrt');

    // Details aufklappen -> ohne PIN gesperrt
    d.querySelector('[data-open="abc123"]').click();
    ok(/nach PIN-Eingabe sichtbar/.test(d.body.innerHTML), 'Details ohne PIN gesperrt');

    // Falsche PIN
    d.querySelector('#pin').value = '0000';
    d.querySelector('#unlock').click();
    ok(/Falsche PIN/.test(d.body.innerHTML), 'falsche PIN abgewiesen');

    // PIN 1374 entsperrt -> Datei-Verweis + Report sichtbar
    d.querySelector('#pin').value = '1374';
    d.querySelector('#unlock').click();
    setTimeout(function () {
      ok(/intake\/win\.zip/.test(d.body.innerHTML), 'Datei-Verweis nach PIN sichtbar');
      ok(/Incident-Report/.test(d.body.innerHTML), 'Report nach PIN sichtbar');
      console.log('\nDashboard: ' + passes + ' ok, ' + fails + ' fail');
      process.exit(fails ? 1 : 0);
    }, 100);
  } catch (e) {
    console.log('  FAIL: Exception', e && e.stack || e);
    process.exit(1);
  }
}
setTimeout(function () { console.log('  FAIL: Timeout'); process.exit(1); }, 8000);
