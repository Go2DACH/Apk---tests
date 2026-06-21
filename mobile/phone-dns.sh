#!/usr/bin/env bash
# phone-dns.sh – DNS/Reverse/Cert-Lookup ueber DoH (ohne dig) -> haengt IOCs an ingest.json
# Nutzung:  ./phone-dns.sh <domain|ip> [out.json]
set -u
TARGET="${1:?domain oder ip angeben}"; OUT="${2:-ingest.json}"
TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
DOH="https://cloudflare-dns.com/dns-query"
IOCS=""
add_ioc(){ local t="$1" v="$2" n="$3"; [ -n "$IOCS" ] && IOCS="$IOCS,"; IOCS="$IOCS{\"type\":\"$t\",\"value\":\"$v\",\"note\":\"${n//\"/}\"}"; }

is_ip(){ echo "$1" | grep -Eq '^([0-9]{1,3}\.){3}[0-9]{1,3}$'; }

if is_ip "$TARGET"; then
  add_ioc ip "$TARGET" "lookup"
  # Reverse via DoH PTR
  rev="$(echo "$TARGET" | awk -F. '{print $4"."$3"."$2"."$1".in-addr.arpa"}')"
  ptr="$(curl -s -H 'accept: application/dns-json' "$DOH?name=$rev&type=PTR" | tr ',' '\n' | grep -oE '"data":"[^"]+"' | head -1 | cut -d'"' -f4)"
  [ -n "${ptr:-}" ] && add_ioc domain "${ptr%.}" "PTR von $TARGET"
else
  add_ioc domain "$TARGET" "lookup"
  for rt in A AAAA MX TXT NS; do
    curl -s -H 'accept: application/dns-json' "$DOH?name=$TARGET&type=$rt" |
      tr ',' '\n' | grep -oE '"data":"[^"]+"' | cut -d'"' -f4 | while read -r d; do
        echo "  [$rt] $d"
      done
  done
  ips="$(curl -s -H 'accept: application/dns-json' "$DOH?name=$TARGET&type=A" | tr ',' '\n' | grep -oE '"data":"([0-9]{1,3}\.){3}[0-9]{1,3}"' | cut -d'"' -f4)"
  for ip in $ips; do add_ioc ip "$ip" "A von $TARGET"; done
fi

# TLS-Zertifikat (falls erreichbar)
if command -v openssl >/dev/null 2>&1 && ! is_ip "$TARGET"; then
  subj="$(echo | timeout 6 openssl s_client -servername "$TARGET" -connect "$TARGET:443" 2>/dev/null | openssl x509 -noout -subject -issuer 2>/dev/null | tr '\n' ' ')"
  [ -n "${subj:-}" ] && echo "  [cert] $subj"
fi

# In ingest.json mergen (bestehende iocs erhalten, simpel anhaengen)
TMP="$(mktemp)"
if [ -f "$OUT" ] && grep -q '"iocs"' "$OUT" 2>/dev/null; then
  # vor schliessender Klammer der iocs-Liste einfuegen (best effort)
  sed "s/\"iocs\"[[:space:]]*:[[:space:]]*\[/\"iocs\": [${IOCS},/" "$OUT" > "$TMP" && mv "$TMP" "$OUT"
else
  cat > "$OUT" <<EOF
{ "source":"phone-dns", "ts":"$TS", "iocs":[${IOCS}],
  "timeline":[ {"ts":"$TS","kind":"recon","text":"phone-dns $TARGET"} ] }
EOF
fi
echo "[+] IOCs in $OUT. In IR-Pilot importieren (Bericht -> Daten importieren)."
