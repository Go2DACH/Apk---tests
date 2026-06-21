/* Erzeugt Einsatzkarten (eine Seite je Fall) als druckbares HTML.
 *   node build/make-cards.js   ->  dist/einsatzkarten.html
 * Im Browser oeffnen -> "Als PDF drucken" (eine Karte pro Seite).
 */
'use strict';
var fs = require('fs'), path = require('path');
require('../js/core.js'); require('../data/playbooks.js'); require('../data/comms.js');
var IR = globalThis.IR;
function esc(s){ return String(s==null?'':s).replace(/[&<>]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;'}[c];}); }
function li(arr){ return arr.map(function(x){return '<li>'+esc(x)+'</li>';}).join(''); }

var cards = IR.playbooks.map(function(pb){
  var verif = (pb.phases.filter(function(p){return p.id==='verifikation';})[0]||{steps:[]}).steps
    .filter(function(s){return (s.type==='check'||s.type==='choice') && !/-v-b/.test(s.id);})
    .map(function(s){return s.title;});
  var triageSteps = (pb.phases.filter(function(p){return p.id==='triage';})[0]||{steps:[]}).steps
    .filter(function(s){return s.type==='check'||s.type==='choice';})
    .map(function(s){return s.title;});
  var triage = verif.concat(triageSteps).slice(0,7);
  var comms = (pb.phases.filter(function(p){return p.id==='comms';})[0]||{steps:[]}).steps
    .filter(function(s){return s.type==='comms';})
    .map(function(s){ var t=IR.comms[s.commsId]||{}; return (t.audience||s.title)+(t.frist?'  ['+t.frist+']':''); });
  var forensik = (pb.phases.filter(function(p){return p.id==='forensik';})[0]||{steps:[]}).steps
    .filter(function(s){return s.type==='evidence';})
    .map(function(s){ return s.evidence.name+'  ('+(s.evidence.volatility||'')+')'; });
  return '<section class="card sev-'+(pb.severity==='kritisch'?'crit':pb.severity==='hoch'?'high':'med')+'">' +
    '<div class="hd"><span class="sev">'+esc(pb.severity)+'</span><h2>'+esc(pb.title)+'</h2></div>' +
    '<p class="cat">'+esc(pb.category)+'</p>' +
    '<p class="one">'+esc(pb.oneLiner)+'</p>' +
    '<div class="cols">' +
      '<div><h3>Sofortmassnahmen</h3><ol>'+li(triage)+'</ol></div>' +
      '<div><h3>Meldewege &amp; Fristen</h3><ul>'+li(comms)+'</ul>' +
        '<h3>Beweise zuerst (Volatilitaet)</h3><ul>'+li(forensik)+'</ul></div>' +
    '</div>' +
    '<p class="foot">IR-Pilot Einsatzkarte · Reihenfolge: Sicherheit &gt; fluechtige Beweise &gt; Eindaemmung. Asservate hashen + Chain of Custody.</p>' +
    '</section>';
}).join('\n');

var html = '<!doctype html><html lang="de"><head><meta charset="utf-8">' +
  '<title>IR-Pilot Einsatzkarten</title><style>' +
  'body{font:13px/1.4 system-ui,Segoe UI,Roboto,sans-serif;color:#11202f;margin:0}' +
  '.card{page-break-after:always;padding:20px 24px;min-height:96vh;box-sizing:border-box;border-top:8px solid #888}' +
  '.sev-crit{border-color:#d11}.sev-high{border-color:#e67e00}.sev-med{border-color:#caa200}' +
  '.hd{display:flex;align-items:center;gap:10px}.hd h2{margin:0;font-size:21px}' +
  '.sev{font-size:11px;font-weight:800;text-transform:uppercase;color:#fff;background:#888;padding:3px 9px;border-radius:10px}' +
  '.sev-crit .sev{background:#d11}.sev-high .sev{background:#e67e00}.sev-med .sev{background:#caa200}' +
  '.cat{color:#567;margin:4px 0}.one{font-size:15px;font-weight:600;margin:8px 0 14px}' +
  '.cols{display:flex;gap:24px}.cols>div{flex:1}' +
  'h3{font-size:13px;color:#1f4e79;margin:12px 0 4px;border-bottom:1px solid #dde;padding-bottom:2px}' +
  'ol,ul{margin:4px 0 4px 18px;padding:0}li{margin:3px 0}' +
  '.foot{margin-top:18px;font-size:11px;color:#789;border-top:1px dashed #ccd;padding-top:6px}' +
  '@page{size:A4;margin:12mm}@media print{.card{min-height:auto}}' +
  '</style></head><body>'+cards+'</body></html>';

var out = path.join(__dirname,'..','dist'); fs.mkdirSync(out,{recursive:true});
var f = path.join(out,'einsatzkarten.html'); fs.writeFileSync(f, html);
console.log('wrote', path.relative(path.join(__dirname,'..'),f), '('+IR.playbooks.length+' Karten)');
