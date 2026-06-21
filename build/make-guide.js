/* IR-Pilot – erzeugt mit Puppeteer:
 *   dist/IR-Pilot_Anleitung.pdf  (komplette Bedienanleitung mit Screenshots)
 *   dist/IR-Pilot_Testplan.pdf   (manueller Testplan + "wo hakt es")
 *   dist/guide-*.png             (Screenshots aller Ansichten, Fold-5-Viewport)
 *
 * Nutzt das gebuendelte Chromium aus dem Puppeteer-Cache (kein Snap noetig).
 */
'use strict';
var path = require('path'), fs = require('fs'), http = require('http');
var puppeteer = require('puppeteer');
var ROOT = path.join(__dirname, '..'), DIST = path.join(ROOT, 'dist');
fs.mkdirSync(DIST, { recursive: true });
var fileUrl = function (p) { return 'file://' + p; };

// Mini-Static-Server (nur fuer dashboard.html – fetch() funktioniert nicht ueber file://)
function serveRoot(port) {
  var CT = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
  var srv = http.createServer(function (req, res) {
    var rel = decodeURIComponent(req.url.split('?')[0]); if (rel === '/') rel = '/index.html';
    var full = path.normalize(path.join(ROOT, rel));
    if (full.indexOf(ROOT) !== 0 || !fs.existsSync(full) || fs.statSync(full).isDirectory()) { res.writeHead(404); return res.end('nf'); }
    res.writeHead(200, { 'Content-Type': CT[path.extname(full)] || 'application/octet-stream' });
    fs.createReadStream(full).pipe(res);
  });
  return new Promise(function (resolve) { srv.listen(port, '127.0.0.1', function () { resolve(srv); }); });
}

function findChrome() {
  try { var e = puppeteer.executablePath(); if (e && typeof e === 'string' && fs.existsSync(e)) return e; } catch (x) {}
  var bases = ['/root/.cache/puppeteer/chrome', path.join(process.env.HOME || '/root', '.cache/puppeteer/chrome')];
  for (var i = 0; i < bases.length; i++) {
    if (!fs.existsSync(bases[i])) continue;
    var dirs = fs.readdirSync(bases[i]);
    for (var j = 0; j < dirs.length; j++) {
      var c = path.join(bases[i], dirs[j], 'chrome-linux64', 'chrome');
      if (fs.existsSync(c)) return c;
    }
  }
  return null;
}

function esc(s) { return String(s == null ? '' : s).replace(/[&<>]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]; }); }
function img(file) { return 'data:image/png;base64,' + fs.readFileSync(path.join(DIST, file)).toString('base64'); }

