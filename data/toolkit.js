/* IR-Pilot – Toolkit: read-only Triage-/Acquisition-Skripte fuer den USB-Stick.
 * Bewusst defensiv: nur Sammeln/Sichern, keine Veraenderung am Zielsystem.
 * Jeder Eintrag wird in der App angezeigt (kopier-/herunterladbar) und liegt
 * zusaetzlich als Datei unter tools/ (per export-tools.js materialisiert).
 */
(function (root) {
  'use strict';
  var IR = root.IR || (root.IR = {});

  IR.toolkit = [
    {
      id: 'Windows-Triage', name: 'Windows-Triage', os: 'Windows (PowerShell, Admin)',
      filename: 'windows-triage.ps1',
      purpose: 'Fluechtige + Schluessel-Artefakte eines Windows-Hosts read-only sichern (Prozesse, Netz, Autostarts, Tasks, Dienste, EventLogs, Prefetch) inkl. Hash-Manifest.',
      safety: 'Read-only. NICHT herunterfahren. Fuer RAM-Abbild separates Tool nutzen.',
      script:
"#requires -RunAsAdministrator\n" +
"# Windows-Triage (read-only). Ausgabe auf USB-Stick: .\\windows-triage.ps1 -Out E:\\evidence\n" +
"param([string]$Out = \"$PSScriptRoot\\triage-$(hostname)-$(Get-Date -f yyyyMMdd-HHmmss)\")\n" +
"$ErrorActionPreference='SilentlyContinue'\n" +
"New-Item -ItemType Directory -Force -Path $Out | Out-Null\n" +
"Start-Transcript \"$Out\\_transcript.txt\" | Out-Null\n" +
"Write-Host \"[*] Triage -> $Out\"\n" +
"Get-ComputerInfo | Out-File $Out\\systeminfo.txt\n" +
"Get-Process | Select Name,Id,Path,Company,StartTime,CPU | Sort Name | Out-File $Out\\processes.txt\n" +
"Get-CimInstance Win32_Process | Select ProcessId,Name,CommandLine,ParentProcessId | Out-File $Out\\process-cmdline.txt\n" +
"Get-NetTCPConnection | Select LocalAddress,LocalPort,RemoteAddress,RemotePort,State,OwningProcess | Out-File $Out\\netstat.txt\n" +
"ipconfig /all  | Out-File $Out\\ipconfig.txt; arp -a | Out-File $Out\\arp.txt; route print | Out-File $Out\\route.txt\n" +
"Get-DnsClientCache | Out-File $Out\\dnscache.txt\n" +
"Get-CimInstance Win32_StartupCommand | Out-File $Out\\autostart.txt\n" +
"foreach($k in 'HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run','HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run','HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\RunOnce'){ \"== $k\" | Out-File $Out\\run-keys.txt -Append; Get-ItemProperty $k | Out-File $Out\\run-keys.txt -Append }\n" +
"Get-ScheduledTask | Where State -ne 'Disabled' | Select TaskName,TaskPath,State | Out-File $Out\\scheduled-tasks.txt\n" +
"Get-Service | Where Status -eq 'Running' | Select Name,DisplayName,StartType | Out-File $Out\\services.txt\n" +
"Get-LocalUser | Out-File $Out\\localusers.txt; Get-LocalGroupMember Administrators | Out-File $Out\\local-admins.txt\n" +
"Get-ChildItem C:\\Windows\\Prefetch\\*.pf | Select Name,LastWriteTime | Out-File $Out\\prefetch.txt\n" +
"Get-CimInstance Win32_LogonSession | Out-File $Out\\logonsessions.txt\n" +
"foreach($log in 'Security','System','Application','Microsoft-Windows-PowerShell/Operational','Microsoft-Windows-TerminalServices-RemoteConnectionManager/Operational'){ $f=\"$Out\\evtx-\"+($log -replace '[\\\\/]','_')+\".evtx\"; wevtutil epl \"$log\" \"$f\" 2>$null }\n" +
"Get-MpThreatDetection 2>$null | Out-File $Out\\defender-detections.txt\n" +
"# Hash-Manifest (Chain of Custody)\n" +
"Get-ChildItem -Recurse -File $Out | Get-FileHash -Algorithm SHA256 | Select Hash,Path | Out-File $Out\\_SHA256SUMS.txt\n" +
"Stop-Transcript | Out-Null\n" +
"Write-Host \"[+] Fertig. Manifest: $Out\\_SHA256SUMS.txt\"\n"
    },
    {
      id: 'Linux-Triage', name: 'Linux-Triage', os: 'Linux (bash, root)',
      filename: 'linux-triage.sh',
      purpose: 'Read-only Triage eines Linux-Hosts (Prozesse, Sockets, offene Dateien, Cron, systemd, Logins, Logs) + Hash-Manifest.',
      safety: 'Read-only. NICHT neu starten. Fuer RAM ggf. avml/LiME separat.',
      script:
"#!/usr/bin/env bash\n" +
"# Linux-Triage (read-only).  sudo ./linux-triage.sh /pfad/zum/usb\n" +
"set -u\n" +
"OUT=\"${1:-./triage-$(hostname)-$(date +%Y%m%d-%H%M%S)}\"\n" +
"mkdir -p \"$OUT\"; echo \"[*] Triage -> $OUT\"\n" +
"{ uname -a; uptime; date -u; } > \"$OUT/system.txt\" 2>&1\n" +
"ps auxww            > \"$OUT/processes.txt\" 2>&1\n" +
"(ss -tupan || netstat -tupan) > \"$OUT/sockets.txt\" 2>&1\n" +
"(lsof -nP || true)  > \"$OUT/openfiles.txt\" 2>&1\n" +
"ip a; ip r; arp -an > \"$OUT/network.txt\" 2>&1\n" +
"(crontab -l; ls -la /etc/cron*; cat /etc/crontab) > \"$OUT/cron.txt\" 2>&1\n" +
"systemctl list-units --type=service --state=running > \"$OUT/services.txt\" 2>&1\n" +
"(last -Faiw; lastb -Faiw 2>/dev/null) > \"$OUT/logins.txt\" 2>&1\n" +
"cp -a /var/log/auth.log* /var/log/secure* \"$OUT/\" 2>/dev/null\n" +
"cp -a /etc/passwd /etc/group \"$OUT/\" 2>/dev/null\n" +
"(getent passwd | awk -F: '$3>=1000') > \"$OUT/users.txt\" 2>&1\n" +
"find / -xdev -newermt \"-2 days\" -type f 2>/dev/null | head -2000 > \"$OUT/recent-files.txt\"\n" +
"sha256sum $(find \"$OUT\" -type f) > \"$OUT/_SHA256SUMS.txt\" 2>/dev/null\n" +
"echo \"[+] Fertig. Manifest: $OUT/_SHA256SUMS.txt\"\n"
    },
    {
      id: 'OT-Netzwerk-Capture', name: 'OT-Netzwerk-Capture', os: 'Linux (bash) – USB-Ethernet',
      filename: 'ot-capture.sh',
      purpose: 'Passiver Netzwerk-Mitschnitt am TAP/SPAN ueber die USB-Ethernet-Karte (pcap) – fuer C2-/OT-Protokollanalyse (104/MMS/GOOSE).',
      safety: 'PASSIV. Karte nur an SPAN/TAP, NICHT in OT aktiv einspeisen. Keine IP konfigurieren noetig.',
      script:
"#!/usr/bin/env bash\n" +
"# Passiver Mitschnitt ueber USB-Ethernet.  sudo ./ot-capture.sh eth1 /pfad/usb [minuten]\n" +
"set -u\n" +
"IFACE=\"${1:?Interface angeben, z.B. eth1}\"; OUT=\"${2:-.}\"; MIN=\"${3:-15}\"\n" +
"mkdir -p \"$OUT\"\n" +
"ip link set \"$IFACE\" up; ip link set \"$IFACE\" promisc on\n" +
"TS=$(date +%Y%m%d-%H%M%S); F=\"$OUT/capture-$IFACE-$TS.pcap\"\n" +
"echo \"[*] Mitschnitt $IFACE -> $F (${MIN} min). Abbruch mit Ctrl-C.\"\n" +
"timeout \"${MIN}m\" tcpdump -i \"$IFACE\" -s 0 -w \"$F\" -W 20 -C 100 2>>\"$OUT/capture.log\"\n" +
"sha256sum \"$F\"* > \"$F.sha256\" 2>/dev/null\n" +
"echo \"[+] Fertig: $F  (Analyse: Wireshark/Zeek; Filter 'ip.addr==<C2>', tcp.port 102/2404)\"\n"
    },
    {
      id: 'AD-Triage', name: 'AD-Triage', os: 'Windows DC (PowerShell, Admin)',
      filename: 'ad-triage.ps1',
      purpose: 'Domain-Controller-Triage bei AD-Kompromittierung: Anmelde-Events (4625/4624/4768/4769/4672), Lockouts, Admin-Gruppenaenderungen, neue Konten.',
      safety: 'Read-only. Auf DC ausfuehren. EVTX werden exportiert, nicht geloescht.',
      script:
"#requires -RunAsAdministrator\n" +
"# AD-Triage (read-only).  .\\ad-triage.ps1 -Out E:\\evidence -Hours 48\n" +
"param([string]$Out=\"$PSScriptRoot\\ad-triage-$(Get-Date -f yyyyMMdd-HHmmss)\",[int]$Hours=48)\n" +
"$ErrorActionPreference='SilentlyContinue'; New-Item -ItemType Directory -Force $Out | Out-Null\n" +
"$since=(Get-Date).AddHours(-$Hours)\n" +
"wevtutil epl Security \"$Out\\Security.evtx\"\n" +
"$ev=Get-WinEvent -FilterHashtable @{LogName='Security';StartTime=$since} \n" +
"$ev | Where Id -in 4625 | Select TimeCreated,@{n='User';e={$_.Properties[5].Value}},@{n='Src';e={$_.Properties[19].Value}} | Export-Csv $Out\\failed-logons-4625.csv -NoType\n" +
"$ev | Where Id -in 4624 | Select TimeCreated,@{n='User';e={$_.Properties[5].Value}},@{n='LogonType';e={$_.Properties[8].Value}},@{n='Src';e={$_.Properties[18].Value}} | Export-Csv $Out\\success-logons-4624.csv -NoType\n" +
"$ev | Where Id -in 4768,4769 | Select TimeCreated,Id,@{n='Acct';e={$_.Properties[0].Value}},@{n='Src';e={$_.Properties[9].Value}} | Export-Csv $Out\\kerberos-4768-4769.csv -NoType\n" +
"$ev | Where Id -in 4672 | Select TimeCreated,@{n='Acct';e={$_.Properties[1].Value}} | Export-Csv $Out\\special-priv-4672.csv -NoType\n" +
"$ev | Where Id -in 4720,4728,4732,4756 | Select TimeCreated,Id,Message | Export-Csv $Out\\account-group-changes.csv -NoType\n" +
"Import-Module ActiveDirectory\n" +
"Search-ADAccount -LockedOut | Select Name,SamAccountName,LastLogonDate | Export-Csv $Out\\locked-accounts.csv -NoType\n" +
"Get-ADGroupMember 'Domain Admins' -Recursive | Select Name,SamAccountName,objectClass | Export-Csv $Out\\domain-admins.csv -NoType\n" +
"Get-ADUser -Filter {whenCreated -gt $since} -Properties whenCreated | Select Name,SamAccountName,whenCreated | Export-Csv $Out\\new-users.csv -NoType\n" +
"Get-ChildItem -Recurse -File $Out | Get-FileHash -Algorithm SHA256 | Select Hash,Path | Out-File $Out\\_SHA256SUMS.txt\n" +
"Write-Host \"[+] AD-Triage fertig: $Out\"\n"
    },
    {
      id: 'M365-Triage', name: 'M365-Triage', os: 'Windows/Cloud (Exchange Online PowerShell)',
      filename: 'm365-triage.ps1',
      purpose: 'Microsoft-365-/Exchange-Postfachpruefung bei BEC: Inbox-Rules, Weiterleitungen, Audit-Log, riskante Anmeldungen, OAuth-Grants.',
      safety: 'Read-only Abfragen. Erfordert Exchange-Online-/Graph-Module + Admin.',
      script:
"# M365-Triage (BEC). Voraussetzung: Connect-ExchangeOnline ; ggf. Connect-MgGraph\n" +
"param([string]$User,[string]$Out=\"$PSScriptRoot\\m365-$(Get-Date -f yyyyMMdd-HHmmss)\")\n" +
"New-Item -ItemType Directory -Force $Out | Out-Null\n" +
"# Posteingangsregeln & Weiterleitungen (Schluesselindikator BEC)\n" +
"Get-InboxRule -Mailbox $User | Select Name,Enabled,Priority,RedirectTo,ForwardTo,ForwardAsAttachmentTo,DeleteMessage,MoveToFolder,From,SubjectContainsWords | Export-Csv $Out\\inbox-rules.csv -NoType\n" +
"Get-Mailbox $User | Select ForwardingAddress,ForwardingSmtpAddress,DeliverToMailboxAndForward | Export-Csv $Out\\forwarding.csv -NoType\n" +
"Get-MailboxPermission $User | Where {$_.User -notlike 'NT AUTHORITY*'} | Export-Csv $Out\\delegates.csv -NoType\n" +
"# Unified Audit Log (letzte 10 Tage)\n" +
"Search-UnifiedAuditLog -StartDate (Get-Date).AddDays(-10) -EndDate (Get-Date) -UserIds $User -ResultSize 5000 | Export-Csv $Out\\audit-log.csv -NoType\n" +
"# Hinweis: Riskante Sign-ins / OAuth-App-Grants via Graph:\n" +
"#  Get-MgAuditLogSignIn -Filter \"userPrincipalName eq '$User'\"  ; Get-MgUserOauth2PermissionGrant\n" +
"Write-Host \"[+] M365-Triage fertig: $Out  (Pruefe RedirectTo/ForwardTo nach extern!)\"\n"
    },
    {
      id: 'Mail-Header', name: 'Mail-Header-Analyse', os: 'Plattformunabhaengig (Python 3)',
      filename: 'parse-eml.py',
      purpose: 'E-Mail-Header aus .eml extrahieren/aufbereiten (Absenderweg, Received-Kette, SPF/DKIM/DMARC, Reply-To-Abweichung) – fuer BEC.',
      safety: 'Read-only. Verarbeitet exportierte .eml-Dateien.',
      script:
"#!/usr/bin/env python3\n" +
"# Mail-Header-Analyse:  python3 parse-eml.py verdaechtig.eml\n" +
"import sys, email, hashlib\n" +
"from email import policy\n" +
"def main(path):\n" +
"    raw=open(path,'rb').read()\n" +
"    print('sha256:', hashlib.sha256(raw).hexdigest())\n" +
"    m=email.message_from_bytes(raw, policy=policy.default)\n" +
"    for h in ['From','Reply-To','Return-Path','To','Subject','Date','Message-ID',\n" +
"              'Authentication-Results','Received-SPF','DKIM-Signature']:\n" +
"        if m[h]: print(f'{h}: {m[h]}')\n" +
"    print('\\n-- Received-Kette (unten=aeltester) --')\n" +
"    for r in m.get_all('Received',[]): print('Received:', ' '.join(r.split())[:200])\n" +
"    frm=(m['From'] or ''); rep=(m['Reply-To'] or '')\n" +
"    if rep and rep.split('<')[-1] not in frm:\n" +
"        print('\\n[!] Reply-To weicht von From ab -> BEC-Indikator')\n" +
"if __name__=='__main__':\n" +
"    if len(sys.argv)<2: print('Nutzung: parse-eml.py datei.eml'); sys.exit(1)\n" +
"    main(sys.argv[1])\n"
    },
    {
      id: 'Beweis-Manifest', name: 'Beweis-Manifest / Hashing', os: 'Linux/macOS (bash)',
      filename: 'evidence-manifest.sh',
      purpose: 'SHA256-Manifest eines Asservat-Ordners erzeugen (Integritaet/Chain of Custody) und spaeter verifizieren.',
      safety: 'Read-only.',
      script:
"#!/usr/bin/env bash\n" +
"# Beweis-Manifest:  ./evidence-manifest.sh create|verify /pfad\n" +
"set -u; CMD=\"${1:?create|verify}\"; DIR=\"${2:?Pfad}\"\n" +
"MAN=\"$DIR/_SHA256SUMS.txt\"\n" +
"if [ \"$CMD\" = create ]; then\n" +
"  ( cd \"$DIR\" && find . -type f ! -name '_SHA256SUMS.txt' -exec sha256sum {} + ) > \"$MAN\"\n" +
"  echo \"[+] Manifest: $MAN  ($(wc -l < \"$MAN\") Dateien)\"\n" +
"else\n" +
"  ( cd \"$DIR\" && sha256sum -c _SHA256SUMS.txt ) && echo '[+] Integritaet OK' || echo '[!] ABWEICHUNG!'\n" +
"fi\n"
    },
    {
      id: 'Memory-Acquisition', name: 'Speicher-Abbild (RAM)', os: 'Linux (avml) / Windows (winpmem)',
      filename: 'memory-acquire.sh',
      purpose: 'RAM forensisch sichern – zuerst, vor dem Abschalten. Linux per avml, Windows per winpmem (Hinweis).',
      safety: 'Fluechtig: vor Abschalten/Trennen. Ausgabe auf USB-Stick, Hash bilden.',
      script:
"#!/usr/bin/env bash\n" +
"# RAM-Abbild.  sudo ./memory-acquire.sh /pfad/usb\n" +
"# Linux: benoetigt 'avml' (https://github.com/microsoft/avml) auf dem Stick.\n" +
"# Windows: winpmem  ->  winpmem.exe -o E:\\\\evidence\\\\mem.raw   (separat ausfuehren)\n" +
"set -u; OUT=\"${1:-.}\"; TS=$(date +%Y%m%d-%H%M%S); F=\"$OUT/mem-$(hostname)-$TS.lime\"\n" +
"DIR=\"$(cd \"$(dirname \"$0\")\" && pwd)\"\n" +
"AVML=\"$DIR/avml\"; [ -x \"$AVML\" ] || AVML=\"$(command -v avml)\"\n" +
"if [ -z \"$AVML\" ]; then echo '[!] avml nicht gefunden – auf den Stick legen.'; exit 1; fi\n" +
"echo \"[*] RAM -> $F\"; \"$AVML\" \"$F\" && sha256sum \"$F\" | tee \"$F.sha256\"\n" +
"echo \"[+] Fertig. Analyse mit Volatility3 (vol -f $F windows.pslist / linux.bash).\"\n"
    },
    {
      id: 'Velociraptor-Offline', name: 'Velociraptor Offline-Collector', os: 'Windows/Linux/macOS',
      filename: 'velociraptor-collect.sh',
      purpose: 'Breite, standardisierte Triage mit Velociraptor (offline, ohne Server) – Artefakte als ZIP.',
      safety: 'Read-only Collection. Velociraptor-Binary auf den Stick legen.',
      script:
"#!/usr/bin/env bash\n" +
"# Velociraptor Offline-Collection.  ./velociraptor-collect.sh /pfad/usb\n" +
"# Binary von https://github.com/Velocidex/velociraptor auf den Stick legen (velociraptor).\n" +
"set -u; OUT=\"${1:-.}\"; DIR=\"$(cd \"$(dirname \"$0\")\" && pwd)\"\n" +
"VR=\"$DIR/velociraptor\"; [ -x \"$VR\" ] || VR=\"$(command -v velociraptor)\"\n" +
"[ -z \"$VR\" ] && { echo '[!] velociraptor-Binary fehlt (auf den Stick legen).'; exit 1; }\n" +
"# Windows-Beispielartefakte; fuer Linux: Linux.Search.FileFinder / Linux.Sys.* \n" +
"\"$VR\" artifacts collect Windows.KapeFiles.Targets \\\n" +
"  --args Device=C: --args _SANS_Triage=Y \\\n" +
"  --output \"$OUT/velociraptor-$(hostname)-$(date +%Y%m%d-%H%M%S).zip\" 2>>\"$OUT/vr.log\"\n" +
"echo \"[+] Fertig. ZIP im Ausgabeordner. (Linux: passende Linux.* Artefakte nutzen.)\"\n"
    },
    {
      id: 'UAC', name: 'UAC – Unix-like Artifacts Collector', os: 'Linux/macOS/Unix',
      filename: 'uac-collect.sh',
      purpose: 'Standardisierte Live-Triage fuer Linux/Unix/macOS (Logs, Persistenz, Prozesse) als Archiv.',
      safety: 'Read-only. UAC (uac-*/uac) auf den Stick legen.',
      script:
"#!/usr/bin/env bash\n" +
"# UAC (https://github.com/tclahr/uac).  sudo ./uac-collect.sh /pfad/usb\n" +
"set -u; OUT=\"${1:-.}\"; DIR=\"$(cd \"$(dirname \"$0\")\" && pwd)\"\n" +
"UAC=\"$DIR/uac\"; [ -x \"$UAC\" ] || UAC=\"$(command -v uac)\"\n" +
"[ -z \"$UAC\" ] && { echo '[!] uac fehlt (Release auf den Stick entpacken).'; exit 1; }\n" +
"sudo \"$UAC\" -p ir_triage \"$OUT\" 2>>\"$OUT/uac.log\"\n" +
"echo \"[+] Fertig. UAC-Archiv (+ Hash) im Ausgabeordner.\"\n"
    },
    {
      id: 'Timeline', name: 'Super-Timeline (plaso)', os: 'Linux (plaso) / Sleuthkit',
      filename: 'make-timeline.sh',
      purpose: 'Forensische Super-Timeline aus einem Mount/Image (plaso log2timeline -> psort CSV) bzw. Dateisystem-Timeline (Sleuthkit).',
      safety: 'Read-only auf Image/Mount (ro). Rechenintensiv.',
      script:
"#!/usr/bin/env bash\n" +
"# Super-Timeline.  ./make-timeline.sh /pfad/zu/image_oder_mount /pfad/usb\n" +
"set -u; SRC=\"${1:?Image/Mount}\"; OUT=\"${2:-.}\"; TS=$(date +%Y%m%d-%H%M%S)\n" +
"if command -v log2timeline.py >/dev/null; then\n" +
"  log2timeline.py --status_view none \"$OUT/plaso-$TS.dump\" \"$SRC\" &&\n" +
"  psort.py -o l2tcsv -w \"$OUT/timeline-$TS.csv\" \"$OUT/plaso-$TS.dump\"\n" +
"elif command -v fls >/dev/null; then\n" +
"  fls -r -m / \"$SRC\" > \"$OUT/bodyfile-$TS.txt\" && mactime -b \"$OUT/bodyfile-$TS.txt\" -d > \"$OUT/timeline-$TS.csv\"\n" +
"else echo '[!] Weder plaso noch sleuthkit gefunden.'; exit 1; fi\n" +
"sha256sum \"$OUT\"/timeline-$TS.csv > \"$OUT/timeline-$TS.csv.sha256\" 2>/dev/null\n" +
"echo \"[+] Timeline: $OUT/timeline-$TS.csv\"\n"
    }
  ];

  if (typeof module !== 'undefined' && module.exports) module.exports = IR.toolkit;
})(typeof window !== 'undefined' ? window : globalThis);
