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

echo "Control-Server: $([ $FAIL = 0 ] && echo 'alle ok' || echo "$FAIL fehlgeschlagen")"
exit $FAIL
