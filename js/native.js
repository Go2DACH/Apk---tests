/* IR-Pilot – native Fähigkeits-Schicht. Erkennt, ob die App in der Android-APK
 * (WebView mit Brücke `AndroidIR`) oder im normalen Browser läuft, und stellt
 * privilegierte Aktionen bereit (Netz-Mitschnitt, Scan, Boot-Stick flashen,
 * Datei auf USB sichern). Im Browser gibt es saubere Fallbacks/Anleitungen.
 */
(function (root) {
  'use strict';
  var IR = root.IR || (root.IR = {});
  var B = root.AndroidIR || null;   // wird von der APK injiziert

  function has(fn) { return !!(B && typeof B[fn] === 'function'); }

  IR.native = {
    bridge: B,
    isNative: function () { return !!B; },
    platform: function () { return B ? (has('platform') ? B.platform() : 'android') : 'web'; },

    toast: function (m) { if (has('toast')) B.toast(m); },

    // Aktuelle Seite als PDF: APK -> Android-Druck/PDF; sonst window.print().
    print: function () { if (has('printPage')) { B.printPage(); return true; } if (root.print) { root.print(); return true; } return false; },

    // Datei sichern: nativ -> Downloads/USB; sonst false (App nutzt Blob-Download)
    save: function (name, text) { if (has('saveFile')) { B.saveFile(name, text); return true; } return false; },
    share: function (name, text) { if (has('share')) { B.share(name, text); return true; } return false; },

    // Online-Daten/ISO nachladen (Auto-Update von Pages)
    reloadData: function () { if (has('reloadData')) { B.reloadData(); return true; } if (root.location) { root.location.reload(); return true; } return false; },

    // Werkzeug-Kit (ir-pilot-kit.zip) bereitstellen: APK -> Downloads/USB,
    // Browser -> normaler Datei-Download. true = ausgeloest.
    exportKit: function (name) {
      name = name || 'ir-pilot-kit.zip';
      if (has('exportAsset')) { B.exportAsset(name); return true; }
      try {
        var doc = root.document; if (!doc) return false;
        var a = doc.createElement('a'); a.href = name; a.download = name;
        doc.body.appendChild(a); a.click(); doc.body.removeChild(a); return true;
      } catch (e) { return false; }
    },

    // Katalog der privilegierten Fähigkeiten (für die "Geräte"-Ansicht)
    capabilities: function () {
      return [
        { id: 'capture', name: 'Netzwerk-Mitschnitt (WiFi/Ethernet)', icon: '📡',
          native: has('startCapture'),
          desc: 'pcap-Mitschnitt für C2-/OT-Analyse.',
          webHint: 'Ohne Root am Handy: nur EIGENER Traffic per VpnService (PCAPdroid) – gut für App-/C2-Beacons, NICHT für fremde Hosts. Echter passiver Mitschnitt am Netz (Span-Port/TAP, fremde Hosts) läuft auf dem Boot-Stick (tcpdump, dort root). Alternativ Termux:',
          script: 'OT-Netzwerk-Capture', mobile: 'mobile/phone-capture.sh' },
        { id: 'remote', name: 'Boot-Stick fernsteuern (ohne Tastatur)', icon: '🎛️',
          native: false,
          desc: 'Imaging/Triage/Capture vom Handy-Browser steuern – kein Root am Handy, keine Tastatur am Ziel.',
          webHint: 'Forensik-Stick im Zielrechner booten, Handy per USB-Ethernet/WLAN verbinden. Der Dienst ir-control.service zeigt URL+Token; im Handy-Browser öffnen. Siehe mobile/hid-keyboard.md. Startet auch über autorun.sh:',
          script: null, mobile: 'desktop/control-server.py' },
        { id: 'scan', name: 'Netz-Scan / Host-Discovery', icon: '🛰️',
          native: has('runScan'),
          desc: 'Aktive Hosts/Ports im Subnetz finden.',
          webHint: 'Browser kann keine Ports scannen. In der APK über gebündeltes nmap. Alternativ Termux:',
          script: null, mobile: 'mobile/phone-recon.sh' },
        { id: 'flash', name: 'Boot-Stick schreiben (Forensik-Linux)', icon: '💽',
          native: has('flashImage'),
          desc: 'Fertige Forensik-ISO auf den USB-Stick flashen (USB-Host, ohne Root).',
          webHint: 'Browser kann keine Roh-USB schreiben. In der APK EtchDroid-artig; ISO bauen mit build/build-live-iso.sh (Linux/CI). Am PC:',
          script: null, mobile: 'build/build-live-iso.sh', cmd: 'sudo dd if=forensik.iso of=/dev/sdX bs=4M status=progress conv=fsync' },
        { id: 'usbsave', name: 'Beweise/Bericht auf USB sichern', icon: '🔐',
          native: has('saveFile'),
          desc: 'Triage-Ergebnis/Report direkt auf USB/SD ablegen (mit Hash).',
          webHint: 'Im Browser: per „Herunterladen" speichern. Triage-Skripte am Zielsystem ausführen, Ergebnis (ingest.json) importieren.',
          script: 'Beweis-Manifest', mobile: null }
      ];
    },

    run: function (id) {
      if (!B) return false;
      if (id === 'capture' && has('startCapture')) { B.startCapture(); return true; }
      if (id === 'scan' && has('runScan')) { B.runScan(); return true; }
      if (id === 'flash' && has('flashImage')) { B.flashImage(); return true; }
      return false;
    }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = IR.native;
})(typeof window !== 'undefined' ? window : globalThis);
