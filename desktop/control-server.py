#!/usr/bin/env python3
"""IR-Pilot Control-Server – Boot-Stick headless vom Smartphone steuern.

Laeuft auf dem gebooteten Forensik-Linux (das hat in seinem eigenen Live-OS
root – dein Medium, nicht das Ziel). Du verbindest das Smartphone (USB-Ethernet/
WLAN/Link-Local) und steuerst die Sicherung im Handy-Browser. KEIN Root am
Smartphone, KEINE Tastatur am Zielrechner noetig.

Start:  sudo IR_EVIDENCE=/evidence python3 desktop/control-server.py
        -> URL + Token werden auf der Konsole angezeigt.
Stdlib only.
"""
import http.server, socketserver, subprocess, os, json, secrets, html, urllib.parse, threading

ROOT = os.path.dirname(os.path.abspath(__file__))
APPDIR = os.environ.get('IR_APP', os.path.dirname(ROOT))           # /opt/ir-pilot
EVID = os.environ.get('IR_EVIDENCE', os.path.join(os.getcwd(), 'evidence'))
PORT = int(os.environ.get('IR_PORT', '8080'))
TOKEN = os.environ.get('IR_TOKEN') or secrets.token_hex(4)
os.makedirs(EVID, exist_ok=True)

# Nur diese Aktionen sind erlaubt (Whitelist). args kommen aus dem UI.
def A_mount(a):   return ['sudo', os.path.join(ROOT, 'mount-ro.sh'), a.get('dev', ''), '/mnt/evidence']
def A_image(a):   return ['sudo', os.path.join(ROOT, 'image-disk.sh'), a.get('dev', ''), EVID, a.get('fmt', 'ewf')]
def A_win(a):     return ['sudo', os.path.join(ROOT, 'collect-windows-offline.sh'), a.get('mount', '/mnt/evidence'), EVID]
def A_lin(a):     return ['sudo', os.path.join(ROOT, 'collect-linux-offline.sh'), a.get('mount', '/mnt/evidence'), EVID]
def A_manifest(a):return ['bash', os.path.join(APPDIR, 'tools', 'evidence-manifest.sh'), 'create', EVID]
def A_capture(a): return ['sudo', os.path.join(APPDIR, 'tools', 'ot-capture.sh'), a.get('iface', 'eth1'), EVID, a.get('min', '10')]
def A_discover(a):return ['sudo', os.path.join(ROOT, 'discover.sh'), a.get('iface', ''), EVID]
def A_wireshark(a):return ['sudo', os.path.join(ROOT, 'wireshark-capture.sh'), a.get('iface', 'eth1'), EVID, a.get('min', '5'), a.get('filter', '')]
ACTIONS = {'mount_ro': A_mount, 'image_disk': A_image, 'collect_windows': A_win,
           'collect_linux': A_lin, 'manifest': A_manifest, 'capture': A_capture,
           'discover': A_discover, 'wireshark': A_wireshark}

NAME = os.environ.get('IR_HOST_NAME', '')   # frei vergebbarer Host-Name fuers Dashboard


def list_evidence():
    """Alle gesammelten Dateien unter EVIDENCE -> Liste fuers Smartphone/Dashboard."""
    items = []
    for base, _dirs, files in os.walk(EVID):
        for f in files:
            full = os.path.join(base, f)
            try:
                st = os.stat(full)
            except OSError:
                continue
            items.append({'path': os.path.relpath(full, EVID), 'size': st.st_size,
                          'mtime': int(st.st_mtime)})
    items.sort(key=lambda x: x['mtime'], reverse=True)
    return items


def host_info():
    import socket
    ips = []
    try:
        ips = sorted({i[4][0] for i in socket.getaddrinfo(socket.gethostname(), None)
                      if ':' not in i[4][0]})
    except Exception:
        pass
    ev = list_evidence()
    return {'app': 'ir-pilot-control', 'name': NAME or socket.gethostname(),
            'host': socket.gethostname(), 'ips': ips, 'port': PORT,
            'evidenceCount': len(ev), 'evidenceBytes': sum(x['size'] for x in ev),
            'actions': sorted(ACTIONS.keys())}

