/* IR-Pilot – Datenquellen (Daten-Lieferanten wie ein IDS/Asset-Inventar/
 * Schwachstellen-Management). Anders als Forensik-Hosts (Boot-Sticks) liefern
 * Datenquellen per JSON: Assets, Schwachstellen, IOCs, Hosts, IDS-Alerts.
 * Die App ruft die URL ab und merged das Ergebnis ueber IR.ingest in den Fall.
 *
 * Erwartetes JSON (alles optional, Felder siehe docs/integration-ids.md):
 *   { "source":"mein-ids",
 *     "assets":[{name,ip,mac,type,os,location,owner,criticality}],
 *     "vulns":[{asset,cve,cvss,severity,title,status}],
 *     "alerts":[{ts,signature,severity,src_ip,dest_ip}],
 *     "iocs":[{type,value,note}], "hosts":[{ip,name,ports,note}] }
 */
(function (root) {
  'use strict';
  var IR = root.IR || (root.IR = {});
  var MAX = 10, KEY = 'ir-sources-v1', mem = null;

  function store() { try { return root.localStorage; } catch (e) { return null; } }
  function load() {
    var s = store();
    if (s) { try { return JSON.parse(s.getItem(KEY) || '[]'); } catch (e) { return []; } }
    return mem || (mem = []);
  }
  function persist(list) { var s = store(); if (s) { try { s.setItem(KEY, JSON.stringify(list)); } catch (e) {} } mem = list; }
  function uid() { return 's' + Math.random().toString(36).slice(2, 9); }
  function normUrl(u) { u = String(u || '').trim(); if (u && !/^https?:\/\//i.test(u)) u = 'http://' + u; return u; }

  function fetchJson(url, opts) {
    if (typeof root.fetch !== 'function') return Promise.reject(new Error('kein fetch'));
    var ctrl = (typeof root.AbortController === 'function') ? new root.AbortController() : null;
    var t = ctrl ? setTimeout(function () { ctrl.abort(); }, (opts && opts.timeout) || 12000) : null;
    var o = Object.assign({}, opts); if (ctrl) o.signal = ctrl.signal;
    return root.fetch(url, o).then(function (r) {
      if (t) clearTimeout(t);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }
  // Beliebige IDS-Antwort auf das Ingest-Bundle normalisieren.
  function toBundle(data, label) {
    if (Array.isArray(data)) return { source: label, assets: data };           // reine Asset-Liste
    if (data && typeof data === 'object') {
      var b = Object.assign({}, data);
      if (!b.source) b.source = label;
      // gaengige Aliasnamen tolerieren
      if (!b.vulns && b.vulnerabilities) b.vulns = b.vulnerabilities;
      if (!b.assets && b.inventory) b.assets = b.inventory;
      if (!b.alerts && b.events) b.alerts = b.events;
      return b;
    }
    return { source: label };
  }

  IR.sources = {
    MAX: MAX,
    PORT: 8244,                          // Standard-Port der IDS-Webseite
    PATH: '/api/ir-pilot/export',        // erwarteter Export-Endpunkt
    list: function () { return load(); },
    get: function (id) { return load().filter(function (s) { return s.id === id; })[0]; },
    add: function (s) {
      var list = load(); if (list.length >= MAX) throw new Error('max ' + MAX + ' Quellen');
      var url = normUrl(s.url); if (!url) throw new Error('URL fehlt');
      var rec = { id: uid(), label: (s.label || url).slice(0, 40), url: url, token: (s.token || '').trim(), kind: s.kind || 'ids' };
      list.push(rec); persist(list); return rec;
    },
    update: function (id, p) {
      var list = load(), hit = list.filter(function (s) { return s.id === id; })[0]; if (!hit) return null;
      if (p.url != null) hit.url = normUrl(p.url);
      if (p.label != null) hit.label = p.label;
      if (p.token != null) hit.token = p.token.trim();
      persist(list); return hit;
    },
    remove: function (id) { persist(load().filter(function (s) { return s.id !== id; })); },

    buildRequest: function (s) {
      var headers = { 'Accept': 'application/json' };
      if (s.token) headers['Authorization'] = 'Bearer ' + s.token;
      return { url: s.url, opts: { headers: headers, timeout: 12000 } };
    },
    // Quelle abrufen -> normalisiertes Ingest-Bundle (noch nicht gemerged).
    fetchBundle: function (s) {
      var req = this.buildRequest(s);
      return fetchJson(req.url, req.opts).then(function (data) { return toBundle(data, s.label || s.kind || 'ids'); });
    },
    // Abrufen UND in einen Fall mergen (nutzt IR.ingest).
    pullInto: function (s, cse) {
      return this.fetchBundle(s).then(function (bundle) { return IR.ingest.merge(cse, bundle); });
    },
    toBundle: toBundle
  };

  // ---------------- Auto-Discovery der IDS-Webseite (Port 8244) ----------------
  // Subnetz aus vorhandenen Quellen/Hosts erraten, sonst gaengiges Heimnetz.
  function guessSubnet() {
    function octets(u) { var m = String(u || '').match(/(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.\d{1,3}/); return m ? m[1] + '.' + m[2] + '.' + m[3] : null; }
    var fromSrc = load().map(function (s) { return octets(s.url); }).filter(Boolean)[0];
    if (fromSrc) return fromSrc;
    try {
      var fromHost = (IR.hosts ? IR.hosts.list() : []).map(function (h) { return octets(h.base); }).filter(Boolean)[0];
      if (fromHost) return fromHost;
    } catch (e) {}
    return '192.168.1';
  }
  // Liste der zu probenden IPs aus einer Eingabe ("192.168.1", "192.168.1.0/24",
  // einzelne IP oder Komma-Liste) + ein paar gaengige Gateways.
  function expandBase(base) {
    base = String(base || '').trim();
    var ips = {}, add = function (x) { if (/^\d{1,3}(\.\d{1,3}){3}$/.test(x)) ips[x] = 1; };
    base.split(',').map(function (s) { return s.trim(); }).forEach(function (b) {
      if (!b) return;
      b = b.replace(/\/\d+$/, '').replace(/\.0$/, '');
      if (/^\d{1,3}(\.\d{1,3}){3}$/.test(b)) { add(b); return; }              // einzelne IP
      var m = b.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);                    // /24-Basis
      if (m) { for (var i = 1; i <= 254; i++) add(b + '.' + i); }
    });
    ['192.168.0.1', '192.168.1.1', '192.168.178.1', '10.0.0.1'].forEach(add);
    return Object.keys(ips);
  }
  function probeOne(ip, port, token, timeout) {
    if (typeof root.fetch !== 'function') return Promise.resolve(null);
    var url = 'http://' + ip + ':' + (port || IR.sources.PORT) + IR.sources.PATH;
    var ctrl = (typeof root.AbortController === 'function') ? new root.AbortController() : null;
    var t = ctrl ? setTimeout(function () { ctrl.abort(); }, timeout || 1500) : null;
    var headers = { 'Accept': 'application/json' }; if (token) headers['Authorization'] = 'Bearer ' + token;
    return root.fetch(url, { headers: headers, signal: ctrl ? ctrl.signal : undefined }).then(function (r) {
      if (t) clearTimeout(t);
      // 200 = offen, 401 = IDS vorhanden, braucht Token. Beides = Treffer.
      if (r.status === 200 || r.status === 401) return { ip: ip, port: (port || IR.sources.PORT), url: url, needsToken: r.status === 401 };
      return null;
    }).catch(function () { if (t) clearTimeout(t); return null; });
  }
  function pool(items, worker, limit) {
    return new Promise(function (resolve) {
      var i = 0, active = 0, done = 0, n = items.length, out = [];
      if (!n) return resolve(out);
      (function next() {
        while (active < limit && i < n) {
          active++;
          worker(items[i++]).then(function (r) { if (r) out.push(r); }).catch(function () {}).then(function () {
            active--; done++; if (done === n) resolve(out); else next();
          });
        }
      })();
    });
  }
  IR.sources.guessSubnet = guessSubnet;
  IR.sources.expandBase = expandBase;
  IR.sources.probe = probeOne;
  // IDS im (Sub-)Netz suchen. base = "192.168.1" o.ae.; opts.token optional.
  IR.sources.discover = function (base, opts) {
    opts = opts || {};
    var ips = expandBase(base || guessSubnet());
    var port = opts.port || IR.sources.PORT, token = opts.token || '';
    return pool(ips, function (ip) { return probeOne(ip, port, token, opts.timeout || 1500); }, opts.concurrency || 24);
  };
  // Gefundenes IDS als Datenquelle uebernehmen (sofern noch nicht vorhanden).
  IR.sources.adopt = function (found, label) {
    var exists = load().filter(function (s) { return s.url === found.url; })[0];
    if (exists) return exists;
    if (load().length >= MAX) return null;
    return IR.sources.add({ label: label || ('IDS ' + found.ip), url: found.url, token: '' });
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = IR.sources;
})(typeof window !== 'undefined' ? window : globalThis);
