<#
  ir-collect.ps1 – IR-Pilot Windows-Schnellsammler (read-only Triage).
  Sammelt fluechtige/volatile Live-Daten von einem laufenden Windows-Rechner und
  laedt das Ergebnis automatisch an den Forensik-Host (Smartphone/Boot-Stick) –
  von dort weiter ins Dashboard/Cloud.

  Aufruf (per IR-Collect.cmd doppelklickbar) oder:
    powershell -ExecutionPolicy Bypass -File ir-collect.ps1 -Base http://10.13.37.50:8080 -Token abcd1234

  Read-only: nur lesende Abfragen, keine Aenderung am Zielsystem.
#>
[CmdletBinding()]
param(
  [string]$Base  = $env:IR_BASE,
  [string]$Token = $env:IR_TOKEN,
  [string]$Out   = "$PSScriptRoot\IR-Collect"
)
$ErrorActionPreference = 'SilentlyContinue'

# Ziel (Host + Token) aus ir-target.txt neben dem Skript lesen, falls nicht uebergeben.
$cfg = Join-Path $PSScriptRoot 'ir-target.txt'
if ((-not $Base -or -not $Token) -and (Test-Path $cfg)) {
  Get-Content $cfg | ForEach-Object {
    if ($_ -match '^\s*base\s*=\s*(.+)$')  { $Base  = $Matches[1].Trim() }
    if ($_ -match '^\s*token\s*=\s*(.+)$') { $Token = $Matches[1].Trim() }
  }
}
if (-not $Base)  { $Base  = Read-Host 'Forensik-Host (z.B. http://10.13.37.50:8080)' }
if (-not $Token) { $Token = Read-Host 'Token' }

$host_ = $env:COMPUTERNAME
$ts    = Get-Date -Format 'yyyyMMdd-HHmmss'
$dir   = Join-Path $Out "$host_-$ts"
New-Item -ItemType Directory -Force -Path $dir | Out-Null
Write-Host "[*] Sammle Windows-Triage von $host_ -> $dir"

function Cap($name, $sb) {
  try { & $sb *>&1 | Out-File -Encoding utf8 (Join-Path $dir "$name.txt") } catch {}
}
Cap 'systeminfo'   { systeminfo }
Cap 'ipconfig'     { ipconfig /all }
Cap 'netstat'      { netstat -ano }
Cap 'tasklist'     { tasklist /v }
Cap 'services'     { Get-CimInstance Win32_Service | Select-Object Name,State,StartMode,PathName | Format-Table -Auto }
Cap 'schtasks'     { schtasks /query /fo LIST /v }
Cap 'arp'          { arp -a }
Cap 'dnscache'     { ipconfig /displaydns }
Cap 'whoami'       { whoami /all }
Cap 'netuser'      { net user; net localgroup administrators }
Cap 'smbsessions'  { net session }
Cap 'processes'    { Get-CimInstance Win32_Process | Select-Object ProcessId,Name,CommandLine | Format-List }
Cap 'autoruns_run' { reg query "HKLM\Software\Microsoft\Windows\CurrentVersion\Run" /s; reg query "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /s }
Cap 'defender'     { Get-MpThreatDetection; Get-MpComputerStatus }
# Letzte sicherheitsrelevante Events (Logins/Prozesse), best effort
try { Get-WinEvent -FilterHashtable @{LogName='Security';Id=4624,4625,4672,4688} -MaxEvents 400 |
      Select-Object TimeCreated,Id,Message | Format-List | Out-File -Encoding utf8 (Join-Path $dir 'events_security.txt') } catch {}

# --- IOCs/Notizen fuer IR-Pilot ableiten (ingest.json) ---
$iocs = @()
try {
  Get-NetTCPConnection -State Established |
    Where-Object { $_.RemoteAddress -and $_.RemoteAddress -notmatch '^(127\.|0\.0\.0\.0|::1|::)' } |
    Select-Object -ExpandProperty RemoteAddress -Unique |
    ForEach-Object { $iocs += @{ type='ip'; value="$_"; note="established conn @ $host_" } }
} catch {}

$ingest = @{
  schema   = 1
  source   = "win-collect:$host_"
  hosts    = @(@{ name = $host_; note = 'Windows-Live-Triage' })
  iocs     = $iocs
  notes    = @("Windows-Live-Triage $host_ ($ts): systeminfo, netstat, tasklist, schtasks, autoruns, Security-Events gesammelt.")
  evidence = @(@{
    name = "Windows-Triage $host_"; type = 'triage-paket'; volatility = 'mittel'
    method = 'ir-collect.ps1 (read-only)'; source = $host_; location = "intake/$host_-$ts.zip"
  })
}
$ingest | ConvertTo-Json -Depth 6 | Out-File -Encoding utf8 (Join-Path $dir 'ingest.json')

# --- Packen + Hash ---
$zip = Join-Path $Out "$host_-$ts.zip"
try { Compress-Archive -Path "$dir\*" -DestinationPath $zip -Force } catch {}
$sha = (Get-FileHash $zip -Algorithm SHA256).Hash
"$sha  $(Split-Path $zip -Leaf)" | Out-File -Encoding ascii "$zip.sha256"
Write-Host "[+] Paket: $zip"
Write-Host "    SHA256: $sha"

# --- Upload an Forensik-Host (Smartphone/Boot-Stick) ---
function Upload($file, $name) {
  $uri = "$Base/api/intake?t=$([uri]::EscapeDataString($Token))&name=$([uri]::EscapeDataString($name))"
  try {
    Invoke-WebRequest -Uri $uri -Method Post -InFile $file -ContentType 'application/octet-stream' -TimeoutSec 120 | Out-Null
    Write-Host "[+] Hochgeladen: $name"
    return $true
  } catch { Write-Host "[!] Upload fehlgeschlagen ($name): $($_.Exception.Message)"; return $false }
}
if ($Base -and $Token) {
  Upload $zip "$host_-$ts.zip" | Out-Null
  Upload (Join-Path $dir 'ingest.json') "$host_-$ts-ingest.json" | Out-Null
  Upload "$zip.sha256" "$host_-$ts.zip.sha256" | Out-Null
  Write-Host "[=] Fertig. Daten erscheinen im IR-Pilot-Dashboard (PIN-geschuetzt) und sind ueber den Host abrufbar."
} else {
  Write-Host "[i] Kein Host/Token – Paket lokal unter $zip. Manuell in IR-Pilot importieren (ingest.json)."
}
