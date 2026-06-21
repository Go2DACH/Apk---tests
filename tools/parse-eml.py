#!/usr/bin/env python3
# Mail-Header-Analyse:  python3 parse-eml.py verdaechtig.eml
import sys, email, hashlib
from email import policy
def main(path):
    raw=open(path,'rb').read()
    print('sha256:', hashlib.sha256(raw).hexdigest())
    m=email.message_from_bytes(raw, policy=policy.default)
    for h in ['From','Reply-To','Return-Path','To','Subject','Date','Message-ID',
              'Authentication-Results','Received-SPF','DKIM-Signature']:
        if m[h]: print(f'{h}: {m[h]}')
    print('\n-- Received-Kette (unten=aeltester) --')
    for r in m.get_all('Received',[]): print('Received:', ' '.join(r.split())[:200])
    frm=(m['From'] or ''); rep=(m['Reply-To'] or '')
    if rep and rep.split('<')[-1] not in frm:
        print('\n[!] Reply-To weicht von From ab -> BEC-Indikator')
if __name__=='__main__':
    if len(sys.argv)<2: print('Nutzung: parse-eml.py datei.eml'); sys.exit(1)
    main(sys.argv[1])
