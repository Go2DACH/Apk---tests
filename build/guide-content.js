/* Inhalt der beiden PDFs (Anleitung + Testplan). Exportiert HTML-Bauer. */
'use strict';

var CSS = '<style>' +
  'body{font:12.5px/1.5 system-ui,Segoe UI,Roboto,sans-serif;color:#15212e;margin:0}' +
  'h1{color:#123e63;font-size:23px;margin:0 0 2px}h2{color:#1f4e79;font-size:16px;margin:18px 0 6px;border-bottom:2px solid #d7e3ef;padding-bottom:3px}' +
  'h3{font-size:13.5px;margin:12px 0 4px;color:#22425e}p{margin:5px 0}small{color:#5a6b7c}' +
  'code{background:#eef3f8;border:1px solid #dbe6f0;border-radius:4px;padding:1px 5px;font-size:11.5px}' +
  '.lead{color:#456;margin:2px 0 10px}.tag{display:inline-block;background:#123e63;color:#fff;border-radius:10px;padding:1px 9px;font-size:11px;margin-right:6px}' +
  'table{border-collapse:collapse;width:100%;margin:6px 0;font-size:11.6px}th,td{border:1px solid #c9d6e3;padding:5px 7px;text-align:left;vertical-align:top}' +
  'th{background:#eaf1f8;color:#1f4e79}tr:nth-child(even) td{background:#f7fafd}' +
  '.ck{width:34px;text-align:center}.sev{font-weight:700}.sev.k{color:#c0392b}.sev.h{color:#d35400}.sev.m{color:#1e8449}' +
  '.fig{margin:8px 0;text-align:center;page-break-inside:avoid}.fig img{max-width:62%;border:1px solid #c4d2e0;border-radius:8px}' +
  '.fig figcaption{font-size:11px;color:#5a6b7c;margin-top:3px}' +
  '.box{background:#f3f8fc;border:1px solid #d7e3ef;border-left:4px solid #1f4e79;border-radius:6px;padding:8px 11px;margin:8px 0}' +
  '.warn{background:#fff5ef;border-left-color:#d35400}.ok{background:#f0faf4;border-left-color:#1e8449}' +
  '.sec{page-break-inside:avoid}.brk{page-break-before:always}' +
  'ul{margin:5px 0 5px 18px;padding:0}li{margin:2px 0}' +
  '.foot{margin-top:14px;border-top:1px solid #ccd;padding-top:6px;color:#5a6b7c;font-size:10.5px}' +
  '@page{size:A4;margin:0}' +
  '</style>';

function fig(img, file, cap) {
  return '<div class="fig"><img src="' + img(file) + '"><figcaption>' + cap + '</figcaption></div>';
}
function head(esc, title, sub) {
  return '<div style="background:linear-gradient(135deg,#0e2740,#1f4e79);color:#fff;padding:18px 20px;margin:0 0 14px">' +
    '<div style="font-size:13px;opacity:.85">🛡️ IR-Pilot &middot; geführtes Incident-Response-Tool</div>' +
    '<h1 style="color:#fff;margin:4px 0 0">' + esc(title) + '</h1>' +
    '<div style="opacity:.9;font-size:12px;margin-top:3px">' + esc(sub) + '</div></div>';
}
function pad(s) { return '<div style="padding:0 20px 20px">' + s + '</div>'; }

