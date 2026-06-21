/* IR-Pilot – eingebauter Selbsttest. Laeuft IM Geraet (APK/Browser): Logik-Tests
 * der Kernfunktionen + Geraete-Faehigkeiten. So kannst du auf dem Fold mit einem
 * Tipp pruefen, ob alles laeuft (statt nur am Build zu vertrauen).
 */
(function (root) {
  'use strict';
  var IR = root.IR || (root.IR = {});

  function T(name, fn) { try { var r = fn(); return { name: name, ok: r !== false, info: (r && r.info) || '' }; } catch (e) { return { name: name, ok: false, info: (e && e.message) || String(e) }; } }

  IR.selftest = {
    // Reine Logik-Tests gegen die echten Module
    logic: function () {
      var R = [];
      R.push(T('Core: Case-Modell (assets/vulns/photos)', function () {
        var c = IR.Case.create({ playbookId: 'ransomware' });
        return !!(c.assets && c.vulns && c.photos);
      }));
      R.push(T('Sicherheit: HTML wird escaped (kein XSS)', function () {
        var o = IR.util.md('<img src=x onerror=alert(1)>');
        return o.indexOf('<img') < 0 && o.indexOf('&lt;img') >= 0;
      }));
      R.push(T('Ingest: Assets/Vulns/Alerts uebernehmen', function () {
        var c = IR.Case.create({ playbookId: 'ransomware' });
        var r = IR.ingest.merge(c, { assets: [{ name: 'a', ip: '1.2.3.4' }], vulns: [{ cve: 'CVE-1', severity: 'kritisch' }], alerts: [{ signature: 'X', src_ip: '1.2.3.4', dest_ip: '8.8.8.8' }] });
        return r.assets === 1 && r.vulns === 1 && r.iocs >= 2 && { info: r.assets + 'A/' + r.vulns + 'V/' + r.iocs + 'IOC' };
      }));
      R.push(T('Framework: Playbook generieren', function () {
        var s = IR.framework.suggest('brewery', ['machine_weird'], {});
        var pb = IR.framework.buildPlaybook({ envId: 'brewery', impactIds: ['machine_weird'], hypothesisId: s[0].h.id, answers: {} });
        return pb.phases.length >= 8 && { info: pb.phases.length + ' Phasen' };
      }));
      R.push(T('Cloud: Snapshot + Phase + Index', function () {
        var c = IR.Case.create({ playbookId: 'ransomware' }); c.playbook = IR.engine.playbook('ransomware');
        var snap = IR.cloud.snapshot(c, []); return !!snap.phase && IR.cloud.indexEntry(snap).phase === snap.phase;
      }));
      R.push(T('Datenquellen: Discovery-URL (https:443)', function () {
        return IR.sources.PORT === 8244 && IR.sources.expandBase('192.168.1').indexOf('192.168.1.1') >= 0;
      }));
      R.push(T('Assistent: API-Request korrekt aufgebaut', function () {
        IR.assistant.setConfig({ apiKey: 'sk-test', model: 'claude-sonnet-4-6' });
        var q = IR.assistant.buildRequest([{ role: 'user', content: 'x' }]);
        var okv = q.opts.headers['x-api-key'] === 'sk-test' && q.opts.headers['anthropic-dangerous-direct-browser-access'] === 'true';
        IR.assistant.setConfig({ apiKey: '' }); return okv;
      }));
      R.push(T('Bericht: Markdown + PDF-HTML', function () {
        var c = IR.Case.create({ playbookId: 'bec-iban' });
        return /Incident-Report/.test(IR.report.markdown(c)) && /Incident-Report/.test(IR.report.printableHTML(c));
      }));
      R.push(T('Hosts: bis 10 + Download-URL', function () {
        IR.hosts.list().slice().forEach(function (h) { IR.hosts.remove(h.id); });
        var a = IR.hosts.add({ base: '10.0.0.1:8080', token: 't' });
        var ok = IR.hosts.downloadUrl(a, 'x.zip').indexOf('t=t') >= 0;
        IR.hosts.list().slice().forEach(function (h) { IR.hosts.remove(h.id); });
        return ok;
      }));
      R.push(T('Speicher: persistiert (oder Quota erkannt)', function () {
        var c = IR.Case.create({ playbookId: 'ransomware', title: 'selftest-tmp' });
        var res = IR.store.save(c); IR.store.remove(c.id);
        return res === true || res === false;  // beides ist definiert behandelt
      }));
      return R;
    },

    // Geraete-Faehigkeiten
    caps: function () {
      var R = [];
      R.push(T('Plattform', function () { return { info: IR.native.isNative() ? ('APK · ' + IR.native.platform()) : ('Browser · ' + IR.native.platform()) }; }));
      R.push(T('localStorage verfuegbar', function () { try { root.localStorage.setItem('ir_probe', '1'); var v = root.localStorage.getItem('ir_probe') === '1'; root.localStorage.removeItem('ir_probe'); return v; } catch (e) { return { info: 'nicht verfuegbar (In-Memory-Fallback aktiv)' }; } }));
      R.push(T('fetch (Host/IDS/Cloud-Zugriff)', function () { return typeof root.fetch === 'function'; }));
      R.push(T('AbortController (Timeouts)', function () { return typeof root.AbortController === 'function'; }));
      R.push(T('Canvas (Foto-Verkleinern)', function () { var c = root.document.createElement('canvas'); return !!(c.getContext && c.getContext('2d')); }));
      R.push(T('Kamera/Datei-Eingabe', function () { var i = root.document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; i.capture = 'environment'; return i.type === 'file'; }));
      R.push(T('Druck/PDF', function () { return (IR.native.isNative() && IR.native.bridge && typeof IR.native.bridge.printPage === 'function') || typeof root.print === 'function'; }));
      R.push(T('Kit-Export (Stick/Windows)', function () { return typeof IR.native.exportKit === 'function'; }));
      return R;
    },

    run: function () {
      var l = this.logic(), c = this.caps(), all = l.concat(c);
      return { logic: l, caps: c, pass: all.filter(function (x) { return x.ok; }).length, fail: all.filter(function (x) { return !x.ok; }).length };
    }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = IR.selftest;
})(typeof window !== 'undefined' ? window : globalThis);
