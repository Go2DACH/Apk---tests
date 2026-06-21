/* IR-Pilot – Fragebogen (Kundensicht, ohne Technikbezug). Antworten gewichten
 * die Cyber-Hypothesen (boost) und setzen Flags (z.B. Safety, Backups). */
(function (root) {
  'use strict';
  var IR = root.IR || (root.IR = {});

  // yesno: {yes:{boost,set}}  single: options:[{label,boost,set}]  text
  IR.questions = [
    { id: 'q_when', type: 'text', q: 'Wann wurde es zuerst bemerkt? (Datum/Uhrzeit, seit wann?)' },
    { id: 'q_what', type: 'text', q: 'Was genau wurde beobachtet? (in eigenen Worten)' },
    { id: 'q_safety', type: 'yesno', q: 'Besteht Gefahr fuer Menschen, Umwelt oder die Versorgung?',
      yes: { boost: { ot_manipulation: 4, rat: 2 }, set: { safety: true } } },
    { id: 'q_scope', type: 'single', q: 'Wie viel ist betroffen?', options: [
      { label: 'Ein einzelnes Geraet', boost: { endpoint_malware: 3, benign_fault: 2 } },
      { label: 'Mehrere Geraete/Abteilungen', boost: { ransomware: 3, identity_ad: 3 } },
      { label: 'Praktisch alles', boost: { ransomware: 5, wiper: 3, identity_ad: 2 } },
      { label: 'Unklar', boost: {} }
    ] },
    { id: 'q_ransom', type: 'yesno', q: 'Gibt es eine Erpressernachricht oder Loesegeldforderung?',
      yes: { boost: { ransomware: 6, extortion_only: 4, exfil: 2 } } },
    { id: 'q_money', type: 'yesno', q: 'Sind Bankdaten, Rechnungen oder Zahlungen betroffen?',
      yes: { boost: { bec: 6, endpoint_malware: 2 } } },
    { id: 'q_login', type: 'yesno', q: 'Funktionieren Logins nicht mehr oder wurden Konten uebernommen?',
      yes: { boost: { identity_ad: 4, phishing: 4, cloud_takeover: 3, brute_force: 3 } } },
    { id: 'q_remote', type: 'yesno', q: 'Bewegt sich etwas von allein (Maus/Anlage) oder greift jemand fern zu?',
      yes: { boost: { rat: 6 } } },
    { id: 'q_remote_legit', type: 'yesno', q: 'Koennte es eine angekuendigte/legitime Fernwartung sein?',
      showIf: { answer: 'q_remote', equals: 'ja' },
      yes: { boost: { benign_misconfig: 6 } } },
    { id: 'q_machine', type: 'yesno', q: 'Verhaelt sich eine Maschine/Anlage seltsam oder zeigt falsche Werte?',
      showIf: { envTag: 'ot' }, yes: { boost: { ot_manipulation: 5, benign_misconfig: 2 } } },
    { id: 'q_web', type: 'yesno', q: 'Ist die Webseite oder der Online-Shop betroffen?',
      showIf: { envTag: 'web' }, yes: { boost: { webshell: 4, ddos: 4 } } },
    { id: 'q_vendor', type: 'yesno', q: 'War kuerzlich ein Dienstleister/Wartung/Fremdgeraet im Einsatz oder gab es ein Update?',
      yes: { boost: { supplychain: 5 } } },
    { id: 'q_alert_src', type: 'single', q: 'Woher kommt der Hinweis?', options: [
      { label: 'Sichtbarer Schaden/Ausfall', boost: {} },
      { label: 'Nur eine Warnmeldung (Virenschutz/IDS)', boost: { endpoint_malware: 3, benign_misconfig: 2 } },
      { label: 'Hinweis von aussen (Lieferant/Behoerde/Kunde)', boost: { supplychain: 3, exfil: 2 } }
    ] },
    { id: 'q_backups', type: 'single', q: 'Gibt es Backups?', options: [
      { label: 'Ja, offline/getrennt', set: { backups_ok: true } },
      { label: 'Ja, aber online erreichbar', set: { backups_ok: false } },
      { label: 'Nein', set: { backups_ok: false } },
      { label: 'Unklar', set: {} }
    ] },
    { id: 'q_changed', type: 'yesno', q: 'Wurde vorher etwas geaendert (Update, Konfiguration, neue Technik)?',
      yes: { boost: { benign_misconfig: 4 } } }
  ];

  // Auswertung: liefert {boosts:{hypId:n}, flags:{}, answers:{}}
  IR.qeval = function (answers) {
    answers = answers || {};
    var boosts = {}, flags = {};
    function addB(b) { if (b) Object.keys(b).forEach(function (k) { boosts[k] = (boosts[k] || 0) + b[k]; }); }
    function addS(s) { if (s) Object.keys(s).forEach(function (k) { flags[k] = s[k]; }); }
    IR.questions.forEach(function (q) {
      var v = answers[q.id]; if (v == null || v === '') return;
      if (q.type === 'yesno') { if (v === 'ja' && q.yes) { addB(q.yes.boost); addS(q.yes.set); } }
      else if (q.type === 'single') { var o = q.options[+v]; if (o) { addB(o.boost); addS(o.set); } }
    });
    return { boosts: boosts, flags: flags, answers: answers };
  };

  // sichtbare Fragen je Kontext (env-Tags / vorherige Antworten)
  IR.visibleQuestions = function (env, answers) {
    answers = answers || {};
    return IR.questions.filter(function (q) {
      if (!q.showIf) return true;
      if (q.showIf.envTag) return env && env.tags.indexOf(q.showIf.envTag) >= 0;
      if (q.showIf.answer) return answers[q.showIf.answer] === q.showIf.equals;
      return true;
    });
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = IR.questions;
})(typeof window !== 'undefined' ? window : globalThis);
