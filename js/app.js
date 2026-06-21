/* IR-Pilot – UI-Controller (Vanilla JS, mobile-first, offline-faehig). */
(function () {
  'use strict';
  var IR = window.IR, U = IR.util, $ = function (s, r) { return (r || document).querySelector(s); };
  var state = { caseId: null, view: 'home' };
  var c = null; // aktueller Fall

  function save() { if (c) IR.store.save(c); }
  function setCase(id) { c = IR.store.get(id); state.caseId = id; state.view = 'pb'; render(); }
  function go(v) { state.view = v; render(); }

  function toast(msg) {
    var t = $('#toast'); t.textContent = msg; t.className = 'show';
    setTimeout(function () { t.className = ''; }, 1800);
  }
  function copy(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () { toast('Kopiert'); }, fallback);
      } else fallback();
    } catch (e) { fallback(); }
    function fallback() {
      var ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta);
      ta.select(); try { document.execCommand('copy'); toast('Kopiert'); } catch (e) {}
      document.body.removeChild(ta);
    }
  }
  function download(name, text, mime) {
    var blob = new Blob([text], { type: mime || 'text/plain' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); document.body.removeChild(a); }, 500);
  }

  /* ----------------------------------------------------------- Rendering */
  function render() {
    var root = $('#app');
    $('#caseTitle').textContent = c ? c.title : 'IR-Pilot';
    $('#caseTag').textContent = c ? (c.classification || '') : '';
    $('#nav').style.display = c ? 'flex' : 'none';
    Array.prototype.forEach.call(document.querySelectorAll('.nav-btn'), function (b) {
      b.classList.toggle('active', b.dataset.view === state.view);
    });
    if (!c) return root.innerHTML = (state.view === 'wizard' ? viewWizard()
      : state.view === 'native' ? viewNative()
      : state.view === 'tools' ? viewTools() : viewHome());
    var v = state.view;
    if (v === 'home') root.innerHTML = viewHome();
    else if (v === 'wizard') root.innerHTML = viewWizard();
    else if (v === 'native') root.innerHTML = viewNative();
    else if (v === 'pb') root.innerHTML = viewPlaybook();
    else if (v === 'evidence') root.innerHTML = viewEvidence();
    else if (v === 'ioc') root.innerHTML = viewIoc();
    else if (v === 'comms') root.innerHTML = viewComms();
    else if (v === 'tools') root.innerHTML = viewTools();
    else if (v === 'report') root.innerHTML = viewReport();
    else root.innerHTML = viewPlaybook();
  }

  function viewHome() {
    var cases = IR.store.list();
    var h = '<section class="card start"><h2>Neuer Vorfall</h2>' +
      '<p class="muted">Gefuehrter Start: Umgebung &amp; Beobachtung waehlen (ohne Technikwissen), Fragebogen beantworten – das Tool schlaegt eine Vermutung vor und baut das Playbook.</p>' +
      '<button class="bigbtn" data-act="wiz-start">▶ Gefuehrter Start (Assistent)</button>' +
      '<button class="mini" data-act="new" data-id="generic">Generisches Playbook starten</button>' +
      '<button class="mini" data-act="goto-native">📡 Geraete &amp; Forensik (nativ)</button></section>';
    h += '<section class="card"><h2>Schnellstart (Beispiele)</h2><div class="pbgrid">';
    IR.playbooks.filter(function (p) { return p.id !== 'generic'; }).forEach(function (p) {
      h += '<button class="pbcard" data-act="new" data-id="' + p.id + '">' +
        '<span class="sev sev-' + sevClass(p.severity) + '">' + U.esc(p.severity) + '</span>' +
        '<strong>' + U.esc(p.title) + '</strong>' +
        '<small>' + U.esc(p.category) + '</small>' +
        '<em>' + U.esc(p.oneLiner) + '</em></button>';
    });
    h += '</div></section>';
    h += '<section class="card"><h2>Offene Faelle</h2>';
    if (!cases.length) h += '<p class="muted">Noch keine Faelle.</p>';
    cases.slice().reverse().forEach(function (x) {
      var pb = IR.Case.playbook(x);
      var pr = pb ? IR.engine.progress(pb, x) : { pct: 0 };
      h += '<div class="row caseitem"><button class="link" data-act="open" data-id="' + x.id + '">' +
        '<strong>' + U.esc(x.title) + '</strong><small>' + U.fmtTs(x.createdAt) + ' · ' + pr.pct + ' %</small></button>' +
        '<button class="icon" data-act="del" data-id="' + x.id + '" title="loeschen">✕</button></div>';
    });
    h += '</section>';
    return h;
  }

  /* --------------------------------------------------------- Assistent */
  function wiz() { return state.wiz || (state.wiz = { step: 0, q: '', envId: null, impactIds: [], answers: {}, hypId: null }); }
  function viewWizard() {
    var w = wiz();
    var names = ['Umgebung', 'Beobachtung', 'Fragebogen', 'Vermutung'];
    var head = '<section class="card"><div class="wizsteps">' + names.map(function (t, i) {
      return '<span class="' + (i === w.step ? 'on' : (i < w.step ? 'done' : '')) + '">' + (i + 1) + '. ' + t + '</span>';
    }).join('') + '</div></section>';
    return head + [wizEnv, wizImpact, wizQuestions, wizHypo][w.step](w);
  }
  function wizEnv(w) {
    var q = (w.q || '').toLowerCase(), groups = IR.catalog.groups();
    var h = '<section class="card"><h2>1. Welche Umgebung?</h2>' +
      '<input id="wizq" placeholder="Suchen (z.B. Brauerei, Saegewerk, Feuerwehr)" value="' + U.esc(w.q || '') + '">';
    Object.keys(groups).forEach(function (g) {
      var items = groups[g].filter(function (e) { return !q || e.name.toLowerCase().indexOf(q) >= 0 || g.toLowerCase().indexOf(q) >= 0; });
      if (!items.length) return;
      h += '<div class="wgroup"><h3>' + U.esc(g) + '</h3><div class="chips">' + items.map(function (e) {
        return '<button class="chip ' + (w.envId === e.id ? 'sel' : '') + '" data-act="wiz-env" data-id="' + e.id + '">' + U.esc(e.name) + '</button>';
      }).join('') + '</div></div>';
    });
    return h + '</section><div class="wnav"><button class="mini" data-act="wiz-cancel">Abbrechen</button>' +
      '<button class="bigbtn" data-act="wiz-next"' + (w.envId ? '' : ' disabled') + '>Weiter ▶</button></div>';
  }
  function wizImpact(w) {
    var h = '<section class="card"><h2>2. Was wurde beobachtet?</h2><p class="muted">Mehrfachauswahl moeglich (Kundensicht).</p><div class="chips col">';
    IR.impacts.forEach(function (im) {
      h += '<button class="chip ' + (w.impactIds.indexOf(im.id) >= 0 ? 'sel' : '') + '" data-act="wiz-impact" data-id="' + im.id + '">' + U.esc(im.name) + '</button>';
    });
    return h + '</div></section><div class="wnav"><button class="mini" data-act="wiz-back">◀ Zurueck</button>' +
      '<button class="bigbtn" data-act="wiz-next"' + (w.impactIds.length ? '' : ' disabled') + '>Weiter ▶</button></div>';
  }
  function wizQuestions(w) {
    var env = IR.catalog.env(w.envId), qs = IR.visibleQuestions(env, w.answers);
    var h = '<section class="card"><h2>3. Kurzer Fragebogen</h2>';
    qs.forEach(function (q) {
      h += '<div class="qitem"><div class="qq">' + U.esc(q.q) + '</div>';
      if (q.type === 'text') h += '<input data-wizans="' + q.id + '" value="' + U.esc(w.answers[q.id] || '') + '">';
      else if (q.type === 'yesno') ['ja', 'nein'].forEach(function (v) { h += '<button class="chip ' + (w.answers[q.id] === v ? 'sel' : '') + '" data-act="wiz-ans" data-id="' + q.id + '" data-v="' + v + '">' + (v === 'ja' ? 'Ja' : 'Nein') + '</button>'; });
      else q.options.forEach(function (o, i) { h += '<button class="chip ' + (String(w.answers[q.id]) === String(i) ? 'sel' : '') + '" data-act="wiz-ans" data-id="' + q.id + '" data-v="' + i + '">' + U.esc(o.label) + '</button>'; });
      h += '</div>';
    });
    return h + '</section><div class="wnav"><button class="mini" data-act="wiz-back">◀ Zurueck</button><button class="bigbtn" data-act="wiz-next">Vermutung ▶</button></div>';
  }
  function wizHypo(w) {
    var ranked = IR.framework.suggest(w.envId, w.impactIds, w.answers);
    if (!w.hypId && ranked.length) w.hypId = ranked[0].h.id;
    var max = ranked.length ? ranked[0].score : 1;
    var h = '<section class="card"><h2>4. Erste Vermutung</h2><p class="muted">Vorschlag auf Basis deiner Angaben – frei anpassbar.</p>';
    ranked.forEach(function (r) {
      h += '<button class="hypitem ' + (w.hypId === r.h.id ? 'sel' : '') + '" data-act="wiz-hyp" data-id="' + r.h.id + '">' +
        '<div class="row"><strong>' + U.esc(r.h.name) + '</strong><span class="badge">' + r.score + '</span></div>' +
        '<div class="bar"><div style="width:' + Math.round(r.score * 100 / max) + '%"></div></div>' +
        '<small>' + U.esc(r.h.tech) + '</small></button>';
    });
    if (!ranked.length) h += '<p class="muted">Keine eindeutige Vermutung – generisches Playbook nutzen.</p>';
    return h + '</section><div class="wnav"><button class="mini" data-act="wiz-back">◀ Zurueck</button><button class="bigbtn" data-act="wiz-generate">Playbook erzeugen ✓</button></div>';
  }

  function viewNative() {
    var n = IR.native, isN = n.isNative(), plat = n.platform();
    var h = '<section class="card"><h2>Geraete &amp; Forensik</h2>' +
      '<div class="row"><span class="badge">' + (isN ? 'APK · ' + plat : 'Browser · ' + plat) + '</span>' +
      '<button class="mini" data-act="native-reload">Daten aktualisieren</button>' +
      '<button class="mini" data-act="goto-home">‹ Start</button></div>' +
      '<p class="muted">' + (isN
        ? 'Native Aktionen verfuegbar – privilegierte Forensik direkt vom Geraet.'
        : 'Im Browser sind privilegierte Aktionen gesperrt (Sandbox). Unten die Skripte/Anleitungen; in der APK laufen sie nativ.') + '</p></section>';
    n.capabilities().forEach(function (cap) {
      h += '<section class="card nativecap"><div class="row"><strong>' + cap.icon + ' ' + U.esc(cap.name) + '</strong>' +
        '<span class="badge">' + (cap.native && isN ? 'nativ' : 'manuell') + '</span></div>' +
        '<p class="muted">' + U.esc(cap.desc) + '</p>';
      if (isN && cap.native) {
        h += '<button class="mini" data-act="native-run" data-id="' + cap.id + '">Ausfuehren (nativ)</button>';
      } else {
        h += '<small class="warn">' + U.esc(cap.webHint) + '</small>';
        if (cap.cmd) h += '<pre class="code">' + U.esc(cap.cmd) + '</pre>';
        if (cap.script) h += '<div><button class="mini" data-act="tool-open" data-id="' + U.esc(cap.script) + '">Skript: ' + U.esc(cap.script) + '</button></div>';
        if (cap.mobile) h += '<div><small>Datei auf dem Stick: <code>' + U.esc(cap.mobile) + '</code></small></div>';
      }
      h += '</section>';
    });
    return h + '<section class="card"><h3>Architektur</h3><p class="muted">Pages/PWA hält Daten &amp; UI · APK macht die Arbeit (Capture/Scan/Flash) · Ergebnisse via „Daten importieren" zurück in den Fall.</p></section>';
  }

  function viewPlaybook() {
    var pb = IR.Case.playbook(c);
    var pr = IR.engine.progress(pb, c);
    var h = '<section class="card meta">' +
      '<div class="row"><label>Organisation</label><input data-meta="org" value="' + U.esc(c.org) + '"></div>' +
      '<div class="row"><label>Responder</label><input data-meta="responder" value="' + U.esc(c.responder) + '"></div>' +
      '<div class="row"><label>Einstufung</label><select data-meta="classification">' +
        ['TLP:RED', 'TLP:AMBER', 'TLP:GREEN', 'TLP:CLEAR'].map(function (t) {
          return '<option' + (c.classification === t ? ' selected' : '') + '>' + t + '</option>';
        }).join('') + '</select></div>' +
      '<div class="progress"><div style="width:' + pr.pct + '%"></div></div>' +
      '<small class="muted">' + pr.done + '/' + pr.total + ' Massnahmen · ' + pr.pct + ' %</small>' +
      '</section>';
    h += '<section class="card derivation"><h3>Forensische Ableitung</h3>' + U.md(pb.derivation) + '</section>';
    pb.phases.forEach(function (ph) {
      var steps = IR.engine.visibleSteps(ph, c);
      var done = steps.filter(function (s) { return c.checks[s.id]; }).length;
      h += '<section class="card phase"><h2 class="phasehead">' + U.esc(ph.title) +
        ' <span class="badge">' + done + '/' + steps.length + '</span></h2>';
      steps.forEach(function (s) { h += renderStep(s); });
      h += '</section>';
    });
    return h;
  }

  function renderStep(s) {
    var checked = !!c.checks[s.id];
    var head = '<div class="step ' + (checked ? 'done' : '') + '" data-step="' + s.id + '">';
    var body = '<div class="stepbody">' + U.md(s.do || '') + '</div>';
    if (s.type === 'check' || s.type === 'note') {
      var box = s.type === 'check' ? '<button class="chk" data-act="toggle" data-id="' + s.id + '">' + (checked ? '✓' : '') + '</button>' : '<span class="dot">i</span>';
      return head + '<div class="steptop">' + box + '<strong>' + U.esc(s.title) + '</strong></div>' + body + '</div>';
    }
    if (s.type === 'input') {
      var val = c.answers[s.id] || '';
      var field = s.field.kind === 'textarea'
        ? '<textarea data-answer="' + s.id + '" placeholder="' + U.esc(s.field.label) + '">' + U.esc(val) + '</textarea>'
        : '<input data-answer="' + s.id + '" placeholder="' + U.esc(s.field.label) + '" value="' + U.esc(val) + '">';
      return head + '<div class="steptop"><span class="dot">✎</span><strong>' + U.esc(s.title) + '</strong></div>' + body + field + '</div>';
    }
    if (s.type === 'choice') {
      var opts = s.options.map(function (o, i) {
        var sel = c.flags[o.setFlag.k] === o.setFlag.v;
        return '<button class="opt ' + (sel ? 'sel' : '') + '" data-act="choice" data-id="' + s.id + '" data-i="' + i + '">' + U.esc(o.label) + '</button>';
      }).join('');
      return head + '<div class="steptop"><span class="dot">?</span><strong>' + U.esc(s.title) + '</strong></div>' + body + '<div class="opts">' + opts + '</div></div>';
    }
    if (s.type === 'evidence') {
      var btn = '<button class="chk" data-act="toggle" data-id="' + s.id + '">' + (checked ? '✓' : '') + '</button>';
      return head + '<div class="steptop">' + btn + '<strong>' + U.esc(s.title) + '</strong></div>' + body +
        '<button class="mini" data-act="ev-add" data-id="' + s.id + '">+ Beweis erfassen</button></div>';
    }
    if (s.type === 'comms') {
      var btn2 = '<button class="chk" data-act="toggle" data-id="' + s.id + '">' + (checked ? '✓' : '') + '</button>';
      return head + '<div class="steptop">' + btn2 + '<strong>' + U.esc(s.title) + '</strong></div>' + body +
        '<button class="mini" data-act="comm-open" data-id="' + s.commsId + '">Vorlage oeffnen</button></div>';
    }
    if (s.type === 'tool') {
      var btn3 = '<button class="chk" data-act="toggle" data-id="' + s.id + '">' + (checked ? '✓' : '') + '</button>';
      return head + '<div class="steptop">' + btn3 + '<strong>' + U.esc(s.title) + '</strong></div>' + body +
        '<button class="mini" data-act="tool-open" data-id="' + (s.toolId || '') + '">Tool oeffnen</button></div>';
    }
    return head + '<strong>' + U.esc(s.title) + '</strong>' + body + '</div>';
  }

  function viewEvidence() {
    var h = '<section class="card"><h2>Beweise & Chain of Custody</h2>' +
      '<button class="mini" data-act="ev-new">+ Neuer Beweis</button></section>';
    if (!c.evidence.length) h += '<p class="muted pad">Noch keine Beweise.</p>';
    c.evidence.forEach(function (e) {
      h += '<section class="card ev"><div class="row"><strong>' + U.esc(e.name) + '</strong><span class="badge">' + U.esc(e.type) + '</span></div>' +
        f('Quelle', e.id, 'source', e.source) +
        f('Methode', e.id, 'method', e.method) +
        f('SHA256', e.id, 'hash', e.hash) +
        f('Ablage (USB/Asservat)', e.id, 'location', e.location) +
        f('Fluechtigkeit', e.id, 'volatility', e.volatility) +
        '<div class="custody"><small>Chain of Custody:</small>';
      (e.custody || []).forEach(function (cc) { h += '<small>· ' + U.fmtTs(cc.ts) + ' ' + U.esc(cc.action) + ' → ' + U.esc(cc.by) + '</small>'; });
      h += '<button class="mini" data-act="custody" data-id="' + e.id + '">Uebergabe protokollieren</button></div></section>';
    });
    return h;
    function f(lbl, id, k, v) { return '<div class="row"><label>' + lbl + '</label><input data-ev="' + id + '" data-k="' + k + '" value="' + U.esc(v || '') + '"></div>'; }
  }

  function viewIoc() {
    var h = '<section class="card"><h2>IOCs</h2><div class="row">' +
      '<select id="iocType">' + ['ip', 'domain', 'url', 'hash', 'email', 'iban', 'host', 'sonstiges'].map(function (t) { return '<option>' + t + '</option>'; }).join('') + '</select>' +
      '<input id="iocVal" placeholder="Wert"></div>' +
      '<input id="iocNote" placeholder="Notiz"><button class="mini" data-act="ioc-add">+ IOC hinzufuegen</button></section>';
    c.iocs.forEach(function (x) { h += '<div class="card row"><strong>' + U.esc(x.type) + '</strong><code>' + U.esc(x.value) + '</code><small>' + U.esc(x.note || '') + '</small></div>'; });
    return h;
  }

  function viewComms() {
    var ctx = { org: c.org, responder: c.responder, date: U.fmtTs(U.nowISO()), summary: c.answers['summary'] || (IR.Case.playbook(c) || {}).oneLiner || '' };
    var h = '<section class="card"><h2>Krisenkommunikation</h2><p class="muted">Vorlagen mit Falldaten – pruefen, anpassen, ueber verifizierten Kanal senden.</p></section>';
    Object.keys(IR.comms).forEach(function (k) {
      var t = IR.comms[k];
      var body = IR.fillTemplate(t.body, ctx);
      h += '<section class="card comm" id="comm-' + k + '"><div class="row"><strong>' + U.esc(t.audience) + '</strong>' +
        '<span class="badge">' + U.esc(t.frist || '') + '</span></div>' +
        '<small class="muted">Kanal: ' + U.esc(t.channel) + '</small>' +
        '<div class="subject">' + U.esc(IR.fillTemplate(t.subject || '', ctx)) + '</div>' +
        '<pre class="tpl">' + U.esc(body) + '</pre>' +
        '<div class="row"><button class="mini" data-act="comm-copy" data-id="' + k + '">Kopieren</button>' +
        '<button class="mini" data-act="comm-log" data-id="' + k + '">Als gemeldet protokollieren</button></div></section>';
    });
    return h;
  }

  function viewTools() {
    var h = '<section class="card"><h2>Forensik-Toolkit</h2><p class="muted">Read-only Triage/Sicherung. Auf den USB-Stick legen, am Zielsystem ausfuehren.</p></section>';
    IR.toolkit.forEach(function (t) {
      h += '<section class="card tool" id="tool-' + U.esc(t.id) + '"><div class="row"><strong>' + U.esc(t.name) + '</strong><span class="badge">' + U.esc(t.os) + '</span></div>' +
        '<p>' + U.esc(t.purpose) + '</p><small class="warn">' + U.esc(t.safety) + '</small>' +
        '<details><summary>Skript anzeigen (' + U.esc(t.filename) + ')</summary><pre class="code">' + U.esc(t.script) + '</pre></details>' +
        '<div class="row"><button class="mini" data-act="tool-copy" data-id="' + t.id + '">Kopieren</button>' +
        '<button class="mini" data-act="tool-dl" data-id="' + t.id + '">Herunterladen</button></div></section>';
    });
    return h;
  }

  function viewReport() {
    var md = IR.report.markdown(c);
    return '<section class="card"><h2>Bericht & Daten</h2>' +
      '<div class="row"><button class="mini" data-act="rep-copy">Markdown kopieren</button>' +
      '<button class="mini" data-act="rep-dl">.md herunterladen</button>' +
      '<button class="mini" data-act="case-dl">Fall (JSON) exportieren</button>' +
      '<button class="mini" data-act="tl-csv">Timeline CSV</button>' +
      '<button class="mini" data-act="sitrep">Lagebericht</button></div>' +
      '<div class="row"><button class="mini" data-act="import-json">Daten importieren (JSON)</button>' +
      '<button class="mini" data-act="import-paste">Quick-Paste IOCs</button></div>' +
      '<small class="muted">Ingest-Bundles vom Smartphone/Desktop (mobile/desktop-Skripte) hier einlesen.</small></section>' +
      '<section class="card report">' + U.md(md) + '</section>';
  }

  function sevClass(s) { return s === 'kritisch' ? 'crit' : s === 'hoch' ? 'high' : 'med'; }

  /* -------------------------------------------------------------- Events */
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]'); if (!b) return;
    var act = b.dataset.act, id = b.dataset.id;
    // ---- Assistent ----
    if (act === 'wiz-start') { state.wiz = { step: 0, q: '', envId: null, impactIds: [], answers: {}, hypId: null }; state.view = 'wizard'; return render(); }
    if (act === 'wiz-cancel') { state.wiz = null; state.view = 'home'; return render(); }
    if (act === 'wiz-env') { wiz().envId = id; return render(); }
    if (act === 'wiz-impact') { var ii = wiz().impactIds, k = ii.indexOf(id); if (k >= 0) ii.splice(k, 1); else ii.push(id); return render(); }
    if (act === 'wiz-ans') { wiz().answers[id] = b.dataset.v; wiz().hypId = null; return render(); }
    if (act === 'wiz-hyp') { wiz().hypId = id; return render(); }
    if (act === 'wiz-next') { wiz().step++; return render(); }
    if (act === 'wiz-back') { wiz().step = Math.max(0, wiz().step - 1); return render(); }
    if (act === 'wiz-generate') { return wizGenerate(); }
    if (act === 'tool-open') { go('tools'); setTimeout(function () { var el = document.getElementById('tool-' + id); if (el) el.scrollIntoView(); }, 50); return; }
    if (act === 'goto-native') { state.view = 'native'; return render(); }
    if (act === 'goto-home') { state.caseId = null; c = null; state.view = 'home'; return render(); }
    if (act === 'native-run') { if (!IR.native.run(id)) toast('Nur in der APK nativ verfuegbar'); return; }
    if (act === 'native-reload') { IR.native.reloadData(); return; }
    if (act === 'new') {
      var pb = IR.engine.playbook(id);
      var nc = IR.Case.create({ playbookId: id, title: pb.title, sector: pb.category, classification: 'TLP:AMBER' });
      nc.playbook = pb;
      IR.Case.log(nc, 'note', 'Fall eroeffnet (' + pb.title + ')');
      IR.store.save(nc); setCase(nc.id);
    } else if (act === 'open') { setCase(id); }
    else if (act === 'del') { if (confirm('Fall loeschen?')) { IR.store.remove(id); render(); } }
    else if (act === 'toggle') { c.checks[id] = !c.checks[id]; IR.Case.log(c, 'action', (c.checks[id] ? 'erledigt: ' : 'offen: ') + stepTitle(id)); save(); render(); }
    else if (act === 'choice') { var st = findStep(id); var o = st.options[+b.dataset.i]; IR.Case.setFlag(c, o.setFlag.k, o.setFlag.v); save(); render(); }
    else if (act === 'ev-add') { var s2 = findStep(id); IR.Case.addEvidence(c, { name: s2.evidence.name, type: s2.evidence.type, volatility: s2.evidence.volatility, method: s2.evidence.method, collectedBy: c.responder }); c.checks[id] = true; save(); toast('Beweis angelegt – im Tab Beweise vervollstaendigen'); render(); }
    else if (act === 'ev-new') { IR.Case.addEvidence(c, { name: 'Neuer Beweis', collectedBy: c.responder }); save(); render(); }
    else if (act === 'custody') { var by = prompt('Uebergabe an / Aktion (z.B. „uebergeben an Polizei XY"):'); if (by) { IR.Case.custodyTransfer(c, id, 'uebergeben', by, ''); save(); render(); } }
    else if (act === 'comm-open') { go('comms'); setTimeout(function () { var el = document.getElementById('comm-' + id); if (el) el.scrollIntoView(); }, 50); }
    else if (act === 'comm-copy') { copy(IR.fillTemplate(IR.comms[id].subject + '\n\n' + IR.comms[id].body, ctxNow())); }
    else if (act === 'comm-log') { IR.Case.addComm(c, { audience: IR.comms[id].audience, channel: IR.comms[id].channel, status: 'gemeldet' }); markCommsStep(id); save(); toast('Protokolliert'); render(); }
    else if (act === 'ioc-add') { var v = $('#iocVal').value.trim(); if (v) { IR.Case.addIoc(c, $('#iocType').value, v, $('#iocNote').value.trim()); save(); render(); } }
    else if (act === 'tool-copy') { copy(tool(id).script); }
    else if (act === 'tool-dl') { var t = tool(id); download(t.filename, t.script); }
    else if (act === 'rep-copy') { copy(IR.report.markdown(c)); }
    else if (act === 'rep-dl') { download('incident-report-' + c.id + '.md', IR.report.markdown(c), 'text/markdown'); }
    else if (act === 'case-dl') { download('case-' + c.id + '.json', JSON.stringify(c, null, 2), 'application/json'); }
    else if (act === 'sitrep') { copy(IR.report.sitrep(c)); toast('Lagebericht kopiert'); }
    else if (act === 'tl-csv') { download('timeline-' + c.id + '.csv', IR.report.timelineCSV(c), 'text/csv'); }
    else if (act === 'import-json') { importFromFile(); }
    else if (act === 'import-paste') {
      var txt = prompt('IOCs/Text einfuegen (IPs, Hashes, E-Mails, IBANs, Domains, URLs werden erkannt):');
      if (txt) { var r = IR.ingest.merge(c, IR.ingest.fromText(txt)); save(); toast(r.iocs + ' IOCs importiert'); render(); }
    }
  });

  function importFromFile() {
    var inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json,application/json';
    inp.addEventListener('change', function () {
      var f = inp.files[0]; if (!f) return;
      var rd = new FileReader();
      rd.onload = function () {
        try {
          var b = JSON.parse(rd.result);
          var r = IR.ingest.merge(c, b); save();
          toast('Import: ' + r.iocs + ' IOCs, ' + r.evidence + ' Beweise');
          render();
        } catch (e) { toast('Import fehlgeschlagen (kein gueltiges JSON)'); }
      };
      rd.readAsText(f);
    });
    inp.click();
  }

  document.addEventListener('input', function (e) {
    var t = e.target;
    // Assistent (kein Fall aktiv)
    if (t.id === 'wizq') { wiz().q = t.value; var pos = t.selectionStart; render(); var e2 = document.getElementById('wizq'); if (e2) { e2.focus(); try { e2.setSelectionRange(pos, pos); } catch (_) {} } return; }
    if (t.dataset.wizans != null) { wiz().answers[t.dataset.wizans] = t.value; return; }
    if (!c) return;
    if (t.dataset.answer != null) { c.answers[t.dataset.answer] = t.value; save(); }
    else if (t.dataset.meta) { c[t.dataset.meta] = t.value; $('#caseTitle').textContent = c.title; $('#caseTag').textContent = c.classification || ''; save(); }
    else if (t.dataset.ev) { var ev = c.evidence.filter(function (x) { return x.id === t.dataset.ev; })[0]; if (ev) { ev[t.dataset.k] = t.value; save(); } }
  });
  document.addEventListener('change', function (e) {
    var t = e.target; if (c && t.dataset.meta) { c[t.dataset.meta] = t.value; save(); render(); }
  });

  function wizGenerate() {
    var w = wiz();
    var ranked = IR.framework.suggest(w.envId, w.impactIds, w.answers);
    var hypId = w.hypId || (ranked[0] && ranked[0].h.id) || 'endpoint_malware';
    var sel = { envId: w.envId, impactIds: w.impactIds.slice(), hypothesisId: hypId, answers: w.answers };
    var pb = IR.framework.buildPlaybook(sel);
    var env = IR.catalog.env(w.envId) || { name: '' };
    var nc = IR.Case.create({ playbookId: pb.id, title: pb.title, sector: pb.category, classification: 'TLP:AMBER' });
    nc.playbook = pb; nc.selection = sel;
    Object.keys(w.answers).forEach(function (k) { nc.answers[k] = w.answers[k]; });
    if (w.answers.q_what) nc.answers['summary'] = w.answers.q_what;
    var ev = IR.qeval(w.answers); Object.keys(ev.flags).forEach(function (k) { nc.flags[k] = ev.flags[k]; });
    IR.Case.log(nc, 'note', 'Fall via Assistent erzeugt (' + env.name + ' · ' + pb.category + ')');
    IR.store.save(nc); state.wiz = null; setCase(nc.id);
  }

  /* ------------------------------------------------------------- Helpers */
  function ctxNow() { return { org: c.org, responder: c.responder, date: U.fmtTs(U.nowISO()), summary: c.answers['summary'] || (IR.Case.playbook(c) || {}).oneLiner || '' }; }
  function tool(id) { return IR.toolkit.filter(function (t) { return t.id === id; })[0]; }
  function allSteps() { var pb = IR.Case.playbook(c), a = []; pb.phases.forEach(function (p) { (p.steps || []).forEach(function (s) { a.push(s); }); }); return a; }
  function findStep(id) { return allSteps().filter(function (s) { return s.id === id; })[0]; }
  function stepTitle(id) { var s = findStep(id); return s ? s.title : id; }
  function markCommsStep(commsId) { allSteps().forEach(function (s) { if (s.type === 'comms' && s.commsId === commsId) c.checks[s.id] = true; }); }

  // Nav
  Array.prototype.forEach.call(document.querySelectorAll('.nav-btn'), function (b) {
    b.addEventListener('click', function () { go(b.dataset.view); });
  });
  $('#home').addEventListener('click', function () { state.caseId = null; c = null; go('home'); });

  // Demo-Modus fuer Screenshots/Walkthrough:  index.html#demo-<playbookId>[/<view>]
  function seedDemo(id) {
    var pb = IR.engine.playbook(id); if (!pb) return;
    var nc = IR.Case.create({ playbookId: id, title: pb.title, sector: pb.category, org: 'Beispiel GmbH', responder: 'IR-Team', classification: 'TLP:AMBER' });
    IR.Case.answer(nc, 'summary', pb.oneLiner);
    var n = 0;
    pb.phases.forEach(function (ph) {
      IR.engine.visibleSteps(ph, nc).forEach(function (s) {
        if (s.type === 'choice') IR.Case.setFlag(nc, s.options[0].setFlag.k, s.options[0].setFlag.v);
        else if ((s.type === 'check' || s.type === 'evidence' || s.type === 'comms') && n++ % 2 === 0) {
          nc.checks[s.id] = true;
          if (s.type === 'evidence') IR.Case.addEvidence(nc, { name: s.evidence.name, type: s.evidence.type, volatility: s.evidence.volatility, method: s.evidence.method, hash: 'e3b0c44298fc1c149afbf4c8996fb924', location: 'USB:/evidence', collectedBy: 'IR-Team' });
          if (s.type === 'comms') IR.Case.addComm(nc, { audience: IR.comms[s.commsId].audience, status: 'gemeldet' });
        }
      });
    });
    IR.Case.addIoc(nc, 'iban', 'LT121000011101001000', 'Empfaengerkonto (Betrug)');
    IR.Case.addIoc(nc, 'ip', '203.0.113.66', 'C2');
    IR.store.save(nc); return nc.id;
  }
  var m = (location.hash || '').match(/^#demo-([a-z0-9\-]+)(?:\/(\w+))?/i);
  if (m) {
    var existing = IR.store.list().filter(function (x) { return x.playbookId === m[1] && /Beispiel GmbH/.test(x.org || ''); })[0];
    var did = existing ? existing.id : seedDemo(m[1]);
    if (did) { c = IR.store.get(did); state.caseId = did; state.view = m[2] || 'pb'; }
  }

  render();
})();
