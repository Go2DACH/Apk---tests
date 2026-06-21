#!/usr/bin/env bash
# Smoke-Test fuer desktop/control-server.py: Start, Endpunkte, Token-Schutz,
# Whitelist, Path-Traversal-Abwehr. Keine externen Abhaengigkeiten (curl, python3).
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT=8137; TOK=smoketok; FAIL=0
PASS(){ echo "  ok: $1"; }
BAD(){ echo "  FAIL: $1"; FAIL=$((FAIL+1)); }

python3 -c "import ast,sys; ast.parse(open('$ROOT/desktop/control-server.py').read())" \
  && PASS "Syntax" || { BAD "Syntax"; exit 1; }

# Whitelist enthaelt die neuen One-Click-Aktionen (Import statt Ausfuehrung -> kein sudo)
python3 - "$ROOT/desktop/control-server.py" <<'PY' && PASS "Aktions-Whitelist (discover/wireshark)" || BAD "Aktions-Whitelist"
import importlib.util, sys
spec = importlib.util.spec_from_file_location('cs', sys.argv[1])
m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
need = {'mount_ro','image_disk','collect_windows','collect_linux','manifest','capture','discover','wireshark'}
sys.exit(0 if need <= set(m.ACTIONS) else 1)
PY

IR_TOKEN=$TOK IR_PORT=$PORT IR_EVIDENCE=/tmp/ir-smoke-evid \
  python3 "$ROOT/desktop/control-server.py" >/tmp/ir-cs-smoke.log 2>&1 &
SRV=$!
trap 'kill $SRV 2>/dev/null' EXIT
for i in 1 2 3 4 5 6 7 8 9 10; do
  curl -s -o /dev/null "http://127.0.0.1:$PORT/" && break; sleep 0.3
done

CODE(){ curl -s -o /dev/null -w '%{http_code}' "$@"; }
[ "$(curl -s "http://127.0.0.1:$PORT/" | grep -c 'IR-Pilot')" -ge 1 ] && PASS "Steuerseite" || BAD "Steuerseite"
[ "$(CODE "http://127.0.0.1:$PORT/api/devices")" = 403 ] && PASS "devices ohne Token -> 403" || BAD "devices ohne Token"
[ "$(CODE "http://127.0.0.1:$PORT/api/devices?t=$TOK")" = 200 ] && PASS "devices mit Token -> 200" || BAD "devices mit Token"
OUT=$(curl -s -X POST "http://127.0.0.1:$PORT/api/run" -H 'Content-Type: application/json' -d "{\"action\":\"nope\",\"t\":\"$TOK\"}")
[ "$OUT" = "unbekannte Aktion" ] && PASS "unbekannte Aktion abgelehnt" || BAD "unbekannte Aktion ($OUT)"
[ "$(CODE -X POST "http://127.0.0.1:$PORT/api/run" -H 'Content-Type: application/json' -d '{"action":"manifest","t":"wrong"}')" = 403 ] \
  && PASS "run falscher Token -> 403" || BAD "run falscher Token"
[ "$(CODE "http://127.0.0.1:$PORT/app/index.html")" = 200 ] && PASS "App statisch -> 200" || BAD "App statisch"
[ "$(CODE "http://127.0.0.1:$PORT/app/../../etc/passwd")" = 404 ] && PASS "Path-Traversal -> 404" || BAD "Path-Traversal"

# Host-Identitaet fuers App-Pairing/Dashboard
[ "$(curl -s "http://127.0.0.1:$PORT/api/info?t=$TOK" | grep -c 'ir-pilot-control')" -ge 1 ] && PASS "api/info liefert Identitaet" || BAD "api/info"
[ "$(CODE "http://127.0.0.1:$PORT/api/list")" = 403 ] && PASS "api/list ohne Token -> 403" || BAD "api/list ohne Token"

# CORS: Preflight + Header (App von anderem Origin darf token-geschuetzt zugreifen)
[ "$(CODE -X OPTIONS "http://127.0.0.1:$PORT/api/info")" = 204 ] && PASS "CORS-Preflight -> 204" || BAD "CORS-Preflight"
[ "$(curl -s -D - -o /dev/null "http://127.0.0.1:$PORT/api/info?t=$TOK" | grep -ci 'access-control-allow-origin')" -ge 1 ] && PASS "CORS-Header gesetzt" || BAD "CORS-Header"

# Intake-Roundtrip: Datei hochladen (Windows-Collector) -> in api/list -> Download
echo "ir-test-payload-42" | curl -s -X POST --data-binary @- "http://127.0.0.1:$PORT/api/intake?t=$TOK&name=win-test.zip" >/dev/null
[ "$(curl -s "http://127.0.0.1:$PORT/api/list?t=$TOK" | grep -c 'win-test.zip')" -ge 1 ] && PASS "Intake erscheint in api/list" || BAD "Intake/list"
[ "$(curl -s "http://127.0.0.1:$PORT/download?t=$TOK&path=intake/win-test.zip" | grep -c 'ir-test-payload-42')" -ge 1 ] && PASS "Intake-Datei downloadbar" || BAD "Intake-Download"
[ "$(CODE -X POST "http://127.0.0.1:$PORT/api/intake?t=wrong&name=x" )" = 403 ] && PASS "Intake ohne Token -> 403" || BAD "Intake-Token"

rm -rf /tmp/ir-smoke-evid
echo "Control-Server: $([ $FAIL = 0 ] && echo 'alle ok' || echo "$FAIL fehlgeschlagen")"
exit $FAIL
