/* IR-Pilot – Forensik-Hosts. Verwaltet bis zu 10 Boot-Stick-Control-Server
 * (je ein gesicherter Forensik-Host) und spricht deren API token-geschuetzt an:
 * Identitaet, Datentraeger, gesammelte Dateien und One-Click-Aktionen
 * (Discover, Wireshark, Image, Triage, Manifest). Funktioniert in der PWA,
 * in der APK und wenn die App direkt vom Stick (/app/) geladen wird.
 */
(function (root) {
  'use strict';
  var IR = root.IR || (root.IR = {});
  var MAX = 10, KEY = 'ir-hosts-v1';
  var mem = null;  // In-Memory-Fallback ohne localStorage (Node/Privatmodus)

  function store() {
    try { return root.localStorage; } catch (e) { return null; }
  }
  function load() {
    var s = store();
    if (s) { try { return JSON.parse(s.getItem(KEY) || '[]'); } catch (e) { return []; } }
    return mem || (mem = []);
  }
  function persist(list) {
    var s = store();
    if (s) { try { s.setItem(KEY, JSON.stringify(list)); } catch (e) {} }
    mem = list;
  }
  function normBase(b) {
    b = String(b || '').trim();
    if (!b) return '';
    if (!/^https?:\/\//i.test(b)) b = 'http://' + b;
    return b.replace(/\/+$/, '');
  }
  function uid() { return 'h' + Math.random().toString(36).slice(2, 9); }

  function fetchJson(url, opts) {
    if (typeof root.fetch !== 'function') return Promise.reject(new Error('kein fetch'));
    var ctrl = (typeof root.AbortController === 'function') ? new root.AbortController() : null;
    var t = ctrl ? setTimeout(function () { ctrl.abort(); }, (opts && opts.timeout) || 6000) : null;
    var o = Object.assign({}, opts); if (ctrl) o.signal = ctrl.signal;
    return root.fetch(url, o).then(function (r) {
      if (t) clearTimeout(t);
      var ct = r.headers && r.headers.get && (r.headers.get('content-type') || '');
      return (ct && ct.indexOf('json') >= 0) ? r.json() : r.text();
    });
  }

  IR.hosts = {
    MAX: MAX,
    DASH_PIN: '1374',                 // Dashboard: Datei-Download nach PIN
    list: function () { return load(); },
    get: function (id) { return load().filter(function (h) { return h.id === id; })[0]; },

    add: function (h) {
      var list = load();
      if (list.length >= MAX) throw new Error('max ' + MAX + ' Hosts');
      var base = normBase(h.base || h.ip);
      if (!base) throw new Error('Adresse fehlt');
      var rec = { id: uid(), label: (h.label || base).slice(0, 40), base: base, token: (h.token || '').trim() };
      list.push(rec); persist(list); return rec;
    },
    update: function (id, patch) {
      var list = load(), hit = list.filter(function (h) { return h.id === id; })[0];
      if (!hit) return null;
      if (patch.base != null) hit.base = normBase(patch.base);
      if (patch.label != null) hit.label = patch.label;
      if (patch.token != null) hit.token = patch.token.trim();
      persist(list); return hit;
    },
    remove: function (id) { persist(load().filter(function (h) { return h.id !== id; })); },

    // ---- API-Aufrufe gegen einen Host (token-geschuetzt) ----
    info:    function (h) { return fetchJson(h.base + '/api/info?t=' + encodeURIComponent(h.token)); },
    devices: function (h) { return fetchJson(h.base + '/api/devices?t=' + encodeURIComponent(h.token)); },
    files:   function (h) { return fetchJson(h.base + '/api/list?t=' + encodeURIComponent(h.token)); },
    run: function (h, action, args) {
      return fetchJson(h.base + '/api/run', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, timeout: 3600000,
        body: JSON.stringify({ action: action, args: args || {}, t: h.token })
      });
    },
    downloadUrl: function (h, relPath) {
      return h.base + '/download?t=' + encodeURIComponent(h.token) + '&path=' + encodeURIComponent(relPath);
    },
    // Datei vom Host laden und als Text/JSON zurueck (z.B. ingest.json -> Playbook)
    fetchFileText: function (h, relPath) {
      return fetchJson(this.downloadUrl(h, relPath), { timeout: 60000 }).then(function (x) {
        return (typeof x === 'string') ? x : JSON.stringify(x);
      });
    },

    // Auto-Discovery: bekannte USB-/Hotspot-Adressen nach Control-Servern absuchen.
    // /api/info antwortet auch ohne Token (minimal) -> Host wird erkannt.
    candidates: function () {
      var set = {}, out = [];
      // netup-Default (Stick = .1), USB-Tethering, lokal
      ['http://10.13.37.1:8080', 'http://192.168.42.129:8080', 'http://192.168.42.1:8080',
       'http://172.20.10.1:8080', 'http://127.0.0.1:8080'].forEach(function (b) { if (!set[b]) { set[b] = 1; out.push(b); } });
      load().forEach(function (h) { if (!set[h.base]) { set[h.base] = 1; out.push(h.base); } });
      return out;
    },
    probe: function (base) {
      return fetchJson(base.replace(/\/+$/, '') + '/api/info', { timeout: 2500 })
        .then(function (j) { return (j && j.app === 'ir-pilot-control') ? { base: base.replace(/\/+$/, ''), info: j } : null; })
        .catch(function () { return null; });
    },
    discover: function (bases) {
      var self = this, list = bases || this.candidates();
      return Promise.all(list.map(function (b) { return self.probe(b); }))
        .then(function (rs) { return rs.filter(Boolean); });
    },
    // Gefundenen Host uebernehmen, falls noch nicht vorhanden (Token leer -> nachtragen)
    // Wirft nicht, wenn das Maximum erreicht ist (gibt dann null zurueck).
    adopt: function (base, info) {
      base = normBase(base);
      var exists = load().filter(function (h) { return h.base === base; })[0];
      if (exists) return exists;
      if (load().length >= MAX) return null;
      return this.add({ label: (info && (info.name || info.host)) || base, base: base, token: '' });
    },
    intakeUrl: function (h, name) {
      return h.base + '/api/intake?t=' + encodeURIComponent(h.token) + '&name=' + encodeURIComponent(name || 'intake.bin');
    }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = IR.hosts;
})(typeof window !== 'undefined' ? window : globalThis);
