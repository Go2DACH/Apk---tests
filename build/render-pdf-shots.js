/* Rendert mit Puppeteer: Einsatzkarten-PDF, App-Screenshots (Demo) + Walkthrough-PDF. */
'use strict';
var path = require('path'), fs = require('fs');
var puppeteer = require('puppeteer');
var ROOT = path.join(__dirname, '..'), DIST = path.join(ROOT, 'dist');
fs.mkdirSync(DIST, { recursive: true });
var fileUrl = function (p) { return 'file://' + p; };

(async function () {
  var browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-gpu', '--font-render-hinting=none'] });
  try {
    // 1) Einsatzkarten -> PDF
    var page = await browser.newPage();
    await page.goto(fileUrl(path.join(DIST, 'einsatzkarten.html')), { waitUntil: 'networkidle0' });
    await page.pdf({ path: path.join(DIST, 'IR-Pilot_Einsatzkarten.pdf'), format: 'A4', printBackground: true, margin: { top: '10mm', bottom: '10mm', left: '8mm', right: '8mm' } });
    console.log('wrote dist/IR-Pilot_Einsatzkarten.pdf');

    // 2) App-Screenshots (Fold-5-naher Viewport)
    var shots = [
      { hash: '', view: 'Start (Szenario-Auswahl)', file: 'shot-home.png' },
      { hash: '#demo-bec-iban', view: 'Playbook gefuehrt (BEC)', file: 'shot-playbook.png' },
      { hash: '#demo-ransomware/tools', view: 'Forensik-Toolkit', file: 'shot-tools.png' },
      { hash: '#demo-ad-bruteforce/report', view: 'Bericht & Daten-Import', file: 'shot-report.png' }
    ];
    var p2 = await browser.newPage();
    await p2.setViewport({ width: 430, height: 920, deviceScaleFactor: 2, isMobile: true });
    for (var i = 0; i < shots.length; i++) {
      // eindeutiger Query-Parameter erzwingt echten Reload (Hash allein reicht nicht)
      await p2.goto(fileUrl(path.join(ROOT, 'index.html')) + '?s=' + i + shots[i].hash, { waitUntil: 'networkidle0' });
      await new Promise(function (r) { setTimeout(r, 500); });
      await p2.screenshot({ path: path.join(DIST, shots[i].file), fullPage: true });
      console.log('wrote dist/' + shots[i].file);
    }

    // 2b) Assistent (Wizard) – Umgebungsauswahl
    await p2.goto(fileUrl(path.join(ROOT, 'index.html')) + '?w=1', { waitUntil: 'networkidle0' });
    await p2.evaluate(function () { document.querySelector('[data-act="wiz-start"]').click(); });
    await new Promise(function (r) { setTimeout(r, 300); });
    await p2.screenshot({ path: path.join(DIST, 'shot-wizard.png'), fullPage: true });
    console.log('wrote dist/shot-wizard.png');
    shots.splice(1, 0, { view: 'Assistent: Umgebung & Beobachtung', file: 'shot-wizard.png' });

    // 3) Walkthrough-PDF aus den Screenshots
    var imgs = shots.map(function (s) {
      var b64 = fs.readFileSync(path.join(DIST, s.file)).toString('base64');
      return '<figure><img src="data:image/png;base64,' + b64 + '"><figcaption>' + s.view + '</figcaption></figure>';
    }).join('');
    var html = '<!doctype html><meta charset="utf-8"><style>' +
      'body{font:13px system-ui,Segoe UI,Roboto,sans-serif;color:#11202f;margin:0}' +
      'h1{color:#1f4e79;margin:0 0 4px}.lead{color:#567;margin:0 0 12px}' +
      '.grid{display:flex;flex-wrap:wrap;gap:14px;justify-content:center}' +
      'figure{margin:0;width:46%;text-align:center}img{width:100%;border:1px solid #ccd;border-radius:8px}' +
      'figcaption{font-weight:600;margin-top:6px}@page{size:A4;margin:12mm}' +
      '</style><div style="padding:16px">' +
      '<h1>IR-Pilot &ndash; Kurzueberblick</h1>' +
      '<p class="lead">Gefuehrtes Incident-Response-Tool, offline am Smartphone (USB-Stick/PWA). ' +
      'Szenario waehlen &rarr; Schritte abarbeiten &rarr; Beweise/IOCs/Meldungen erfassen &rarr; Bericht exportieren.</p>' +
      '<div class="grid">' + imgs + '</div></div>';
    var wf = path.join(DIST, '_walk.html'); fs.writeFileSync(wf, html);
    var p3 = await browser.newPage();
    await p3.goto(fileUrl(wf), { waitUntil: 'networkidle0' });
    await p3.pdf({ path: path.join(DIST, 'IR-Pilot_Walkthrough.pdf'), format: 'A4', printBackground: true });
    fs.unlinkSync(wf);
    console.log('wrote dist/IR-Pilot_Walkthrough.pdf');
  } finally {
    await browser.close();
  }
})().catch(function (e) { console.error(e); process.exit(1); });
