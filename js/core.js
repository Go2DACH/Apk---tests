/* IR-Pilot – Kern: Namespace, Utilities, Fall-Datenmodell (Case), Persistenz.
 * Laeuft im Browser (script-Tag) und in Node (require) – haengt sich an globalThis.IR.
 * Bewusst ohne Build-Schritt/Abhaengigkeiten, damit es per file:// vom USB-Stick laeuft.
 */
(function (root) {
  'use strict';
  var IR = root.IR || (root.IR = {});

  /* ---------------------------------------------------------------- Utils */
  var U = IR.util = {
    uid: function (p) {
      return (p || 'id') + '-' + Date.now().toString(36) + '-' +
        Math.random().toString(36).slice(2, 8);
    },
    nowISO: function () { return new Date().toISOString(); },
    pad: function (n) { return (n < 10 ? '0' : '') + n; },
    fmtTs: function (iso) {
      try {
        var d = new Date(iso);
        return d.getFullYear() + '-' + U.pad(d.getMonth() + 1) + '-' +
          U.pad(d.getDate()) + ' ' + U.pad(d.getHours()) + ':' +
          U.pad(d.getMinutes());
      } catch (e) { return iso; }
    },
    esc: function (s) {
      return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    },
    // Minimaler Markdown -> HTML (Ueberschriften, fett, code, Listen, Absaetze).
    md: function (src) {
      if (!src) return '';
      var lines = String(src).split('\n'), out = [], inUl = false, inCode = false;
      function closeUl() { if (inUl) { out.push('</ul>'); inUl = false; } }
      for (var i = 0; i < lines.length; i++) {
        var ln = lines[i];
        if (/^```/.test(ln)) {
          if (!inCode) { closeUl(); out.push('<pre><code>'); inCode = true; }
          else { out.push('</code></pre>'); inCode = false; }
          continue;
        }
        if (inCode) { out.push(U.esc(ln)); continue; }
        var inl = function (t) {
          return U.esc(t)
            .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
            .replace(/`([^`]+)`/g, '<code>$1</code>');
        };
        if (/^#{1,4}\s/.test(ln)) {
          closeUl();
          var lvl = ln.match(/^#+/)[0].length;
          out.push('<h' + lvl + '>' + inl(ln.replace(/^#+\s/, '')) + '</h' + lvl + '>');
        } else if (/^\s*[-*]\s+/.test(ln)) {
          if (!inUl) { out.push('<ul>'); inUl = true; }
          out.push('<li>' + inl(ln.replace(/^\s*[-*]\s+/, '')) + '</li>');
        } else if (/^\s*$/.test(ln)) {
          closeUl();
        } else {
          closeUl();
          out.push('<p>' + inl(ln) + '</p>');
        }
      }
      closeUl(); if (inCode) out.push('</code></pre>');
      return out.join('\n');
    }
  };

  /* ----------------------------------------------------------- Case-Modell */
  // Ein "Case" buendelt den gesamten Vorfall: Metadaten, Zeitachse (audit-log),
  // Antworten/Checks aus dem Playbook, Beweise (mit Hash + Chain of Custody),
  // IOCs, Kommunikations-Log und abgeleitete Aufgaben.
  IR.Case = {
    create: function (opts) {
      opts = opts || {};
      return {
        schema: 1,
        id: U.uid('case'),
        createdAt: U.nowISO(),
        title: opts.title || 'Unbenannter Vorfall',
        org: opts.org || '',
        sector: opts.sector || '',
        responder: opts.responder || '',
        classification: opts.classification || 'TLP:AMBER',
        playbookId: opts.playbookId || null,
        status: 'offen',
        flags: {},            // Entscheidungs-Flags (z.B. {leben_gefahr:true})
        answers: {},          // stepId -> erfasster Wert
        checks: {},           // stepId -> bool (abgehakt)
        timeline: [],         // {ts, kind, text, by}
        evidence: [],         // siehe addEvidence
        iocs: [],             // {ts, type, value, note}
        comms: [],            // {ts, audience, channel, status, content}
        tasks: [],            // {ts, text, owner, done}
        notes: []             // freie Notizen
      };
    },

    log: function (c, kind, text, by) {
      c.timeline.push({ ts: U.nowISO(), kind: kind || 'note', text: text, by: by || c.responder || '' });
      return c;
    },

    setFlag: function (c, k, v) { c.flags[k] = v; IR.Case.log(c, 'decision', 'Flag ' + k + ' = ' + v); return c; },
    answer: function (c, stepId, val) { c.answers[stepId] = val; return c; },
    check: function (c, stepId, val) {
      c.checks[stepId] = !!val;
      return c;
    },

    addEvidence: function (c, e) {
      e = e || {};
      var ev = {
        id: U.uid('ev'),
        ts: U.nowISO(),
        name: e.name || 'Beweis',
        type: e.type || 'datei',           // datei|image|memory|log|netzwerk|foto|aussage
        source: e.source || '',            // Host/Geraet/System
        method: e.method || '',            // wie gesichert (Tool/Befehl)
        hash: e.hash || '',                // sha256
        size: e.size || '',
        location: e.location || '',        // Ablage (USB-Stick/Asservat)
        collectedBy: e.collectedBy || c.responder || '',
        volatility: e.volatility || '',    // hoch/mittel/niedrig
        notes: e.notes || '',
        custody: [{ ts: U.nowISO(), action: 'gesichert', by: e.collectedBy || c.responder || '', note: e.location || '' }]
      };
      c.evidence.push(ev);
      IR.Case.log(c, 'evidence', 'Beweis gesichert: ' + ev.name + (ev.hash ? ' (sha256 ' + ev.hash.slice(0, 12) + '…)' : ''));
      return ev;
    },
    custodyTransfer: function (c, evId, action, by, note) {
      var ev = c.evidence.filter(function (x) { return x.id === evId; })[0];
      if (!ev) return null;
      ev.custody.push({ ts: U.nowISO(), action: action, by: by, note: note || '' });
      IR.Case.log(c, 'custody', 'Asservat ' + ev.name + ': ' + action + ' -> ' + by);
      return ev;
    },

    addIoc: function (c, type, value, note) {
      var ioc = { ts: U.nowISO(), type: type, value: value, note: note || '' };
      c.iocs.push(ioc); IR.Case.log(c, 'ioc', 'IOC ' + type + ': ' + value);
      return ioc;
    },
    addComm: function (c, m) {
      var x = { ts: U.nowISO(), audience: m.audience, channel: m.channel || '', status: m.status || 'entwurf', content: m.content || '' };
      c.comms.push(x); IR.Case.log(c, 'comms', 'Kommunikation (' + x.audience + ', ' + x.status + ')');
      return x;
    },
    addTask: function (c, text, owner) {
      var t = { id: U.uid('task'), ts: U.nowISO(), text: text, owner: owner || '', done: false };
      c.tasks.push(t); return t;
    }
  };

  /* ------------------------------------------------------------ Persistenz */
  IR.store = {
    key: 'ir_pilot_cases',
    _ls: function () {
      try { return root.localStorage; } catch (e) { return null; }
    },
    list: function () {
      var ls = this._ls(); if (!ls) return IR._mem || (IR._mem = []);
      try { return JSON.parse(ls.getItem(this.key) || '[]'); } catch (e) { return []; }
    },
    saveAll: function (arr) {
      var ls = this._ls(); if (!ls) { IR._mem = arr; return; }
      ls.setItem(this.key, JSON.stringify(arr));
    },
    save: function (c) {
      var all = this.list(), i = all.findIndex(function (x) { return x.id === c.id; });
      if (i >= 0) all[i] = c; else all.push(c);
      this.saveAll(all); return c;
    },
    get: function (id) { return this.list().filter(function (x) { return x.id === id; })[0] || null; },
    remove: function (id) { this.saveAll(this.list().filter(function (x) { return x.id !== id; })); }
  };

  /* --------------------------------------------------------------- Engine */
  // Berechnet die sichtbaren Schritte eines Playbooks fuer den aktuellen Fall
  // (showIf wird gegen flags/answers ausgewertet) und den Fortschritt.
  IR.engine = {
    visibleSteps: function (phase, c) {
      return (phase.steps || []).filter(function (s) {
        return !s.showIf || IR.engine.evalCond(s.showIf, c);
      });
    },
    evalCond: function (cond, c) {
      // cond: {flag:'x', equals:true} | {answered:'stepId'} | {any:[...]} | {all:[...]}
      if (cond.any) return cond.any.some(function (x) { return IR.engine.evalCond(x, c); });
      if (cond.all) return cond.all.every(function (x) { return IR.engine.evalCond(x, c); });
      if (cond.flag != null) return c.flags[cond.flag] === (cond.equals == null ? true : cond.equals);
      if (cond.answered != null) return c.answers[cond.answered] != null && c.answers[cond.answered] !== '';
      return true;
    },
    progress: function (pb, c) {
      var total = 0, done = 0;
      (pb.phases || []).forEach(function (ph) {
        IR.engine.visibleSteps(ph, c).forEach(function (s) {
          if (s.type === 'check' || s.type === 'evidence' || s.type === 'comms' || s.type === 'tool') {
            total++; if (c.checks[s.id]) done++;
          }
        });
      });
      return { total: total, done: done, pct: total ? Math.round(done * 100 / total) : 0 };
    },
    playbook: function (id) {
      return (IR.playbooks || []).filter(function (p) { return p.id === id; })[0] || null;
    }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = IR;
})(typeof window !== 'undefined' ? window : globalThis);
