/* IR-Pilot – Cloud-Sync ueber Git (GitHub als Speicher).
 *
 * Architektur:
 *   Endpoints (Boot-Stick control-server / Windows IR-Collect)
 *        -> liefern Forensik-Daten an die APP (zentraler Arbeitspunkt)
 *   App   -> veroeffentlicht den Vorfall (Snapshot + Report + Datei-Refs)
 *            via GitHub Contents-API in das Repo  cloud/incidents/<id>.json
 *            und pflegt cloud/incidents/index.json
 *   Pages -> dashboard.html liest index.json STATISCH (kein Token) und zeigt
 *            alle aktiven Incidents; Dateien nach PIN sichtbar.
 *
 * Grosse Beweis-Rohdaten (pcap, Images) bleiben auf den Endpoints (Host-Download);
 * in der Cloud liegen schlanke Metadaten/Reports + Verweise. Der Token (fein
 * granularer PAT, nur contents:write fuer DAS Daten-Repo) bleibt lokal im Browser.
 */
(function (root) {
  'use strict';
  var IR = root.IR || (root.IR = {});
  var KEY = 'ir-cloud-v1', mem = null;
  // Pfad ist vorbelegt (dieses Repo), bleibt aber in der App aenderbar.
  // Geschrieben/gelesen wird der Arbeits-Branch (dort liegt cloud/); ein Push
  // dorthin triggert den Pages-Deploy automatisch.
  var DEF = { owner: 'go2dach', repo: 'Apk---tests', branch: 'claude/fresh-start-v9zow4', token: '', dir: 'cloud/incidents' };

  function store() { try { return root.localStorage; } catch (e) { return null; } }
  function loadCfg() {
    var s = store();
    if (s) { try { return Object.assign({}, DEF, JSON.parse(s.getItem(KEY) || '{}')); } catch (e) { return Object.assign({}, DEF); } }
    return Object.assign({}, DEF, mem || {});
  }
  function saveCfg(cfg) {
    var c = Object.assign({}, DEF, cfg); var s = store();
    if (s) { try { s.setItem(KEY, JSON.stringify(c)); } catch (e) {} }
    mem = c; return c;
  }
  function b64(str) {
    if (typeof root.btoa === 'function') return root.btoa(unescape(encodeURIComponent(str)));
    if (typeof Buffer !== 'undefined') return Buffer.from(str, 'utf8').toString('base64');
    throw new Error('kein base64');
  }
  function unb64(b) {
    if (typeof root.atob === 'function') return decodeURIComponent(escape(root.atob(b)));
    if (typeof Buffer !== 'undefined') return Buffer.from(b, 'base64').toString('utf8');
    throw new Error('kein base64');
  }
  function fx(url, opts) {
    if (typeof root.fetch !== 'function') return Promise.reject(new Error('kein fetch'));
    return root.fetch(url, opts);
  }

  var Cloud = {
    DASH_PIN: '1374',
    config: loadCfg,
    setConfig: function (p) { return saveCfg(Object.assign(loadCfg(), p)); },
    enabled: function () { var c = loadCfg(); return !!(c.owner && c.repo && c.token); },

    apiUrl: function (path) {
      var c = loadCfg();
      return 'https://api.github.com/repos/' + c.owner + '/' + c.repo + '/contents/' + path;
    },
    rawUrl: function (path) {
      var c = loadCfg();
      return 'https://raw.githubusercontent.com/' + c.owner + '/' + c.repo + '/' + (c.branch || 'main') + '/' + path;
    },
    dashboardUrl: function () {
      var c = loadCfg();
      return 'https://' + c.owner + '.github.io/' + c.repo + '/dashboard.html';
    },

    // --- schlanker Snapshot eines Falls fuers Dashboard ---
    snapshot: function (cse, hostFiles) {
      var U = IR.util, pb = IR.Case.playbook(cse);
      var pr = pb ? IR.engine.progress(pb, cse) : { pct: 0, done: 0, total: 0 };
      return {
        schema: 1, id: cse.id, title: cse.title, org: cse.org || '', responder: cse.responder || '',
        status: (cse.flags && cse.flags.status) || 'offen',
        severity: (pb && pb.severity) || '', classification: cse.classification || '',
        progress: pr.pct, done: pr.done, total: pr.total,
        iocs: (cse.iocs || []).length, evidence: (cse.evidence || []).length,
        createdAt: cse.createdAt, updated: U.nowISO(),
        files: (hostFiles || []).slice(0, 200),
        report: (IR.report && IR.report.markdown) ? IR.report.markdown(cse) : ''
      };
    },
    indexEntry: function (snap) {
      return { id: snap.id, title: snap.title, org: snap.org, status: snap.status,
        severity: snap.severity, progress: snap.progress, done: snap.done, total: snap.total,
        files: (snap.files || []).length, updated: snap.updated };
    },

    // --- GitHub Contents-API: Datei lesen (sha) / schreiben ---
    getFile: function (path) {
      var c = loadCfg();
      return fx(this.apiUrl(path) + '?ref=' + encodeURIComponent(c.branch || 'main'),
        { headers: { Authorization: 'Bearer ' + c.token, Accept: 'application/vnd.github+json' } })
        .then(function (r) {
          if (r.status === 404) return { sha: null, json: null };
          if (!r.ok) throw new Error('GET ' + path + ' -> ' + r.status);
          return r.json().then(function (j) {
            var txt = j.content ? unb64(j.content.replace(/\n/g, '')) : '';
            var parsed = null; try { parsed = JSON.parse(txt); } catch (e) {}
            return { sha: j.sha, text: txt, json: parsed };
          });
        });
    },
    putFile: function (path, contentStr, message) {
      var c = loadCfg(), self = this;
      return this.getFile(path).then(function (cur) {
        var body = { message: message || ('IR-Pilot: ' + path), content: b64(contentStr), branch: c.branch || 'main' };
        if (cur.sha) body.sha = cur.sha;
        return fx(self.apiUrl(path), {
          method: 'PUT',
          headers: { Authorization: 'Bearer ' + c.token, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        }).then(function (r) { if (!r.ok) throw new Error('PUT ' + path + ' -> ' + r.status); return r.json(); });
      });
    },

    // --- Vorfall veroeffentlichen (Snapshot + Index aktualisieren) ---
    publish: function (cse, hostFiles) {
      if (!this.enabled()) return Promise.reject(new Error('Cloud nicht konfiguriert (Owner/Repo/Token)'));
      var c = loadCfg(), self = this, snap = this.snapshot(cse, hostFiles);
      var file = c.dir + '/' + snap.id + '.json';
      return this.putFile(file, JSON.stringify(snap, null, 2), 'IR-Pilot: Vorfall ' + snap.title)
        .then(function () { return self.getFile(c.dir + '/index.json'); })
        .then(function (cur) {
          var idx = (cur.json && cur.json.incidents) ? cur.json : { schema: 1, updated: null, incidents: [] };
          var entry = self.indexEntry(snap);
          idx.incidents = idx.incidents.filter(function (e) { return e.id !== entry.id; });
          idx.incidents.push(entry);
          idx.updated = IR.util.nowISO();
          return self.putFile(c.dir + '/index.json', JSON.stringify(idx, null, 2), 'IR-Pilot: Index aktualisiert');
        })
        .then(function () { return { ok: true, dashboard: self.dashboardUrl(), file: file }; });
    },

    // --- Index lesen (fuers App-/Pages-Dashboard); ohne Token via raw ---
    pullIndex: function () {
      var c = loadCfg();
      if (!c.owner || !c.repo) return Promise.reject(new Error('Owner/Repo fehlen'));
      return fx(this.rawUrl(c.dir + '/index.json') + '?_=' + Date.now())
        .then(function (r) { return r.ok ? r.json() : { incidents: [] }; })
        .catch(function () { return { incidents: [] }; });
    },
    pullIncident: function (id) {
      var c = loadCfg();
      return fx(this.rawUrl(c.dir + '/' + id + '.json') + '?_=' + Date.now())
        .then(function (r) { return r.ok ? r.json() : null; });
    }
  };

  IR.cloud = Cloud;
  if (typeof module !== 'undefined' && module.exports) module.exports = Cloud;
})(typeof window !== 'undefined' ? window : globalThis);