/* ----------------------------------------------------------- Anleitung */
function anleitung(esc, img) {
  var s = '<!doctype html><meta charset="utf-8">' + CSS + head(esc, 'Bedienanleitung', 'Vom Vorfall zum Bericht – Smartphone, USB-Stick, Cloud & Dashboard · Stand 2026-06-21');
  var b = '';

  b += '<div class="sec"><h2>1 · Was ist IR-Pilot?</h2>' +
    '<p>Ein <b>playbook-basiertes Werkzeug für Cyber Incident Responder</b>. Du wählst Umgebung &amp; Beobachtung, ' +
    'beantwortest einen kurzen Fragebogen, bekommst eine erste Vermutung und ein <b>geführtes Playbook</b> – mit ' +
    'Krisenkommunikation, Meldepflichten, Forensik (inkl. <i>worauf achten</i>), Beweissicherung <b>vor</b> Restore und ' +
    'begleitetem Wiederanlauf. Reines HTML/JS, <b>offline-fähig</b>, läuft im Browser des Galaxy&nbsp;Fold&nbsp;5.</p>' +
    '<div class="box"><b>Datenfluss:</b> Endpoints (Boot-Stick / Windows-Sammler) → <b>App</b> (zentral) → ' +
    '<b>Git-Cloud</b> (cloud/incidents) → <b>Pages-Dashboard</b>. Forensik-Rohdaten bleiben am Endpoint, in der Cloud nur ' +
    'Metadaten + Report + Verweise.</div></div>';

  b += '<div class="sec"><h2>2 · Installation</h2>' +
    '<h3>Als App (APK, empfohlen unterwegs)</h3><ul>' +
    '<li>APK aufs Handy kopieren, antippen, „unbekannte Quellen" für den Dateimanager erlauben, installieren.</li>' +
    '<li>Debug-signiert → fürs Sideload gedacht. Cleartext zu lokalen Forensik-Hosts ist in der APK erlaubt.</li></ul>' +
    '<h3>Als Web-App (PWA, GitHub Pages)</h3><ul>' +
    '<li>Seite öffnen, im Browser-Menü „Zum Startbildschirm hinzufügen" → installierbar, offline.</li>' +
    '<li><b>Wichtig:</b> Die <i>https</i>-Pages-App kann lokale <i>http</i>-Hosts wegen <b>Mixed-Content</b> nicht direkt ' +
    'steuern – dafür die <b>APK</b> nutzen oder die App <b>vom Stick</b> (http) laden.</li></ul>' +
    '<h3>Vom USB-Stick (offline)</h3><ul><li><code>index.html</code> direkt im Browser öffnen (file://) – alle Daten sind an Bord.</li></ul></div>';

  b += '<div class="brk"></div>';
  b += '<div class="sec"><h2>3 · Start</h2><p>Schnellstart-Szenarien, generisches Playbook, Assistent und die Einstiege ' +
    '„Geräte/Forensik", „Forensik-Hosts", „Live-Dashboard", „Cloud".</p>' + fig(img, 'guide-home.png', 'Start-Ansicht') + '</div>';

  b += '<div class="sec"><h2>4 · Geführter Vorfall</h2>' +
    '<p>Der Assistent führt in 4 Schritten: <b>Umgebung</b> (≥50 Typen) → <b>Beobachtung</b> (Kundensicht) → ' +
    '<b>Fragebogen</b> → <b>Vermutung</b>. Daraus wird ein Playbook erzeugt.</p>' +
    fig(img, 'guide-wizard.png', 'Assistent – Umgebung & Beobachtung') +
    '<p>Das Playbook startet mit dem Gate „Vorfall oder Fehlalarm?" und führt phasenweise durch Triage, Kommunikation, ' +
    'Forensik, Eindämmung, Bereinigung, Wiederanlauf, Ermittlung, Abschluss.</p>' +
    fig(img, 'guide-playbook.png', 'Geführtes Playbook (Beispiel BEC)') + '</div>';

  b += '<div class="brk"></div>';
  b += '<div class="sec"><h2>5 · Befunde aus Daten – automatisch im Playbook</h2>' +
    '<p>Importierte Daten (IOCs, Hosts, Beweise) erscheinen als Panel <b>„📥 Befunde aus Daten"</b> direkt in der ' +
    'Forensik-Phase – genau dort, wo „Worauf achten (Entscheidung)" steht. Das Tool entscheidet <b>bewusst nicht</b> ' +
    'automatisch Confirm/Refute; du bewertest und setzt die Entscheidung mit einem Tap.</p>' +
    fig(img, 'guide-findings.png', 'Befunde aus Daten an der Entscheidungsstelle') + '</div>';

  b += '<div class="sec"><h2>6 · Beweise &amp; Chain of Custody</h2>' +
    '<p>Beweise mit Quelle, Methode, SHA256, Ablage und Flüchtigkeit; Übergaben werden protokolliert.</p>' +
    fig(img, 'guide-evidence.png', 'Beweise & Chain of Custody') + '</div>';

  b += '<div class="brk"></div>';
  b += '<div class="sec"><h2>7 · Bericht &amp; Daten-Import</h2>' +
    '<p>Incident-Report (Markdown), Timeline-CSV, Lagebericht, Fall-Export (JSON) und Daten-Import (ingest.json / Quick-Paste). ' +
    'Hier auch <b>„☁️ In Cloud veröffentlichen"</b>.</p>' + fig(img, 'guide-report.png', 'Bericht & Daten') + '</div>';

  b += '<div class="sec"><h2>8 · Forensik-Toolkit</h2>' +
    '<p>Read-only Triage/Sicherung: Windows/Linux/AD/M365, OT-Capture, Memory, Velociraptor, UAC, Timeline, CyberChef offline. ' +
    'Skript anzeigen, kopieren, herunterladen → am Zielsystem ausführen.</p>' + fig(img, 'guide-tools.png', 'Forensik-Toolkit') + '</div>';

  b += '<div class="brk"></div>';
  b += '<div class="sec"><h2>9 · Geräte &amp; native Forensik</h2>' +
    '<p>Erkennt APK vs. Browser. Capture/Scan/Flash laufen nativ (APK) bzw. via Anleitung/Skript; inkl. „Boot-Stick fernsteuern".</p>' +
    fig(img, 'guide-native.png', 'Geräte & Forensik') + '</div>';

  b += '<div class="sec"><h2>10 · Forensik-Hosts steuern (bis 10)</h2>' +
    '<p>Jeder Host = ein Boot-Stick mit <code>control-server.py</code>. Adresse + Token hinterlegen oder per ' +
    '<b>„🔌 Auto-Discovery"</b> finden lassen. Pro Host: Hosts finden, Wireshark, Image, Win-/Linux-Triage, Manifest; ' +
    'Dateien herunterladen; <b>„⤵ Befunde in Fall"</b> speist ingest.json ins aktive Playbook.</p>' +
    fig(img, 'guide-hosts.png', 'Forensik-Hosts (Beispiel-Host)') + '</div>';

  b += '<div class="brk"></div>';
  b += '<div class="sec"><h2>11 · Cloud &amp; Veröffentlichen</h2>' +
    '<p>Owner/Repo/Branch sind <b>vorbelegt</b> (änderbar). Ergänze einen <b>fein granularen PAT</b> ' +
    '(<code>Contents: write</code>, nur fürs Daten-Repo) – er bleibt lokal im Browser. „Alle Fälle veröffentlichen" ' +
    'schreibt Snapshots nach <code>cloud/incidents/</code>.</p>' + fig(img, 'guide-cloud.png', 'Cloud-Konfiguration') + '</div>';

  b += '<div class="sec"><h2>12 · Live-Dashboard</h2>' +
    '<p>In der App: aktive Incidents + verbundene Hosts; Datei-Download nach <b>PIN 1374</b>.</p>' +
    fig(img, 'guide-dashboard.png', 'Live-Dashboard (App)') +
    '<p>Auf Pages (eigenständig, <code>dashboard.html</code>): liest <code>cloud/incidents/index.json</code>, zeigt alle ' +
    'Vorfälle; Dateien/Reports nach <b>PIN 1374</b>.</p>' + fig(img, 'guide-pages-dashboard.png', 'Pages-Dashboard (Beispieldaten)') + '</div>';

  b += '<div class="brk"></div>';
  b += '<div class="sec"><h2>13 · Boot-Stick &amp; Windows-Sammler</h2>' +
    '<h3>Boot-Stick</h3><ul>' +
    '<li>ISO bauen: <code>build/build-live-iso.sh</code> (Debian live-build, gparted + Forensik-Tools + App + Skripte).</li>' +
    '<li>Auto-Kopplung: <code>ir-net.service</code> (DHCP oder eigene IP <code>10.13.37.1/24</code> + Mini-DHCP).</li>' +
    '<li>Fernsteuerung: <code>ir-control.service</code> startet automatisch und zeigt URL + Token.</li>' +
    '<li>Ohne Tastatur am Ziel: alles per Handy-Browser über die Stick-IP (siehe <code>mobile/hid-keyboard.md</code>).</li></ul>' +
    '<h3>Windows-Sammler</h3><ul>' +
    '<li><code>windows/IR-Collect.cmd</code> doppelklicken (für volle Logs als Admin). Read-only Triage → SHA256 → Upload an den Host.</li>' +
    '<li>Ziel-Host in <code>ir-target.txt</code> (base + token) oder beim Start eingeben.</li>' +
    '<li>Erscheint im Dashboard; <code>ingest.json</code> per „Befunde in Fall" direkt ins Playbook.</li></ul>' +
    '<div class="box warn"><b>Ehrlich:</b> Booten vom Stick ist Firmware (BIOS-Boot-Menü), nicht aus der App erzwingbar. ' +
    'Ein Windows-Programm „kalt" ohne Klick zu starten geht auf Stock-Windows nicht (USB-Autorun deaktiviert). ' +
    'Ab Verbindung übernimmt die App alles automatisch.</div></div>';

  b += '<div class="sec"><h2>14 · Sicherheit &amp; Scope</h2><ul>' +
    '<li>Defensives Werkzeug für <b>autorisierte</b> Incident Response; Toolkit-Skripte sind read-only.</li>' +
    '<li>Token schützt Host-Zugriff; nur im vertrauenswürdigen Analyse-Netz betreiben.</li>' +
    '<li>Für vertrauliche Fälle ein <b>privates</b> Daten-Repo nutzen.</li>' +
    '<li>Rechtliche Schritte/Meldungen mit Recht/DSB/Behörden abstimmen.</li></ul>' +
    '<div class="foot">IR-Pilot · automatisierte Tests grün: 1635 Logik · 33 UI · 7 Dashboard · Control-Server. ' +
    'Diese Anleitung wurde automatisch aus der laufenden App erzeugt (Screenshots = echte Ansichten).</div></div>';

  return s + pad(b);
}

