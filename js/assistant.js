/* IR-Pilot – KI-Assistent (Claude). Fragt fachliche IR/OT-Themen direkt aus der
 * App, z.B. "Offline-Log-Sicherung am Schutzgerät SIPROTEC 4". Nutzt deinen
 * EIGENEN Anthropic-API-Key (bleibt lokal im Browser/WebView, nie committet) und
 * ruft die Messages-API direkt – per anthropic-dangerous-direct-browser-access.
 */
(function (root) {
  'use strict';
  var IR = root.IR || (root.IR = {});
  var KEY = 'ir-assistant-v1', mem = null;
  var DEFAULT_MODEL = 'claude-sonnet-4-6';

  var MODELS = [
    { id: 'claude-sonnet-4-6', name: 'Sonnet 4.6 (Standard, schnell)' },
    { id: 'claude-opus-4-8', name: 'Opus 4.8 (max. Tiefe)' },
    { id: 'claude-haiku-4-5-20251001', name: 'Haiku 4.5 (sparsam)' }
  ];

  var SYSTEM = [
    'Du bist der Fach-Assistent in IR-Pilot, einem Incident-Response-Tool für einen',
    'Cyber Incident Responder im Einsatz (Smartphone, USB-Stick, oft OT/Industrie).',
    'Beantworte Fragen zu Incident Response, IT- und OT-Forensik, Beweissicherung,',
    'Schutz-/Automatisierungstechnik (z.B. Siemens SIPROTEC 4/5, SICAM, RTUs, SPS),',
    'Energie/KRITIS, Log- und Datensicherung. Sei präzise, schrittweise und',
    'sicherheitsbewusst: nenne konkrete Vorgehensweisen, Tools/Schnittstellen',
    '(z.B. DIGSI bei SIPROTEC, serielle/Ethernet-Zugänge, Stör-/Betriebsmeldepuffer),',
    'und weise auf Beweissicherung VOR Veränderung, Read-only und Chain-of-Custody hin.',
    'Wenn etwas geräte-/firmwareabhängig oder unsicher ist, sag es ehrlich und nenne,',
    'was am Gerät/Handbuch zu prüfen ist. Antworte standardmäßig auf Deutsch, knapp,',
    'mit nummerierten Schritten. Kein Hacking gegen fremde Systeme ohne Auftrag.'
  ].join(' ');

  var SUGGESTIONS = [
    'Offline-Log-Sicherung am Schutzgerät SIPROTEC 4 – wie gehe ich vor?',
    'Stör- und Betriebsmeldepuffer eines SIPROTEC-4-Relais beweissicher auslesen',
    'Windows-Server zeigt .locked-Dateien – erste 5 Schritte vor Ort?',
    'OT-Netz: passiven Mitschnitt am USB-Ethernet beweissicher aufsetzen'
  ];

  function store() { try { return root.localStorage; } catch (e) { return null; } }
  function loadCfg() {
    var s = store(), d = { apiKey: '', model: DEFAULT_MODEL };
    if (s) { try { return Object.assign(d, JSON.parse(s.getItem(KEY) || '{}')); } catch (e) { return d; } }
    return Object.assign(d, mem || {});
  }
  function saveCfg(cfg) {
    var c = Object.assign({ apiKey: '', model: DEFAULT_MODEL }, cfg);
    var s = store(); if (s) { try { s.setItem(KEY, JSON.stringify(c)); } catch (e) {} }
    mem = c; return c;
  }

  IR.assistant = {
    MODELS: MODELS, SUGGESTIONS: SUGGESTIONS, DEFAULT_MODEL: DEFAULT_MODEL,
    config: loadCfg,
    setConfig: function (p) { return saveCfg(Object.assign(loadCfg(), p)); },
    enabled: function () { return !!loadCfg().apiKey; },

    // Baut die API-Anfrage (testbar ohne Netz).
    buildRequest: function (history) {
      var c = loadCfg();
      var msgs = (history || []).filter(function (m) { return m && m.content; })
        .map(function (m) { return { role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content) }; });
      return {
        url: 'https://api.anthropic.com/v1/messages',
        opts: {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-api-key': c.apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true'
          },
          body: JSON.stringify({ model: c.model || DEFAULT_MODEL, max_tokens: 1024, system: SYSTEM, messages: msgs })
        }
      };
    },

    ask: function (history) {
      if (!this.enabled()) return Promise.reject(new Error('Kein API-Key hinterlegt'));
      if (typeof root.fetch !== 'function') return Promise.reject(new Error('kein fetch'));
      var req = this.buildRequest(history);
      return root.fetch(req.url, req.opts).then(function (r) {
        return r.json().then(function (j) {
          if (!r.ok) throw new Error((j && j.error && j.error.message) || ('HTTP ' + r.status));
          var txt = (j.content || []).filter(function (b) { return b.type === 'text'; })
            .map(function (b) { return b.text; }).join('\n').trim();
          return txt || '(leere Antwort)';
        });
      });
    }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = IR.assistant;
})(typeof window !== 'undefined' ? window : globalThis);