CONTROL_HTML = """<!doctype html><html lang=de><meta charset=utf-8>
<meta name=viewport content="width=device-width,initial-scale=1">
<title>IR-Pilot Stick-Steuerung</title><style>
body{font:15px system-ui;margin:0;background:#0b1f33;color:#e8f0f8}
header{padding:12px 14px;background:#0e2740;border-bottom:1px solid #1d496f}
.wrap{max-width:760px;margin:0 auto;padding:12px;display:flex;flex-direction:column;gap:12px}
.card{background:#12304f;border:1px solid #1d496f;border-radius:12px;padding:14px}
button{background:#3aa0ff;color:#04243f;border:0;border-radius:8px;padding:10px 14px;font-weight:700}
select,input{background:#0a233b;color:#e8f0f8;border:1px solid #1d496f;border-radius:8px;padding:9px}
pre{background:#06182a;border:1px solid #1d496f;border-radius:8px;padding:10px;white-space:pre-wrap;max-height:40vh;overflow:auto}
a{color:#3aa0ff}.row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:6px 0}
small{color:#9bb4cc}</style>
<header><strong>🛡️ IR-Pilot – Boot-Stick-Steuerung</strong></header>
<div class=wrap>
<div class=card><b>Datentraeger</b> <button onclick=devs()>Aktualisieren</button>
<div id=dev></div>
<div class=row><label>Geraet</label><input id=g placeholder=/dev/sdb></div>
<div class=row>
 <button onclick="run('mount_ro',{dev:g.value})">RO mounten</button>
 <button onclick="run('image_disk',{dev:g.value})">Image sichern</button>
 <button onclick="run('collect_windows',{})">Windows offline</button>
 <button onclick="run('collect_linux',{})">Linux offline</button>
 <button onclick="run('manifest',{})">Manifest</button>
</div></div>
<div class=card><b>Netzwerk: Discover &amp; Mitschnitt (Wireshark/tshark)</b>
<div class=row><label>Interface</label><input id=if value=eth1 style=width:90px>
 <label>Min</label><input id=mn value=5 style=width:60px>
 <button onclick="run('discover',{iface:if.value})">Hosts finden</button>
 <button onclick="run('wireshark',{iface:if.value,min:mn.value})">Wireshark-Capture</button>
 <button onclick="run('capture',{iface:if.value,min:mn.value})">OT-Capture</button></div></div>
<div class=card><b>Gesammelte Dateien</b> <button onclick=files()>Aktualisieren</button><div id=fl></div></div>
<div class=card><b>Ausgabe</b><pre id=out>bereit…</pre>
<small>Beweise unter EVIDENCE. <a id=app target=_blank>» Volle IR-Pilot-App oeffnen</a></small></div>
</div><script>
var T=new URLSearchParams(location.search).get('t')||'';
document.getElementById('app').href='/app/index.html';
function out(x){document.getElementById('out').textContent=x;}
function devs(){fetch('/api/devices?t='+T).then(r=>r.json()).then(j=>{
 var d=document.getElementById('dev');d.innerHTML='';
 (j.blockdevices||[]).forEach(b=>{d.innerHTML+='<div>· '+b.name+' '+(b.size||'')+' '+(b.fstype||'')+' '+(b.label||'')+' '+(b.mountpoint||'')+'</div>';});
}).catch(e=>out('Fehler: '+e));}
function run(a,args){out('laeuft… '+a);args.t=T;
 fetch('/api/run',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:a,args:args,t:T})})
 .then(r=>r.text()).then(function(x){out(x);files();}).catch(e=>out('Fehler: '+e));}
function files(){fetch('/api/list?t='+T).then(r=>r.json()).then(j=>{
 var f=document.getElementById('fl');f.innerHTML='';
 (j.files||[]).forEach(x=>{f.innerHTML+='<div>· <a href="/download?t='+T+'&path='+encodeURIComponent(x.path)+'">'+x.path+'</a> '+(x.size||0)+' B</div>';});
 if(!(j.files||[]).length)f.innerHTML='<small>noch keine Dateien</small>';
}).catch(e=>{});}
devs();files();
</script></html>"""


