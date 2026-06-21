/* IR-Pilot – Bericht: erzeugt einen Markdown-Incident-Report aus einem Case. */
(function (root) {
  'use strict';
  var IR = root.IR || (root.IR = {});
  var U = IR.util;

  function h(t) { return U.fmtTs(t); }

  IR.report = {
    markdown: function (c) {
      var pb = IR.engine.playbook(c.playbookId);
      var L = [];
      L.push('# Incident-Report – ' + c.title);
      L.push('');
      L.push('- **Organisation:** ' + (c.org || '—'));
      L.push('- **Sektor:** ' + (c.sector || '—'));
      L.push('- **Responder:** ' + (c.responder || '—'));
      L.push('- **Einstufung:** ' + (c.classification || '—'));
      L.push('- **Playbook:** ' + (pb ? pb.title : c.playbookId || '—'));
      L.push('- **Erstellt:** ' + h(c.createdAt));
      L.push('- **Status:** ' + c.status);
      if (pb) { L.push(''); L.push('> ' + pb.oneLiner); }
      var prog = pb ? IR.engine.progress(pb, c) : null;
      if (prog) L.push('\n**Fortschritt Massnahmen:** ' + prog.done + '/' + prog.total + ' (' + prog.pct + ' %)');

      // Management Summary
      L.push('\n## 1. Kurzfassung');
      L.push(c.answers['summary'] || (pb ? pb.oneLiner : 'siehe Zeitachse.'));

      // Zeitachse
      L.push('\n## 2. Zeitachse');
      if (!c.timeline.length) L.push('_keine Eintraege_');
      c.timeline.forEach(function (t) {
        L.push('- `' + h(t.ts) + '` **' + t.kind + '** – ' + t.text + (t.by ? '  _(' + t.by + ')_' : ''));
      });

      // Beweise / Chain of Custody
      L.push('\n## 3. Beweismittel & Chain of Custody');
      if (!c.evidence.length) L.push('_keine Beweise erfasst_');
      c.evidence.forEach(function (e, i) {
        L.push('\n**' + (i + 1) + '. ' + e.name + '** (' + e.type + ', Fluechtigkeit: ' + (e.volatility || '—') + ')');
        L.push('- Quelle: ' + (e.source || '—') + ' · Methode: ' + (e.method || '—'));
        L.push('- SHA256: `' + (e.hash || '—') + '` · Groesse: ' + (e.size || '—'));
        L.push('- Ablage: ' + (e.location || '—') + ' · Gesichert von: ' + (e.collectedBy || '—') + ' · ' + h(e.ts));
        if (e.notes) L.push('- Notiz: ' + e.notes);
        (e.custody || []).forEach(function (cc) {
          L.push('  - Custody: `' + h(cc.ts) + '` ' + cc.action + ' → ' + cc.by + (cc.note ? ' (' + cc.note + ')' : ''));
        });
      });

      // IOCs
      L.push('\n## 4. Indicators of Compromise (IOC)');
      if (!c.iocs.length) L.push('_keine IOCs erfasst_');
      c.iocs.forEach(function (x) { L.push('- **' + x.type + '**: `' + x.value + '`' + (x.note ? ' – ' + x.note : '')); });

      // Kommunikation
      L.push('\n## 5. Kommunikation & Meldungen');
      if (!c.comms.length) L.push('_keine Kommunikation protokolliert_');
      c.comms.forEach(function (m) {
        L.push('- `' + h(m.ts) + '` **' + m.audience + '** (' + m.channel + ') – Status: ' + m.status);
      });

      // Massnahmen je Phase
      if (pb) {
        L.push('\n## 6. Durchgefuehrte Massnahmen');
        pb.phases.forEach(function (ph) {
          var steps = IR.engine.visibleSteps(ph, c);
          var done = steps.filter(function (s) { return c.checks[s.id]; });
          L.push('\n### ' + ph.title + ' (' + done.length + '/' + steps.length + ')');
          steps.forEach(function (s) {
            var mark = c.checks[s.id] ? '[x]' : '[ ]';
            var ans = c.answers[s.id] ? ' — _' + String(c.answers[s.id]).replace(/\n/g, ' ') + '_' : '';
            L.push('- ' + mark + ' ' + s.title + ans);
          });
        });
      }

      // offene Aufgaben
      L.push('\n## 7. Offene Aufgaben');
      var open = c.tasks.filter(function (t) { return !t.done; });
      if (!open.length) L.push('_keine offenen Aufgaben_');
      open.forEach(function (t) { L.push('- [ ] ' + t.text + (t.owner ? ' (@' + t.owner + ')' : '')); });

      L.push('\n---\n_Erzeugt mit IR-Pilot · ' + h(U.nowISO()) + ' · ' + (c.classification || '') + '_');
      return L.join('\n');
    },

    // Kompakte Krisen-Lagekarte (eine Bildschirmseite)
    sitrep: function (c) {
      var pb = IR.engine.playbook(c.playbookId);
      var prog = pb ? IR.engine.progress(pb, c) : { done: 0, total: 0, pct: 0 };
      return [
        'LAGEBERICHT – ' + c.title,
        'Zeit: ' + h(U.nowISO()) + ' · ' + (c.classification || ''),
        'Vorfall: ' + (pb ? pb.oneLiner : ''),
        'Fortschritt: ' + prog.done + '/' + prog.total + ' Massnahmen (' + prog.pct + '%)',
        'Beweise: ' + c.evidence.length + ' · IOCs: ' + c.iocs.length + ' · Meldungen: ' + c.comms.length,
        'Offene Aufgaben: ' + c.tasks.filter(function (t) { return !t.done; }).length
      ].join('\n');
    }
  };

  // Zeitachse als CSV (fuer Timeline-Tools / Doku)
  IR.report.timelineCSV = function (c) {
    var rows = [['timestamp', 'kind', 'text', 'by']];
    c.timeline.forEach(function (t) { rows.push([t.ts, t.kind, t.text, t.by || '']); });
    return rows.map(function (r) {
      return r.map(function (v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; }).join(',');
    }).join('\n');
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = IR.report;
})(typeof window !== 'undefined' ? window : globalThis);