/* ------------------------------------------------------------ Testplan */
function row(esc, step, expect) { return '<tr><td>' + step + '</td><td>' + expect + '</td><td class="ck">☐</td></tr>'; }
function tbl(rows) { return '<table><tr><th style="width:48%">Schritt</th><th>Erwartetes Ergebnis</th><th class="ck">OK</th></tr>' + rows + '</table>'; }

function testplan(esc, img) {
  var s = '<!doctype html><meta charset="utf-8">' + CSS + head(esc, 'Testplan (manuell)', 'Was du durchtesten solltest · inkl. „wo hakt es am wahrscheinlichsten" · Stand 2026-06-21');
  var b = '';

  b += '<div class="box ok"><b>Automatisierte Tests sind bereits grün</b> (von uns ausgeführt): ' +
    '<b>1635</b> Logik (<code>tests/run.js</code>), <b>33</b> UI-Smoke (<code>tests/ui.js</code>), ' +
    '<b>7</b> Pages-Dashboard (<code>tests/dashboard.js</code>) und der <b>Control-Server</b>-Smoke ' +
    '(<code>tests/control-server.sh</code>: Token, Whitelist, Path-Traversal, CORS, Intake-Roundtrip). ' +
    'Dieser Plan deckt das ab, was nur am echten Gerät/Netz prüfbar ist.</div>';

  b += '<h2>A · App-Grundfunktionen</h2>' + tbl(
    row(esc, 'App öffnen (APK/PWA/Stick)', 'Start-Ansicht mit 9 Szenarien + Buttons lädt, offline.') +
    row(esc, 'Assistent: Umgebung → Beobachtung → Fragebogen → Vermutung', 'Top-Vermutung plausibel; „Playbook erzeugen" öffnet Fall.') +
    row(esc, 'Playbook abarbeiten (Checks, Choice, Input)', 'Fortschritt steigt; Gate schaltet Schritte frei.') +
    row(esc, 'Beweis erfassen + Übergabe protokollieren', 'Beweis in Liste, Chain-of-Custody-Eintrag erscheint.') +
    row(esc, 'IOC hinzufügen / Quick-Paste', 'IOC erscheint in Liste und im Bericht.') +
    row(esc, 'Bericht: Markdown/CSV/JSON exportieren', 'Dateien werden heruntergeladen; Inhalt vollständig.'));

  b += '<h2 class="sec">B · Forensik-Hosts (Boot-Stick)</h2>' + tbl(
    row(esc, 'Host manuell hinzufügen (Adresse + Token)', 'Host-Karte erscheint, „Verbinden" zeigt Status/Dateien.') +
    row(esc, '🔌 Auto-Discovery (USB/Netz)', 'Erreichbarer Stick wird gefunden &amp; übernommen (Token nachtragen).') +
    row(esc, 'One-Click: Hosts finden / Wireshark / Image / Triage / Manifest', 'Aktion läuft auf dem Stick; Ausgabe + neue Dateien erscheinen.') +
    row(esc, 'Datei herunterladen', 'Datei lädt vom Host (Download).') +
    row(esc, '⤵ Befunde in Fall', 'ingest.json wird gemerged; IOCs/Beweise im Fall.'));

  b += '<h2 class="sec">C · Befunde im Playbook</h2>' + tbl(
    row(esc, 'Nach Import in Forensik-Phase schauen', 'Panel „📥 Befunde aus Daten" zeigt IOCs/Beweise.') +
    row(esc, 'Entscheidung Confirm/Refute setzen', 'Status ändert sich; Folgeschritte passen sich an (kein Auto-Confirm).'));

  b += '<div class="brk"></div>';
  b += '<h2 class="sec">D · Cloud &amp; Dashboard</h2>' + tbl(
    row(esc, 'Cloud: PAT eintragen, „Alle Fälle veröffentlichen"', 'Meldung „N veröffentlicht"; kein Fehler.') +
    row(esc, 'App-Dashboard öffnen', 'Aktive Incidents + Hosts sichtbar.') +
    row(esc, 'Datei-Download per PIN 1374', 'Falsche PIN abgewiesen; 1374 schaltet Downloads frei.') +
    row(esc, 'Pages-Dashboard (dashboard.html) öffnen', 'Veröffentlichte Vorfälle erscheinen (ggf. 1–2 min Verzögerung).'));

  b += '<h2 class="sec">E · Boot-Stick &amp; Netz</h2>' + tbl(
    row(esc, 'Stick booten (Ziel vom USB starten)', 'Forensik-Linux startet ohne Auto-Mount.') +
    row(esc, 'Kopplung Handy↔Stick (USB-Eth/WLAN)', 'Ohne DHCP: Stick vergibt 10.13.37.1 + Handy bekommt IP automatisch.') +
    row(esc, 'control-server: URL + Token am Stick ablesen', 'Im Handy-Browser erreichbar; Touch-Steuerung reagiert.'));

  b += '<h2 class="sec">F · Windows-Sammler</h2>' + tbl(
    row(esc, 'IR-Collect.cmd doppelklicken (ggf. als Admin)', 'Sammlung läuft read-only, ZIP + SHA256 entstehen.') +
    row(esc, 'Upload an Host', 'Datei erscheint im Host (/api/list) und im Dashboard.'));

  b += '<h2 class="sec">G · Pages live</h2>' + tbl(
    row(esc, 'App-URL und dashboard.html öffnen', 'Beide liefern 200 und laden (nach Pages-Source = gh-pages).'));

  b += '<div class="brk"></div>';
  b += '<h2>Wo es am wahrscheinlichsten hakt</h2>' +
    '<table><tr><th style="width:24%">Stelle</th><th>Symptom</th><th>Lösung</th></tr>' +
    hk('Pages-Source', '404 auf der ganzen Seite', 'Settings → Pages → Source = „Deploy from a branch" → <code>gh-pages</code> / (root). Erstbuild dauert bis ~15 min.', 'k') +
    hk('Mixed-Content', 'https-Pages-App erreicht lokale http-Hosts nicht (Discovery/Steuerung tot)', 'APK nutzen <i>oder</i> App vom Stick (http) laden. Reine Pages-PWA kann lokale http-Hosts nicht ansprechen.', 'k') +
    hk('PAT-Scope', 'Veröffentlichen schlägt fehl (403/401)', 'Fein granularer PAT mit <code>Contents: write</code> genau für das Daten-Repo; Owner/Repo/Branch prüfen.', 'h') +
    hk('raw-Caching', 'Dashboard zeigt neuen Vorfall verzögert', 'raw.githubusercontent cached ~1–5 min; kurz warten / neu laden.', 'm') +
    hk('Host-Token', 'Discovery findet Host, Aktionen geben 403', 'Token vom Stick-Start nachtragen (Token schützt alle Aktionen).', 'm') +
    hk('Netz/DHCP', 'Handy bekommt keine IP', 'dnsmasq vorhanden? Sonst Link-Local/APIPA am Handy oder IP manuell (10.13.37.50/24, GW .1).', 'h') +
    hk('Interface-Name', 'Capture/Discover findet kein eth1', 'Realen Namen prüfen (<code>ip a</code>, oft <code>enx…</code>) und im Feld eintragen.', 'm') +
    hk('Boot vom Stick', 'Stick bootet nicht „aus der App"', 'Das ist Firmware: im BIOS/Boot-Menü (F12/F8) USB wählen. Nicht aus App erzwingbar.', 'h') +
    hk('Windows-Autorun', 'IR-Collect startet nicht automatisch beim Einstecken', 'Stock-Windows deaktiviert USB-Autorun: <code>IR-Collect.cmd</code> doppelklicken (Admin für volle Logs).', 'm') +
    hk('APK-Sideload', 'Installation blockiert', '„Unbekannte Quellen/diese App zulassen" für den Dateimanager aktivieren.', 'm') +
    '</table>';

  b += '<div class="foot">Tipp zur Reihenfolge: erst <b>A–C</b> (App lokal), dann <b>E/F</b> (Stick/Windows), dann <b>B</b> ' +
    '(Host-Steuerung über APK), dann <b>D/G</b> (Cloud/Pages). So isolierst du Mixed-Content- und PAT-Probleme sauber.</div>';

  return s + pad(b);
}
function hk(where, sym, fix, sev) {
  return '<tr><td><b>' + where + '</b> <span class="sev ' + sev + '">' + (sev === 'k' ? '●' : sev === 'h' ? '◐' : '○') + '</span></td><td>' + sym + '</td><td>' + fix + '</td></tr>';
}

module.exports = { anleitung: anleitung, testplan: testplan };