class H(http.server.BaseHTTPRequestHandler):
    def _send(self, code, body, ctype='text/plain; charset=utf-8'):
        b = body.encode() if isinstance(body, str) else body
        self.send_response(code); self.send_header('Content-Type', ctype)
        # CORS: die IR-Pilot-App (anderer Host/Pages) darf token-geschuetzt zugreifen.
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Content-Length', str(len(b))); self.end_headers(); self.wfile.write(b)

    def _auth(self, q):
        return q.get('t', [''])[0] == TOKEN

    def log_message(self, *a):  # leiser
        pass

    def do_OPTIONS(self):       # CORS-Preflight
        self._send(204, '')

    def do_GET(self):
        u = urllib.parse.urlparse(self.path); q = urllib.parse.parse_qs(u.query)
        if u.path in ('/', '/index.html', '/control'):
            return self._send(200, CONTROL_HTML, 'text/html; charset=utf-8')
        if u.path == '/api/info':
            # Identitaet/Status fuers App-Pairing; ohne Token nur minimal.
            if not self._auth(q):
                return self._send(200, json.dumps({'app': 'ir-pilot-control', 'auth': False}), 'application/json')
            return self._send(200, json.dumps(host_info()), 'application/json')
        if u.path == '/api/devices':
            if not self._auth(q): return self._send(403, 'token')
            try:
                o = subprocess.check_output(['lsblk', '-J', '-o', 'NAME,SIZE,TYPE,FSTYPE,LABEL,MOUNTPOINT'], timeout=10)
                return self._send(200, o, 'application/json')
            except Exception as e:
                return self._send(200, json.dumps({'blockdevices': [], 'error': str(e)}), 'application/json')
        if u.path == '/api/list':
            if not self._auth(q): return self._send(403, 'token')
            return self._send(200, json.dumps({'files': list_evidence()}), 'application/json')
        if u.path.startswith('/app/'):
            return self._serve_static(u.path[len('/app/'):])
        if u.path == '/download':
            if not self._auth(q): return self._send(403, 'token')
            return self._download(q.get('path', [''])[0])
        return self._send(404, 'not found')

    def do_POST(self):
        u = urllib.parse.urlparse(self.path); q = urllib.parse.parse_qs(u.query)
        n = int(self.headers.get('Content-Length', '0'))
        # Forensik-Daten annehmen (z.B. Windows-Collector -> Smartphone-Host)
        if u.path == '/api/intake':
            if not self._auth(q): return self._send(403, 'token')
            name = os.path.basename(q.get('name', ['intake.bin'])[0]) or 'intake.bin'
            dest_dir = os.path.join(EVID, 'intake')
            os.makedirs(dest_dir, exist_ok=True)
            full = os.path.join(dest_dir, name)
            try:
                with open(full, 'wb') as f:
                    remaining = n
                    while remaining > 0:
                        chunk = self.rfile.read(min(65536, remaining))
                        if not chunk: break
                        f.write(chunk); remaining -= len(chunk)
                return self._send(200, json.dumps({'ok': True, 'saved': 'intake/' + name,
                                  'bytes': os.path.getsize(full)}), 'application/json')
            except Exception as e:
                return self._send(500, str(e))
        if u.path != '/api/run':
            return self._send(404, 'not found')
        try:
            data = json.loads(self.rfile.read(n) or b'{}')
        except Exception:
            return self._send(400, 'bad json')
        if data.get('t') != TOKEN:
            return self._send(403, 'token')
        act = data.get('action'); args = data.get('args', {})
        if act not in ACTIONS:
            return self._send(400, 'unbekannte Aktion')
        cmd = ACTIONS[act](args)
        try:
            p = subprocess.run(cmd, capture_output=True, text=True, timeout=3600)
            out = (p.stdout or '') + (p.stderr or '')
            return self._send(200, '$ ' + ' '.join(cmd) + '\n\n' + out[-8000:])
        except subprocess.TimeoutExpired:
            return self._send(200, 'Timeout – laeuft ggf. im Hintergrund weiter.')
        except Exception as e:
            return self._send(500, str(e))

    def _serve_static(self, rel):
        rel = rel.split('?')[0].lstrip('/')
        full = os.path.normpath(os.path.join(APPDIR, rel))
        if not full.startswith(os.path.abspath(APPDIR)) or not os.path.isfile(full):
            return self._send(404, 'not found')
        ctype = {'html': 'text/html', 'js': 'text/javascript', 'css': 'text/css',
                 'json': 'application/json', 'svg': 'image/svg+xml'}.get(full.rsplit('.', 1)[-1], 'application/octet-stream')
        with open(full, 'rb') as f:
            return self._send(200, f.read(), ctype + '; charset=utf-8')

    def _download(self, rel):
        full = os.path.normpath(os.path.join(EVID, rel.lstrip('/')))
        if not full.startswith(os.path.abspath(EVID)) or not os.path.isfile(full):
            return self._send(404, 'not found')
        with open(full, 'rb') as f:
            self.send_response(200)
            self.send_header('Content-Type', 'application/octet-stream')
            self.send_header('Content-Disposition', 'attachment; filename="%s"' % os.path.basename(full))
            self.end_headers(); self.wfile.write(f.read())


class Server(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True


def main():
    import socket
    srv = Server(('0.0.0.0', PORT), H)
    ips = []
    try:
        ips = list({i[4][0] for i in socket.getaddrinfo(socket.gethostname(), None)})
    except Exception:
        pass
    print('=' * 60)
    print(' IR-Pilot Control-Server laeuft. Am Smartphone oeffnen:')
    for ip in (ips or ['<stick-ip>']):
        print('   http://%s:%d/?t=%s' % (ip, PORT, TOKEN))
    print(' Token: %s   Beweise: %s' % (TOKEN, EVID))
    print(' (Nur im vertrauenswuerdigen Analyse-Link betreiben.)')
    print('=' * 60)
    srv.serve_forever()


if __name__ == '__main__':
    main()
