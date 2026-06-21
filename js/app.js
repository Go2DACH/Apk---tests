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
      : state.view === 'dashboard' ? viewDashboard()
      : state.view === 'hosts' ? viewHosts()
      : state.view === 'cloud' ? viewCloud()
      : state.view === 'assistant' ? viewAssistant()
      : state.view === 'sources' ? viewSources()
      : state.view === 'tools' ? viewTools() : viewHome());
    var v = state.view;
    if (v === 'home') root.innerHTML = viewHome();
    else if (v === 'wizard') root.innerHTML = viewWizard();
    else if (v === 'native') root.innerHTML = viewNative();
    else if (v === 'dashboard') root.innerHTML = viewDashboard();
    else if (v === 'hosts') root.innerHTML = viewHosts();
    else if (v === 'cloud') root.innerHTML = viewCloud();
    else if (v === 'assistant') root.innerHTML = viewAssistant();
    else if (v === 'sources') root.innerHTML = viewSources();
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
      '<button class="mini" data-act="goto-native">📡 Geraete &amp; Forensik (nativ)</button>' +
      '<button class="mini" data-act="goto-hosts">🖧 Forensik-Hosts (bis 10)</button>' +
      '<button class="mini" data-act="goto-sources">🗄️ Datenquellen (IDS/Asset)</button>' +
      '<button class="mini" data-act="goto-dashboard">📊 Live-Dashboard</button>' +
      '<button class="mini" data-act="goto-cloud">☁️ Cloud &amp; Veroeffentlichen</button>' +
      '<button class="mini" data-act="goto-assistant">🤖 Assistent (KI-Fragen)</button></section>';
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
    h += '<section class="card"><div class="row"><strong>📦 Werkzeug-Kit (Boot-Stick · Windows · Server · App)</strong></div>' +
      '<p class="muted">Eine Quelle für alles On-Site: Forensik-Linux bauen (<code>build-live-iso.sh</code>), ' +
      '<code>control-server.py</code>, Windows-Sammler und die App selbst – ist in dieser App enthalten.</p>' +
      '<button class="bigbtn" data-act="kit-export">⤓ Kit herunterladen (auf USB/Speicher)</button>' +
      '<small class="muted">' + (isN ? 'Landet in „Downloads" – auf den USB-Stick kopieren.' : 'Speichert ir-pilot-kit.zip; auf USB entpacken.') + '</small></section>';
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

  /* ----------------------------------------------- Forensik-Hosts (bis 10) */
  function hostData(id) { return (state.hostData || (state.hostData = {}))[id] || (state.hostData[id] = {}); }
  function fmtBytes(n) { n = +n || 0; if (n < 1024) return n + ' B'; if (n < 1048576) return (n / 1024).toFixed(1) + ' KB'; if (n < 1073741824) return (n / 1048576).toFixed(1) + ' MB'; return (n / 1073741824).toFixed(2) + ' GB'; }

  function hostRefresh(id) {
    var h = IR.hosts.get(id); if (!h) return;
    var d = hostData(id); d.busy = true; d.err = null;
    IR.hosts.info(h).then(function (info) { d.info = info; return IR.hosts.files(h); })
      .then(function (fl) { d.files = (fl && fl.files) || []; d.busy = false; render(); })
      .catch(function (e) { d.busy = false; d.err = String(e && e.message || e); render(); });
    render();
  }
  function hostAction(id, action, args, label) {
    var h = IR.hosts.get(id); if (!h) return;
    var d = hostData(id); d.out = '▶ ' + (label || action) + ' …'; render();
    IR.hosts.run(h, action, args).then(function (out) {
      d.out = (typeof out === 'string') ? out : JSON.stringify(out);
      IR.hosts.files(h).then(function (fl) { d.files = (fl && fl.files) || []; render(); });
      render();
    }).catch(function (e) { d.out = 'Fehler: ' + (e && e.message || e); render(); });
  }

  // Forensik-Befunde (ingest.json) vom Host automatisch ins Playbook uebernehmen
  function hostMergeFindings(ids) {
    if (!c) { toast('Erst einen Fall oeffnen'); return; }
    var tot = { iocs: 0, evidence: 0, hosts: 0, notes: 0, timeline: 0 }, pending = 0, scanned = 0;
    var hosts = ids.map(function (id) { return IR.hosts.get(id); }).filter(Boolean);
    if (!hosts.length) return;
    toast('Lade Befunde …');
    hosts.forEach(function (host) {
      pending++;
      IR.hosts.files(host).then(function (fl) {
        var files = ((fl && fl.files) || []).filter(function (f) { return /ingest.*\.json$/i.test(f.path) || /\.ingest\.json$/i.test(f.path); });
        var chain = Promise.resolve();
        files.forEach(function (f) {
          chain = chain.then(function () {
            return IR.hosts.fetchFileText(host, f.path).then(function (txt) {
              try { var b = JSON.parse(txt); var r = IR.ingest.merge(c, b); scanned++; Object.keys(tot).forEach(function (k) { tot[k] += r[k] || 0; }); } catch (e) {}
            });
          });
        });
        return chain;
      }).catch(function () {}).then(function () {
        if (--pending === 0) {
          save();
          toast(scanned ? ('Befunde uebernommen: ' + tot.iocs + ' IOCs, ' + tot.evidence + ' Beweise, ' + tot.hosts + ' Hosts') : 'Keine ingest.json auf den Hosts gefunden');
          render();
        }
      });
    });
  }
  function hostDiscover() {
    toast('Suche Hosts (USB/Netz) …');
    IR.hosts.discover().then(function (found) {
      var added = 0;
      found.forEach(function (r) {
        var before = IR.hosts.list().length; IR.hosts.adopt(r.base, r.info);
        var hh = IR.hosts.list().filter(function (x) { return x.base === r.base; })[0];
        if (hh) hostData(hh.id).info = r.info;
        if (IR.hosts.list().length > before) added++;
      });
      toast(found.length ? (found.length + ' Host(s) gefunden, ' + added + ' neu – Token nachtragen') : 'Keine Hosts gefunden (USB/WLAN verbunden?)');
      render();
    }).catch(function () { toast('Discovery fehlgeschlagen'); });
  }

  function viewHosts() {
    var list = IR.hosts.list();
    var h = '<section class="card"><div class="row"><h2>🖧 Forensik-Hosts</h2>' +
      '<button class="mini" data-act="goto-home">‹ Start</button></div>' +
      '<p class="muted">Bis zu ' + IR.hosts.MAX + ' gesicherte Forensik-Sticks fernsteuern. Jeder Host = ein Boot-Stick mit <code>control-server.py</code>. Adresse + Token werden beim Start auf der Stick-Konsole angezeigt. Alle gesammelten Dateien laufen hier zusammen.</p>' +
      '<div class="row"><button class="mini" data-act="host-discover">🔌 USB/Netz: Hosts automatisch suchen</button>' +
      (c ? '<button class="mini" data-act="host-merge-all">⤵ Alle Befunde in Fall „' + U.esc(c.title) + '"</button>' : '<small class="muted">Fall oeffnen, um Befunde direkt ins Playbook zu uebernehmen.</small>') + '</div>';
    if (list.length < IR.hosts.MAX) {
      h += '<div class="hostadd"><div class="row"><input id="hLabel" placeholder="Name (z.B. Kasse-PC)"></div>' +
        '<div class="row"><input id="hBase" placeholder="IP:Port (z.B. 10.13.37.1:8080)"></div>' +
        '<div class="row"><input id="hToken" placeholder="Token"></div>' +
        '<button class="mini" data-act="host-add">+ Host hinzufuegen</button></div>';
    } else h += '<small class="warn">Maximum von ' + IR.hosts.MAX + ' Hosts erreicht.</small>';
    h += '<small class="muted">Verbunden: ' + list.length + '/' + IR.hosts.MAX + '</small></section>';

    list.forEach(function (host) {
      var d = hostData(host.id), info = d.info, online = info && info.evidenceCount != null;
      h += '<section class="card hostcard"><div class="row"><strong>' + U.esc(host.label) + '</strong>' +
        '<span class="badge">' + (d.busy ? '…' : (d.err ? 'offline' : (online ? 'online' : 'unverbunden'))) + '</span></div>' +
        '<small class="muted"><code>' + U.esc(host.base) + '</code>' + (online ? ' · ' + info.evidenceCount + ' Dateien · ' + fmtBytes(info.evidenceBytes) : '') + '</small>';
      if (d.err) h += '<small class="warn">' + U.esc(d.err) + ' – Adresse/Token pruefen, Handy &amp; Stick im selben Netz?</small>';
      h += '<div class="row"><button class="mini" data-act="host-refresh" data-id="' + host.id + '">Verbinden/Aktualisieren</button>' +
        (c ? '<button class="mini" data-act="host-merge" data-id="' + host.id + '">⤵ Befunde in Fall</button>' : '') +
        '<button class="icon" data-act="host-del" data-id="' + host.id + '" title="entfernen">✕</button></div>';
      // One-Click-Forensik
      h += '<div class="row"><input data-hdev="' + host.id + '" placeholder="/dev/sdb (fuer Image)" style="flex:1"></div>' +
        '<div class="row wrap">' +
        '<button class="mini" data-act="host-run" data-id="' + host.id + '" data-a="discover">Hosts finden</button>' +
        '<button class="mini" data-act="host-run" data-id="' + host.id + '" data-a="wireshark">Wireshark</button>' +
        '<button class="mini" data-act="host-run" data-id="' + host.id + '" data-a="image_disk">Image</button>' +
        '<button class="mini" data-act="host-run" data-id="' + host.id + '" data-a="collect_windows">Win-Triage</button>' +
        '<button class="mini" data-act="host-run" data-id="' + host.id + '" data-a="collect_linux">Linux-Triage</button>' +
        '<button class="mini" data-act="host-run" data-id="' + host.id + '" data-a="manifest">Manifest</button></div>';
      if (d.files && d.files.length) {
        h += '<details open><summary>' + d.files.length + ' Datei(en)</summary>';
        d.files.slice(0, 30).forEach(function (f) {
          h += '<div class="row"><a class="link" href="' + IR.hosts.downloadUrl(host, f.path) + '" target="_blank">' + U.esc(f.path) + '</a><small>' + fmtBytes(f.size) + '</small></div>';
        });
        h += '</details>';
      }
      if (d.out) h += '<pre class="code">' + U.esc(d.out.slice(-4000)) + '</pre>';
      h += '</section>';
    });
    return h;
  }

  /* ----------------------------------------------------- Live-Dashboard */
  function viewDashboard() {
    var cases = IR.store.list(), hosts = IR.hosts.list();
    var h = '<section class="card"><div class="row"><h2>📊 Live-Dashboard</h2>' +
      '<button class="mini" data-act="goto-home">‹ Start</button>' +
      '<button class="mini" data-act="dash-refresh">Alle Hosts aktualisieren</button></div>' +
      '<p class="muted">Laufende Vorfaelle &amp; verbundene Forensik-Hosts auf einen Blick. Dateien werden nach PIN-Eingabe zum Download freigeschaltet.</p></section>';

    h += '<section class="card"><h3>Aktive Incidents (' + cases.length + ')</h3>';
    if (!cases.length) h += '<p class="muted">Keine offenen Faelle.</p>';
    cases.slice().reverse().forEach(function (x) {
      var pb = IR.Case.playbook(x), pr = pb ? IR.engine.progress(pb, x) : { pct: 0, done: 0, total: 0 };
      var st = (x.flags && x.flags.status) || 'offen';
      var phase = IR.cloud && IR.cloud.currentPhase ? IR.cloud.currentPhase(x, pb) : '';
      h += '<div class="row caseitem"><button class="link" data-act="open" data-id="' + x.id + '"><strong>' + U.esc(x.title) + '</strong>' +
        '<small>' + U.esc(x.org || '') + ' · ' + U.esc(st) + (phase ? ' · ' + U.esc(phase) : '') + ' · ' + pr.done + '/' + pr.total + ' (' + pr.pct + ' %)</small></button></div>';
    });
    h += '</section>';

    var totFiles = 0, totBytes = 0;
    h += '<section class="card"><h3>Forensik-Hosts (' + hosts.length + '/' + IR.hosts.MAX + ')</h3>';
    if (!hosts.length) h += '<p class="muted">Keine Hosts. Unter „Forensik-Hosts" hinzufuegen.</p>';
    hosts.forEach(function (host) {
      var d = hostData(host.id), info = d.info, online = info && info.evidenceCount != null;
      if (online) { totFiles += info.evidenceCount; totBytes += info.evidenceBytes || 0; }
      h += '<div class="row caseitem"><span><strong>' + U.esc(host.label) + '</strong>' +
        '<small><code>' + U.esc(host.base) + '</code> · ' + (d.busy ? '…' : d.err ? 'offline' : online ? info.evidenceCount + ' Dateien · ' + fmtBytes(info.evidenceBytes) : 'unverbunden') + '</small></span></div>';
    });
    h += '</section>';

    // PIN-Gate fuer Datei-Download (alle Hosts)
    h += '<section class="card"><h3>Alle Beweis-Dateien (' + totFiles + ' · ' + fmtBytes(totBytes) + ')</h3>';
    if (!state.dashUnlocked) {
      h += '<p class="muted">Zum Herunterladen aller gesammelten Dateien PIN eingeben.</p>' +
        '<div class="row"><input id="dashPin" type="password" inputmode="numeric" placeholder="PIN" style="width:120px">' +
        '<button class="mini" data-act="dash-unlock">Entsperren</button></div>';
      if (state.dashPinErr) h += '<small class="warn">Falsche PIN.</small>';
    } else {
      h += '<small class="muted">Entsperrt. ' +
        '<button class="mini" data-act="dash-lock">Sperren</button></small>';
      var any = false;
      hosts.forEach(function (host) {
        var d = hostData(host.id);
        if (!d.files || !d.files.length) return;
        any = true;
        h += '<div class="hfiles"><strong>' + U.esc(host.label) + '</strong>';
        d.files.forEach(function (f) {
          h += '<div class="row"><a class="link" href="' + IR.hosts.downloadUrl(host, f.path) + '" target="_blank">' + U.esc(f.path) + '</a><small>' + fmtBytes(f.size) + '</small></div>';
        });
        h += '</div>';
      });
      if (!any) h += '<p class="muted">Noch keine Dateien – Hosts aktualisieren oder Aktionen starten.</p>';
    }
    h += '</section>';
    return h;
  }

  /* ----------------------------------------------------- Cloud (Git-Speicher) */
  function cloudHostFiles() {
    var out = [];
    IR.hosts.list().forEach(function (host) {
      var d = hostData(host.id);
      (d.files || []).forEach(function (f) { out.push({ path: f.path, size: f.size, host: host.label, url: IR.hosts.downloadUrl(host, f.path) }); });
    });
    return out;
  }
  function cloudRefresh() {
    IR.cloud.pullIndex().then(function (idx) { state.cloudIdx = idx; render(); })
      .catch(function (e) { state.cloudMsg = 'Index laden fehlgeschlagen: ' + (e && e.message || e); state.cloudErr = true; render(); });
  }
  function cloudPublish(cases) {
    if (!IR.cloud.enabled()) { state.cloudMsg = 'Bitte zuerst Owner/Repo/Token speichern.'; state.cloudErr = true; state.view = 'cloud'; return render(); }
    if (!cases || !cases.length) { toast('Keine Faelle'); return; }
    var files = cloudHostFiles(), done = 0, errs = 0, total = cases.length, lastErr = '';
    state.cloudMsg = 'Veroeffentliche ' + total + ' Fall/Faelle …'; state.cloudErr = false; render();
    cases.reduce(function (chain, cse) {
      return chain.then(function () {
        return IR.cloud.publish(cse, files).then(function () { done++; }, function (e) { errs++; lastErr = (e && e.message) || String(e); });
      });
    }, Promise.resolve()).then(function () {
      var hint = '';
      if (errs) { hint = ' – ' + lastErr; if (/40[13]/.test(lastErr)) hint += ' (PAT mit Contents:write fuer dieses Repo?)'; if (/404/.test(lastErr)) hint += ' (Owner/Repo/Branch pruefen)'; }
      state.cloudMsg = done + ' veroeffentlicht' + (errs ? (', ' + errs + ' Fehler' + hint) : '') + '.';
      state.cloudErr = errs > 0;
      toast(errs ? ('Cloud-Fehler' + hint) : (done + ' veroeffentlicht'));
      cloudRefresh();
    });
  }

  function viewCloud() {
    var cfg = IR.cloud.config(), on = IR.cloud.enabled();
    var h = '<section class="card"><div class="row"><h2>☁️ Cloud &amp; Veroeffentlichen</h2>' +
      '<button class="mini" data-act="goto-home">‹ Start</button></div>' +
      '<p class="muted">Git als Cloud-Speicher: die App (zentraler Arbeitspunkt) veroeffentlicht Vorfaelle ins Repo, das Pages-Dashboard zeigt sie. Endpoints (Boot-Stick/Windows) liefern die Forensik-Daten zu. Der Token (fein granularer PAT, <code>Contents: write</code>) bleibt lokal im Browser.</p>' +
      '<div class="row"><label>Owner</label><input id="clOwner" value="' + U.esc(cfg.owner) + '" placeholder="z.B. go2dach"></div>' +
      '<div class="row"><label>Repo</label><input id="clRepo" value="' + U.esc(cfg.repo) + '" placeholder="z.B. Apk---tests"></div>' +
      '<div class="row"><label>Branch</label><input id="clBranch" value="' + U.esc(cfg.branch) + '" placeholder="main"></div>' +
      '<div class="row"><label>Token (PAT)</label><input id="clToken" type="password" value="' + U.esc(cfg.token) + '" placeholder="ghp_… (bleibt lokal)"></div>' +
      '<div class="row"><button data-act="cloud-save">Speichern</button>' +
      '<span class="badge">' + (on ? 'konfiguriert' : 'nicht konfiguriert') + '</span></div>';
    if (cfg.owner && cfg.repo) {
      var du = IR.cloud.dashboardUrl();
      h += '<small class="muted">Dashboard: <a href="' + U.esc(du) + '" target="_blank">' + U.esc(du) + '</a></small>';
    }
    h += '</section>';

    h += '<section class="card"><h3>Veroeffentlichen</h3>' +
      '<p class="muted">Schlanke Snapshots (Kennzahlen, Report, Datei-Verweise auf die Hosts) ins Repo schreiben. Rohdaten bleiben auf den Endpoints.</p>' +
      '<div class="row"><button class="mini" data-act="cloud-pub-all">Alle Faelle veroeffentlichen</button>' +
      '<button class="mini" data-act="cloud-refresh">Cloud-Index laden</button></div>';
    if (state.cloudMsg) h += '<small class="' + (state.cloudErr ? 'warn' : 'muted') + '">' + U.esc(state.cloudMsg) + '</small>';
    h += '</section>';

    if (state.cloudIdx) {
      var inc = (state.cloudIdx.incidents || []);
      h += '<section class="card"><h3>In der Cloud (' + inc.length + ')</h3>';
      if (!inc.length) h += '<p class="muted">Noch nichts veroeffentlicht.</p>';
      inc.slice().reverse().forEach(function (e) {
        h += '<div class="row caseitem"><span><strong>' + U.esc(e.title) + '</strong>' +
          '<small>' + U.esc(e.org || '') + ' · ' + U.esc(e.status || '') + ' · ' + (e.progress || 0) + ' % · ' + (e.files || 0) + ' Datei(en)</small></span></div>';
      });
      h += '</section>';
    }
    return h;
  }

  /* --------------------------------------------- Datenquellen (IDS/Asset) */
  function srcPull(id) {
    if (!c) { toast('Erst einen Fall öffnen'); return; }
    var s = IR.sources.get(id); if (!s) return;
    state.srcMsg = '▶ Abruf: ' + s.label + ' …'; state.srcErr = false; render();
    IR.sources.pullInto(s, c).then(function (r) {
      save();
      state.srcMsg = 'Übernommen: ' + r.assets + ' Assets, ' + r.vulns + ' Schwachstellen, ' + r.iocs + ' IOCs, ' + r.timeline + ' Ereignisse.';
      state.srcErr = false; toast('Daten übernommen'); render();
    }).catch(function (e) {
      state.srcMsg = 'Fehler: ' + (e && e.message || e) + ' – URL/Token/CORS prüfen (in der APK: lokales http erlaubt).';
      state.srcErr = true; render();
    });
  }
  function viewSources() {
    var list = IR.sources.list();
    var h = '<section class="card"><div class="row"><h2>🗄️ Datenquellen (IDS / Asset / Schwachstellen)</h2>' +
      '<button class="mini" data-act="goto-home">‹ Start</button></div>' +
      '<p class="muted">Externe Daten-Lieferanten (z.B. dein IDS-Tool mit Asset-Inventar &amp; Schwachstellen) per JSON-URL anbinden. ' +
      'Die App ruft ab und übernimmt Assets, Schwachstellen, IOCs, Hosts und IDS-Alerts in den aktiven Fall. ' +
      'Erwartetes Format: <code>docs/integration-ids.md</code>.</p>';
    if (list.length < IR.sources.MAX) {
      h += '<div class="hostadd"><div class="row"><input id="srcLabel" placeholder="Name (z.B. Mein-IDS)"></div>' +
        '<div class="row"><input id="srcUrl" placeholder="JSON-URL (z.B. http://ids.local/api/export)"></div>' +
        '<div class="row"><input id="srcToken" type="password" placeholder="Token (optional, Bearer)"></div>' +
        '<button class="mini" data-act="src-add">+ Datenquelle hinzufügen</button></div>';
    }
    if (state.srcMsg) h += '<small class="' + (state.srcErr ? 'warn' : 'muted') + '">' + U.esc(state.srcMsg) + '</small>';
    h += (c ? '' : '<small class="warn">Zum Übernehmen zuerst einen Fall öffnen.</small>') + '</section>';

    list.forEach(function (s) {
      h += '<section class="card"><div class="row"><strong>' + U.esc(s.label) + '</strong><span class="badge">' + U.esc(s.kind) + '</span></div>' +
        '<small class="muted"><code>' + U.esc(s.url) + '</code></small>' +
        '<div class="row">' + (c ? '<button class="mini" data-act="src-pull" data-id="' + s.id + '">⤵ Abrufen → in Fall</button>' : '') +
        '<button class="icon" data-act="src-del" data-id="' + s.id + '" title="entfernen">✕</button></div></section>';
    });

    if (c && ((c.assets && c.assets.length) || (c.vulns && c.vulns.length))) {
      h += '<section class="card"><h3>Im Fall: ' + (c.assets || []).length + ' Assets · ' + (c.vulns || []).length + ' Schwachstellen</h3>';
      (c.assets || []).slice(0, 8).forEach(function (a) {
        h += '<div class="frow">· <strong>' + U.esc(a.name || a.ip) + '</strong> ' + U.esc(a.ip || '') + (a.criticality ? ' <span class="badge">' + U.esc(a.criticality) + '</span>' : '') + '</div>';
      });
      (c.vulns || []).slice(0, 8).forEach(function (v) {
        h += '<div class="frow">⚠ ' + U.esc(v.cve || v.title) + (v.cvss !== '' && v.cvss != null ? ' (CVSS ' + U.esc(String(v.cvss)) + ')' : '') + (v.asset ? ' @ ' + U.esc(v.asset) : '') + '</div>';
      });
      h += '<small class="muted">Vollständig im Bericht (auch PDF).</small></section>';
    }
    return h;
  }

  /* ------------------------------------------------------- KI-Assistent */
  function viewAssistant() {
    var A = IR.assistant, cfg = A.config(), on = A.enabled();
    var hist = state.asstHistory || (state.asstHistory = []);
    var h = '<section class="card"><div class="row"><h2>🤖 Assistent (KI)</h2>' +
      '<button class="mini" data-act="goto-home">‹ Start</button></div>' +
      '<p class="muted">Fachfragen direkt im Einsatz (IR/OT-Forensik, Schutzgeräte wie SIPROTEC, Log-Sicherung). Nutzt deinen <b>eigenen</b> Anthropic-API-Key – bleibt lokal, wird nie übertragen/committet. Braucht Internet.</p>' +
      '<div class="row"><label>API-Key</label><input id="asstKey" type="password" value="' + U.esc(cfg.apiKey) + '" placeholder="sk-ant-…"></div>' +
      '<div class="row"><label>Modell</label><select id="asstModel">' +
      A.MODELS.map(function (m) { return '<option value="' + m.id + '"' + (cfg.model === m.id ? ' selected' : '') + '>' + U.esc(m.name) + '</option>'; }).join('') + '</select></div>' +
      '<div class="row"><button data-act="asst-save">Speichern</button>' +
      '<span class="badge">' + (on ? 'bereit' : 'kein Key') + '</span>' +
      (hist.length ? '<button class="mini" data-act="asst-clear">Verlauf leeren</button>' : '') + '</div>' +
      '<small class="muted">Key erstellen: console.anthropic.com → API Keys.</small></section>';

    h += '<section class="card"><h3>Beispiel-Fragen</h3><div class="chips col">' +
      A.SUGGESTIONS.map(function (s, i) { return '<button class="chip" data-act="asst-suggest" data-i="' + i + '">' + U.esc(s) + '</button>'; }).join('') + '</div></section>';

    h += '<section class="card"><div class="chat">';
    if (!hist.length) h += '<p class="muted">Stelle eine Frage – z.B. „Offline-Log-Sicherung am Schutzgerät SIPROTEC 4 – wie gehe ich vor?"</p>';
    hist.forEach(function (m) {
      h += '<div class="msg ' + (m.role === 'user' ? 'me' : 'ai') + '">' + (m.role === 'user' ? U.esc(m.content) : U.md(m.content)) + '</div>';
    });
    if (state.asstBusy) h += '<div class="msg ai muted">… denkt nach</div>';
    h += '</div><div class="row"><textarea id="asstInput" placeholder="Frage eingeben…">' + U.esc(state.asstDraft || '') + '</textarea></div>' +
      '<button class="bigbtn" data-act="asst-send"' + (state.asstBusy ? ' disabled' : '') + '>Senden ▸</button></section>';
    return h;
  }
  function asstSend() {
    var A = IR.assistant;
    if (!A.enabled()) { toast('Erst API-Key speichern'); return; }
    var inp = document.getElementById('asstInput');
    var q = (inp && inp.value || state.asstDraft || '').trim();
    if (!q) { toast('Frage eingeben'); return; }
    var hist = state.asstHistory || (state.asstHistory = []);
    hist.push({ role: 'user', content: q });
    state.asstDraft = ''; state.asstBusy = true; render();
    A.ask(hist).then(function (ans) {
      hist.push({ role: 'assistant', content: ans }); state.asstBusy = false; render();
    }).catch(function (e) {
      state.asstBusy = false;
      var msg = (e && e.message) || String(e);
      hist.push({ role: 'assistant', content: '⚠️ Fehler: ' + msg + (/40[13]|key/i.test(msg) ? '\n\nAPI-Key prüfen.' : '') }); render();
    });
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
      if (ph.id === 'forensik') h += findingsCard();
      steps.forEach(function (s) { h += renderStep(s); });
      h += '</section>';
    });
    return h;
  }

  // Importierte Befunde (aus Host-/Datei-Ingest) direkt im Forensik-Schritt zeigen,
  // damit die Entscheidung am Datenbestand getroffen wird.
  function findingsCard() {
    var iocs = c.iocs || [], ev = c.evidence || [];
    var ingest = (c.timeline || []).filter(function (t) { return t.kind === 'ingest'; });
    if (!iocs.length && !ev.length && !ingest.length) {
      return '<div class="findings"><small class="muted">📥 Noch keine importierten Befunde. Daten einspeisen: Tab <b>Geräte/Hosts</b> → „⤵ Befunde in Fall", oder Tab <b>Bericht</b> → „Daten importieren".</small></div>';
    }
    var h = '<div class="findings"><div class="row"><strong>📥 Befunde aus Daten</strong>' +
      '<span class="badge">' + iocs.length + ' IOCs · ' + ev.length + ' Beweise</span></div>';
    if (iocs.length) {
      h += '<div class="findlist">';
      iocs.slice(0, 12).forEach(function (x) {
        h += '<div class="frow">· <code>' + U.esc(x.type) + '</code> ' + U.esc(x.value) + (x.note ? ' <small>' + U.esc(x.note) + '</small>' : '') + '</div>';
      });
      if (iocs.length > 12) h += '<small class="muted">… +' + (iocs.length - 12) + ' weitere (Tab IOCs)</small>';
      h += '</div>';
    }
    if (ev.length) h += '<small>Beweise: ' + U.esc(ev.map(function (e) { return e.name; }).slice(0, 8).join(', ')) + '</small>';
    h += '<small class="muted">Diese Befunde unten gegen „Worauf achten (Entscheidung)" prüfen und Confirm/Refute setzen. Das Tool entscheidet bewusst nicht automatisch.</small></div>';
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
    // Fotos & Screenshots (z.B. von den Hosts/Anlagen)
    var hosts = IR.hosts ? IR.hosts.list() : [];
    h += '<section class="card"><h2>📷 Fotos & Screenshots</h2>' +
      '<p class="muted">Fotos der Geräte/Anlagen oder Screenshots von Host-Bildschirmen erfassen (werden verkleinert lokal gespeichert und im PDF-Bericht eingebunden).</p>' +
      '<div class="row"><label>Host/Quelle</label><select id="photoHost"><option value="">— frei —</option>' +
      hosts.map(function (x) { return '<option>' + U.esc(x.label) + '</option>'; }).join('') + '</select></div>' +
      '<div class="row"><button class="mini" data-act="photo-cam">📷 Foto aufnehmen</button>' +
      '<button class="mini" data-act="photo-pick">🖼️ Aus Galerie/Datei</button></div>';
    var ph = c.photos || [];
    if (ph.length) {
      h += '<div class="phgrid">';
      ph.slice().reverse().forEach(function (p) {
        h += '<figure class="phc"><img src="' + p.dataUrl + '" data-act="photo-view" data-id="' + p.id + '">' +
          '<figcaption><input data-photo="' + p.id + '" value="' + U.esc(p.note || '') + '" placeholder="Notiz">' +
          '<div class="row"><small>' + U.esc(p.host || '—') + ' · ' + U.fmtTs(p.ts) + '</small>' +
          '<button class="icon" data-act="photo-del" data-id="' + p.id + '" title="löschen">✕</button></div></figcaption></figure>';
      });
      h += '</div>';
    } else h += '<small class="muted">Noch keine Fotos.</small>';
    h += '</section>';
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
      '<button class="mini" data-act="rep-pdf">📄 Bericht als PDF</button>' +
      '<button class="mini" data-act="case-dl">Fall (JSON) exportieren</button>' +
      '<button class="mini" data-act="tl-csv">Timeline CSV</button>' +
      '<button class="mini" data-act="sitrep">Lagebericht</button>' +
      '<button class="mini" data-act="cloud-publish">☁️ In Cloud veroeffentlichen</button></div>' +
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
    if (act === 'goto-hosts') { state.view = 'hosts'; return render(); }
    if (act === 'goto-dashboard') { state.view = 'dashboard'; IR.hosts.list().forEach(function (host) { if (!hostData(host.id).info) hostRefresh(host.id); }); return render(); }
    if (act === 'goto-home') { state.caseId = null; c = null; state.view = 'home'; return render(); }
    // ---- Forensik-Hosts ----
    if (act === 'host-add') {
      try {
        IR.hosts.add({ label: ($('#hLabel') || {}).value, base: ($('#hBase') || {}).value, token: ($('#hToken') || {}).value });
        toast('Host hinzugefuegt'); render();
      } catch (err) { toast(err.message || 'Fehler'); }
      return;
    }
    if (act === 'host-del') { if (confirm('Host entfernen?')) { IR.hosts.remove(id); render(); } return; }
    if (act === 'host-refresh') { hostRefresh(id); return; }
    if (act === 'host-discover') { hostDiscover(); return; }
    if (act === 'host-merge') { hostMergeFindings([id]); return; }
    if (act === 'host-merge-all') { hostMergeFindings(IR.hosts.list().map(function (x) { return x.id; })); return; }
    if (act === 'host-run') {
      var a = b.dataset.a, args = {};
      if (a === 'image_disk') {
        var dv = (document.querySelector('[data-hdev="' + id + '"]') || {}).value;
        if (!dv) { toast('Geraet angeben (z.B. /dev/sdb)'); return; }
        args = { dev: dv, fmt: 'ewf' };
      } else if (a === 'wireshark') { args = { iface: 'eth1', min: '5' }; }
      var labels = { discover: 'Hosts finden', wireshark: 'Wireshark', image_disk: 'Image', collect_windows: 'Win-Triage', collect_linux: 'Linux-Triage', manifest: 'Manifest' };
      hostAction(id, a, args, labels[a]); return;
    }
    if (act === 'dash-refresh') { IR.hosts.list().forEach(function (host) { hostRefresh(host.id); }); return; }
    if (act === 'dash-unlock') {
      var pin = ($('#dashPin') || {}).value;
      if (pin === IR.hosts.DASH_PIN) { state.dashUnlocked = true; state.dashPinErr = false; IR.hosts.list().forEach(function (host) { hostRefresh(host.id); }); }
      else { state.dashPinErr = true; }
      return render();
    }
    if (act === 'dash-lock') { state.dashUnlocked = false; return render(); }
    // ---- Cloud (Git-Speicher) ----
    if (act === 'goto-cloud') { state.view = 'cloud'; if (IR.cloud.config().owner) cloudRefresh(); return render(); }
    if (act === 'cloud-save') {
      IR.cloud.setConfig({ owner: ($('#clOwner') || {}).value, repo: ($('#clRepo') || {}).value, branch: ($('#clBranch') || {}).value || 'main', token: ($('#clToken') || {}).value });
      toast(IR.cloud.enabled() ? 'Cloud gespeichert' : 'Gespeichert – Owner/Repo/Token unvollstaendig'); return render();
    }
    if (act === 'cloud-refresh') { cloudRefresh(); return; }
    if (act === 'cloud-publish') {
      if (!c) { toast('Kein Fall aktiv'); return; }
      cloudPublish([c]); return;
    }
    if (act === 'cloud-pub-all') { cloudPublish(IR.store.list()); return; }
    // ---- Datenquellen (IDS/Asset) ----
    if (act === 'goto-sources') { state.view = 'sources'; return render(); }
    if (act === 'src-add') {
      try { IR.sources.add({ label: ($('#srcLabel') || {}).value, url: ($('#srcUrl') || {}).value, token: ($('#srcToken') || {}).value }); toast('Datenquelle hinzugefügt'); render(); }
      catch (err) { toast(err.message || 'Fehler'); }
      return;
    }
    if (act === 'src-del') { if (confirm('Datenquelle entfernen?')) { IR.sources.remove(id); render(); } return; }
    if (act === 'src-pull') { srcPull(id); return; }
    // ---- KI-Assistent ----
    if (act === 'goto-assistant') { state.view = 'assistant'; return render(); }
    if (act === 'asst-save') {
      IR.assistant.setConfig({ apiKey: ($('#asstKey') || {}).value, model: ($('#asstModel') || {}).value || IR.assistant.DEFAULT_MODEL });
      toast(IR.assistant.enabled() ? 'Assistent bereit' : 'API-Key fehlt'); return render();
    }
    if (act === 'asst-suggest') { state.asstDraft = IR.assistant.SUGGESTIONS[+b.dataset.i] || ''; return render(); }
    if (act === 'asst-send') { return asstSend(); }
    if (act === 'asst-clear') { state.asstHistory = []; return render(); }
    if (act === 'native-run') { if (!IR.native.run(id)) toast('Nur in der APK nativ verfuegbar'); return; }
    if (act === 'native-reload') { IR.native.reloadData(); return; }
    if (act === 'kit-export') { if (IR.native.exportKit()) toast('Werkzeug-Kit wird gespeichert'); else toast('Download nicht moeglich'); return; }
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
    else if (act === 'photo-cam') { pickPhoto(true); }
    else if (act === 'photo-pick') { pickPhoto(false); }
    else if (act === 'photo-del') { if (confirm('Foto löschen?')) { IR.Case.removePhoto(c, id); save(); render(); } }
    else if (act === 'photo-view') { var pv = (c.photos || []).filter(function (x) { return x.id === id; })[0]; if (pv) { var w = window.open('', '_blank'); if (w) { w.document.write('<img style="max-width:100%" src="' + pv.dataUrl + '">'); } } }
    else if (act === 'custody') { var by = prompt('Uebergabe an / Aktion (z.B. „uebergeben an Polizei XY"):'); if (by) { IR.Case.custodyTransfer(c, id, 'uebergeben', by, ''); save(); render(); } }
    else if (act === 'comm-open') { go('comms'); setTimeout(function () { var el = document.getElementById('comm-' + id); if (el) el.scrollIntoView(); }, 50); }
    else if (act === 'comm-copy') { copy(IR.fillTemplate(IR.comms[id].subject + '\n\n' + IR.comms[id].body, ctxNow())); }
    else if (act === 'comm-log') { IR.Case.addComm(c, { audience: IR.comms[id].audience, channel: IR.comms[id].channel, status: 'gemeldet' }); markCommsStep(id); save(); toast('Protokolliert'); render(); }
    else if (act === 'ioc-add') { var v = $('#iocVal').value.trim(); if (v) { IR.Case.addIoc(c, $('#iocType').value, v, $('#iocNote').value.trim()); save(); render(); } }
    else if (act === 'tool-copy') { copy(tool(id).script); }
    else if (act === 'tool-dl') { var t = tool(id); download(t.filename, t.script); }
    else if (act === 'rep-copy') { copy(IR.report.markdown(c)); }
    else if (act === 'rep-dl') { download('incident-report-' + c.id + '.md', IR.report.markdown(c), 'text/markdown'); }
    else if (act === 'rep-pdf') { reportPdf(); }
    else if (act === 'case-dl') { download('case-' + c.id + '.json', JSON.stringify(c, null, 2), 'application/json'); }
    else if (act === 'sitrep') { copy(IR.report.sitrep(c)); toast('Lagebericht kopiert'); }
    else if (act === 'tl-csv') { download('timeline-' + c.id + '.csv', IR.report.timelineCSV(c), 'text/csv'); }
    else if (act === 'import-json') { importFromFile(); }
    else if (act === 'import-paste') {
      var txt = prompt('IOCs/Text einfuegen (IPs, Hashes, E-Mails, IBANs, Domains, URLs werden erkannt):');
      if (txt) { var r = IR.ingest.merge(c, IR.ingest.fromText(txt)); save(); toast(r.iocs + ' IOCs importiert'); render(); }
    }
  });

  // Bericht als PDF: druckt NUR den Bericht (Print-Stylesheet) – funktioniert im
  // Browser (window.print) wie in der APK (Android-PDF-Druck via Bridge). Kein
  // window.open noetig (WebViews blockieren das).
  function reportPdf() {
    var root = document.getElementById('printroot') ||
      (function () { var d = document.createElement('div'); d.id = 'printroot'; document.body.appendChild(d); return d; })();
    var photos = (c.photos || []).map(function (p) {
      return '<figure class="pimg"><img src="' + (p.dataUrl || '') + '"><figcaption>' + U.esc(p.name) +
        (p.host ? ' · ' + U.esc(p.host) : '') + (p.note ? ' – ' + U.esc(p.note) : '') + '</figcaption></figure>';
    }).join('');
    root.innerHTML = '<div class="preport">' + U.md(IR.report.markdown(c)) +
      (photos ? '<h2>Fotos &amp; Screenshots</h2><div class="pgrid">' + photos + '</div>' : '') + '</div>';
    document.body.classList.add('printing');
    setTimeout(function () {
      IR.native.print();
      setTimeout(function () { document.body.classList.remove('printing'); }, 1500);
    }, 250);
    toast('Drucken → „Als PDF speichern"');
  }

  // Foto/Screenshot erfassen: Kamera (capture) oder Galerie/Datei; verkleinern -> dataURL.
  function pickPhoto(camera) {
    var host = (document.getElementById('photoHost') || {}).value || '';
    var inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
    if (camera) inp.setAttribute('capture', 'environment');
    inp.addEventListener('change', function () {
      var f = inp.files && inp.files[0]; if (!f) return;
      downscaleImage(f, 1280, 0.7, function (dataUrl) {
        IR.Case.addPhoto(c, { name: f.name || 'Foto', host: host, dataUrl: dataUrl });
        save(); toast('Foto erfasst'); render();
      });
    });
    inp.click();
  }
  function downscaleImage(file, maxPx, quality, cb) {
    var rd = new FileReader();
    rd.onload = function () {
      var img = new Image();
      img.onload = function () {
        var w = img.width, hgt = img.height, scale = Math.min(1, maxPx / Math.max(w, hgt));
        var cw = Math.max(1, Math.round(w * scale)), ch = Math.max(1, Math.round(hgt * scale));
        try {
          var cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
          cv.getContext('2d').drawImage(img, 0, 0, cw, ch);
          cb(cv.toDataURL('image/jpeg', quality));
        } catch (e) { cb(rd.result); }   // Fallback: Original
      };
      img.onerror = function () { cb(rd.result); };
      img.src = rd.result;
    };
    rd.readAsDataURL(file);
  }

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
    if (t.id === 'asstInput') { state.asstDraft = t.value; return; }
    if (!c) return;
    if (t.dataset.photo != null) { var pp = (c.photos || []).filter(function (x) { return x.id === t.dataset.photo; })[0]; if (pp) { pp.note = t.value; save(); } return; }
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
