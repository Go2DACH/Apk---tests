@echo off
REM IR-Pilot Windows-Sammler - doppelklickbar vom USB-Stick.
REM Sammelt read-only Live-Triage und laedt sie an den Forensik-Host (Smartphone).
REM Ziel (Host-URL + Token) in ir-target.txt eintragen oder hier abfragen lassen.
setlocal
cd /d "%~dp0"
echo ============================================================
echo  IR-Pilot - Windows Forensik-Sammler (read-only)
echo  Ergebnis geht automatisch ans Smartphone/Dashboard.
echo ============================================================
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0ir-collect.ps1" %*
echo.
echo Fertig. Fenster mit beliebiger Taste schliessen.
pause >nul
