#requires -RunAsAdministrator
# Windows-Triage (read-only). Ausgabe auf USB-Stick: .\windows-triage.ps1 -Out E:\evidence
param([string]$Out = "$PSScriptRoot\triage-$(hostname)-$(Get-Date -f yyyyMMdd-HHmmss)")
$ErrorActionPreference='SilentlyContinue'
New-Item -ItemType Directory -Force -Path $Out | Out-Null
Start-Transcript "$Out\_transcript.txt" | Out-Null
Write-Host "[*] Triage -> $Out"
Get-ComputerInfo | Out-File $Out\systeminfo.txt
Get-Process | Select Name,Id,Path,Company,StartTime,CPU | Sort Name | Out-File $Out\processes.txt
Get-CimInstance Win32_Process | Select ProcessId,Name,CommandLine,ParentProcessId | Out-File $Out\process-cmdline.txt
Get-NetTCPConnection | Select LocalAddress,LocalPort,RemoteAddress,RemotePort,State,OwningProcess | Out-File $Out\netstat.txt
ipconfig /all  | Out-File $Out\ipconfig.txt; arp -a | Out-File $Out\arp.txt; route print | Out-File $Out\route.txt
Get-DnsClientCache | Out-File $Out\dnscache.txt
Get-CimInstance Win32_StartupCommand | Out-File $Out\autostart.txt
foreach($k in 'HKLM:\Software\Microsoft\Windows\CurrentVersion\Run','HKCU:\Software\Microsoft\Windows\CurrentVersion\Run','HKLM:\Software\Microsoft\Windows\CurrentVersion\RunOnce'){ "== $k" | Out-File $Out\run-keys.txt -Append; Get-ItemProperty $k | Out-File $Out\run-keys.txt -Append }
Get-ScheduledTask | Where State -ne 'Disabled' | Select TaskName,TaskPath,State | Out-File $Out\scheduled-tasks.txt
Get-Service | Where Status -eq 'Running' | Select Name,DisplayName,StartType | Out-File $Out\services.txt
Get-LocalUser | Out-File $Out\localusers.txt; Get-LocalGroupMember Administrators | Out-File $Out\local-admins.txt
Get-ChildItem C:\Windows\Prefetch\*.pf | Select Name,LastWriteTime | Out-File $Out\prefetch.txt
Get-CimInstance Win32_LogonSession | Out-File $Out\logonsessions.txt
foreach($log in 'Security','System','Application','Microsoft-Windows-PowerShell/Operational','Microsoft-Windows-TerminalServices-RemoteConnectionManager/Operational'){ $f="$Out\evtx-"+($log -replace '[\\/]','_')+".evtx"; wevtutil epl "$log" "$f" 2>$null }
Get-MpThreatDetection 2>$null | Out-File $Out\defender-detections.txt
# Hash-Manifest (Chain of Custody)
Get-ChildItem -Recurse -File $Out | Get-FileHash -Algorithm SHA256 | Select Hash,Path | Out-File $Out\_SHA256SUMS.txt
Stop-Transcript | Out-Null
Write-Host "[+] Fertig. Manifest: $Out\_SHA256SUMS.txt"
