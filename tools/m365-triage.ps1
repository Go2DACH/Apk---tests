# M365-Triage (BEC). Voraussetzung: Connect-ExchangeOnline ; ggf. Connect-MgGraph
param([string]$User,[string]$Out="$PSScriptRoot\m365-$(Get-Date -f yyyyMMdd-HHmmss)")
New-Item -ItemType Directory -Force $Out | Out-Null
# Posteingangsregeln & Weiterleitungen (Schluesselindikator BEC)
Get-InboxRule -Mailbox $User | Select Name,Enabled,Priority,RedirectTo,ForwardTo,ForwardAsAttachmentTo,DeleteMessage,MoveToFolder,From,SubjectContainsWords | Export-Csv $Out\inbox-rules.csv -NoType
Get-Mailbox $User | Select ForwardingAddress,ForwardingSmtpAddress,DeliverToMailboxAndForward | Export-Csv $Out\forwarding.csv -NoType
Get-MailboxPermission $User | Where {$_.User -notlike 'NT AUTHORITY*'} | Export-Csv $Out\delegates.csv -NoType
# Unified Audit Log (letzte 10 Tage)
Search-UnifiedAuditLog -StartDate (Get-Date).AddDays(-10) -EndDate (Get-Date) -UserIds $User -ResultSize 5000 | Export-Csv $Out\audit-log.csv -NoType
# Hinweis: Riskante Sign-ins / OAuth-App-Grants via Graph:
#  Get-MgAuditLogSignIn -Filter "userPrincipalName eq '$User'"  ; Get-MgUserOauth2PermissionGrant
Write-Host "[+] M365-Triage fertig: $Out  (Pruefe RedirectTo/ForwardTo nach extern!)"
