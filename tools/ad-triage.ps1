#requires -RunAsAdministrator
# AD-Triage (read-only).  .\ad-triage.ps1 -Out E:\evidence -Hours 48
param([string]$Out="$PSScriptRoot\ad-triage-$(Get-Date -f yyyyMMdd-HHmmss)",[int]$Hours=48)
$ErrorActionPreference='SilentlyContinue'; New-Item -ItemType Directory -Force $Out | Out-Null
$since=(Get-Date).AddHours(-$Hours)
wevtutil epl Security "$Out\Security.evtx"
$ev=Get-WinEvent -FilterHashtable @{LogName='Security';StartTime=$since} 
$ev | Where Id -in 4625 | Select TimeCreated,@{n='User';e={$_.Properties[5].Value}},@{n='Src';e={$_.Properties[19].Value}} | Export-Csv $Out\failed-logons-4625.csv -NoType
$ev | Where Id -in 4624 | Select TimeCreated,@{n='User';e={$_.Properties[5].Value}},@{n='LogonType';e={$_.Properties[8].Value}},@{n='Src';e={$_.Properties[18].Value}} | Export-Csv $Out\success-logons-4624.csv -NoType
$ev | Where Id -in 4768,4769 | Select TimeCreated,Id,@{n='Acct';e={$_.Properties[0].Value}},@{n='Src';e={$_.Properties[9].Value}} | Export-Csv $Out\kerberos-4768-4769.csv -NoType
$ev | Where Id -in 4672 | Select TimeCreated,@{n='Acct';e={$_.Properties[1].Value}} | Export-Csv $Out\special-priv-4672.csv -NoType
$ev | Where Id -in 4720,4728,4732,4756 | Select TimeCreated,Id,Message | Export-Csv $Out\account-group-changes.csv -NoType
Import-Module ActiveDirectory
Search-ADAccount -LockedOut | Select Name,SamAccountName,LastLogonDate | Export-Csv $Out\locked-accounts.csv -NoType
Get-ADGroupMember 'Domain Admins' -Recursive | Select Name,SamAccountName,objectClass | Export-Csv $Out\domain-admins.csv -NoType
Get-ADUser -Filter {whenCreated -gt $since} -Properties whenCreated | Select Name,SamAccountName,whenCreated | Export-Csv $Out\new-users.csv -NoType
Get-ChildItem -Recurse -File $Out | Get-FileHash -Algorithm SHA256 | Select Hash,Path | Out-File $Out\_SHA256SUMS.txt
Write-Host "[+] AD-Triage fertig: $Out"