(async function () {
  var exe = findChrome();
  if (!exe) { console.error('Kein Chromium gefunden (Puppeteer-Cache leer).'); process.exit(1); }
  var browser = await puppeteer.launch({ headless: 'new', executablePath: exe, args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--font-render-hinting=none'] });
  var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  try {
    var page = await browser.newPage();
    await page.setViewport({ width: 430, height: 900, deviceScaleFactor: 2, isMobile: true });

    var n = 0;
    async function shot(file, opts) {
      opts = opts || {};
      await page.goto(fileUrl(path.join(ROOT, opts.html || 'index.html')) + '?g=' + (n++) + (opts.hash || ''), { waitUntil: 'networkidle0' });
      if (opts.setup) await page.evaluate(opts.setup);
      await sleep(opts.wait || 450);
      if (opts.scrollTo) await page.evaluate(function (sel) { var e = document.querySelector(sel); if (e) e.scrollIntoView({ block: 'center' }); }, opts.scrollTo);
      await sleep(200);
      await page.screenshot({ path: path.join(DIST, file), fullPage: !!opts.fullPage });
      console.log('shot', file);
    }

    // 1) Start
    await shot('guide-home.png', {});
    // 2) Assistent (Wizard) – Umgebung
    await shot('guide-wizard.png', { setup: function () { var b = document.querySelector('[data-act="wiz-start"]'); if (b) b.click(); } });
    // 3) Playbook gefuehrt (BEC-Demo)
    await shot('guide-playbook.png', { hash: '#demo-bec-iban' });
    // 4) Befunde aus Daten im Playbook (Forensik-Phase einscrollen)
    await shot('guide-findings.png', { hash: '#demo-bec-iban', scrollTo: '.findings' });
    // 5) Beweise & Chain of Custody
    await shot('guide-evidence.png', { hash: '#demo-ransomware/evidence' });
    // 6) Bericht & Daten-Import
    await shot('guide-report.png', { hash: '#demo-ad-bruteforce/report' });
    // 7) Forensik-Toolkit
    await shot('guide-tools.png', { hash: '#demo-ransomware/tools' });
    // 8) Geraete & Forensik (nativ)
    await shot('guide-native.png', { setup: function () { var b = document.querySelector('[data-act="goto-native"]'); if (b) b.click(); } });
    // 9) Forensik-Hosts (mit Beispiel-Host)
    await shot('guide-hosts.png', { setup: function () {
      try { IR.hosts.list().slice().forEach(function (h) { IR.hosts.remove(h.id); }); IR.hosts.add({ label: 'Kasse-PC', base: '10.13.37.1:8080', token: 'demo' }); } catch (e) {}
      var b = document.querySelector('[data-act="goto-hosts"]'); if (b) b.click();
    } });
    // 10) Live-Dashboard (mit Demo-Incident)
    await shot('guide-dashboard.png', { hash: '#demo-ransomware', setup: function () {
      var h = document.getElementById('home'); if (h) h.click();
      var b = document.querySelector('[data-act="goto-dashboard"]'); if (b) b.click();
    } });
    // 11) Cloud-Konfiguration (Pfad vorbelegt)
    await shot('guide-cloud.png', { setup: function () { var b = document.querySelector('[data-act="goto-cloud"]'); if (b) b.click(); } });

    // 12) Pages-Dashboard standalone – temporaer Beispieldaten einspielen
    var idxPath = path.join(ROOT, 'cloud', 'incidents', 'index.json');
    var incPath = path.join(ROOT, 'cloud', 'incidents', 'demo-ransom.json');
    var idxBak = fs.readFileSync(idxPath, 'utf8');
    var sampleIdx = { schema: 1, updated: '2026-06-21T12:00:00Z', incidents: [
      { id: 'demo-ransom', title: 'Ransomware – Kasse dunkel', org: 'SHK Muster GmbH', status: 'bestaetigt', severity: 'kritisch', progress: 65, done: 13, total: 20, files: 3, updated: '2026-06-21T12:00:00Z' },
      { id: 'demo-bec', title: 'BEC / IBAN-Betrug', org: 'Kanzlei Beispiel', status: 'suspected', severity: 'hoch', progress: 40, done: 8, total: 20, files: 1, updated: '2026-06-21T11:30:00Z' }
    ] };
    var sampleInc = { id: 'demo-ransom', title: 'Ransomware – Kasse dunkel', report: '# Incident-Report\n\nAlle Kassen dunkel, .locked-Dateien, Schattenkopien geloescht.',
      files: [{ path: 'intake/Kasse-PC-triage.zip', size: 4731000, host: 'Kasse-PC', url: '#' }, { path: 'images/kasse.E01', size: 256000000000, host: 'Stick-1', url: '#' }] };
    fs.writeFileSync(idxPath, JSON.stringify(sampleIdx, null, 2));
    fs.writeFileSync(incPath, JSON.stringify(sampleInc, null, 2));
    var srv = await serveRoot(8731);
    try {
      // ueber http laden (file:// erlaubt kein fetch) + PIN 1374 entsperren fuer Datei-Anzeige
      await page.goto('http://127.0.0.1:8731/dashboard.html?g=' + (n++), { waitUntil: 'networkidle0' });
      await sleep(500);
      await page.evaluate(function () {
        var o = document.querySelector('[data-open]'); if (o) o.click();
        var p = document.querySelector('#pin'); if (p) { p.value = '1374'; var u = document.querySelector('#unlock'); if (u) u.click(); }
      });
      await sleep(500);
      await page.screenshot({ path: path.join(DIST, 'guide-pages-dashboard.png'), fullPage: true });
      console.log('shot guide-pages-dashboard.png');
    } finally {
      srv.close();
      fs.writeFileSync(idxPath, idxBak);
      if (fs.existsSync(incPath)) fs.unlinkSync(incPath);
    }

    // ---------- Anleitung-PDF ----------
    var manual = require('./guide-content.js');
    var anlHtml = manual.anleitung(esc, img);
    var f1 = path.join(DIST, '_anl.html'); fs.writeFileSync(f1, anlHtml);
    var pp = await browser.newPage();
    await pp.goto(fileUrl(f1), { waitUntil: 'networkidle0' });
    await pp.pdf({ path: path.join(DIST, 'IR-Pilot_Anleitung.pdf'), format: 'A4', printBackground: true, margin: { top: '14mm', bottom: '12mm', left: '14mm', right: '14mm' } });
    fs.unlinkSync(f1);
    console.log('wrote dist/IR-Pilot_Anleitung.pdf');

    // ---------- Testplan-PDF ----------
    var tpHtml = manual.testplan(esc, img);
    var f2 = path.join(DIST, '_tp.html'); fs.writeFileSync(f2, tpHtml);
    var pt = await browser.newPage();
    await pt.goto(fileUrl(f2), { waitUntil: 'networkidle0' });
    await pt.pdf({ path: path.join(DIST, 'IR-Pilot_Testplan.pdf'), format: 'A4', printBackground: true, margin: { top: '14mm', bottom: '12mm', left: '14mm', right: '14mm' } });
    fs.unlinkSync(f2);
    console.log('wrote dist/IR-Pilot_Testplan.pdf');
  } finally {
    await browser.close();
  }
})().catch(function (e) { console.error(e); process.exit(1); });
