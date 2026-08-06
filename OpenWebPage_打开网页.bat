@echo off
REM ============================================================
REM  Open the firmware customizer locally in one visible window.
REM  Requires Node.js. Close this wrt-server window to stop it.
REM  This file must stay pure ASCII + CRLF for all Windows codepages.
REM ============================================================
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js not found. Install: https://nodejs.org/
  powershell -NoProfile -EncodedCommand VwByAGkAdABlAC0ASABvAHMAdAAgACcAWwAZle+LXQAgACpnfmIwUiAATgBvAGQAZQAuAGoAcwAM//eLiVvFiBr/aAB0AHQAcABzADoALwAvAG4AbwBkAGUAagBzAC4AbwByAGcALwAnAA==
  pause
  exit /b 1
)

REM Reuse an existing healthy preview server without opening another server window.
powershell -NoProfile -Command "try { $r=Invoke-WebRequest -UseBasicParsing -TimeoutSec 1 'http://localhost:8642/index.html'; $e=Invoke-WebRequest -UseBasicParsing -TimeoutSec 1 'http://localhost:8642/lib/catalog-engine.js'; $l=Invoke-WebRequest -UseBasicParsing -TimeoutSec 1 'http://localhost:8642/lib/catalog-loader.js'; if ($r.StatusCode -eq 200 -and $r.Content -match 'menuconfigBox' -and $e.Headers['Content-Type'] -match 'javascript' -and $l.Headers['Content-Type'] -match 'javascript') { exit 0 } } catch {}; exit 1"
if not errorlevel 1 (
  start "" "http://localhost:8642"
  exit /b 0
)

REM Refuse to hide a wrong program already listening on the preview port.
powershell -NoProfile -Command "$p=Get-NetTCPConnection -State Listen -LocalPort 8642 -ErrorAction SilentlyContinue | Select-Object -First 1; if($p){ Write-Host ('Port 8642 is already occupied by PID ' + $p.OwningProcess); exit 2 }; exit 0"
if errorlevel 2 goto port_occupied

title wrt-server - local preview 8642
echo Starting local preview server ...
powershell -NoProfile -EncodedCommand VwByAGkAdABlAC0ASABvAHMAdAAgACcAY2soVy9UqFIsZzBXhJjIiQ1noVJoViYgJiAnAA==
echo.
echo   PC:    http://localhost:8642
for /f %%i in ('powershell -NoProfile -Command "(Get-NetIPAddress -AddressFamily IPv4 -PrefixOrigin Dhcp,Manual | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254*' } | Select-Object -First 1).IPAddress"') do set LANIP=%%i
if defined LANIP echo   Phone (same WiFi): http://%LANIP%:8642
if defined LANIP powershell -NoProfile -EncodedCommand VwByAGkAdABlAC0ASABvAHMAdAAgACcAS2I6Zwj/3o+lYwxUAE4qTiAAVwBpAEYAaQAJ/7+L7pUa/ycA
if defined LANIP echo       http://%LANIP%:8642
echo.
echo Close this wrt-server window to stop the server.
powershell -NoProfile -EncodedCommand VwByAGkAdABlAC0ASABvAHMAdAAgACcAc1HtldmPKk4gAHcAcgB0AC0AcwBlAHIAdgBlAHIAIACXeuNTc1PvU1xQYmsNZ6FSaFYCMCcA

REM Open the browser only after both ES modules are served with JavaScript MIME.
start "" /b powershell -NoProfile -WindowStyle Hidden -Command "$ok=$false; for($i=0;$i -lt 40;$i++){ try { $r=Invoke-WebRequest -UseBasicParsing -TimeoutSec 1 'http://localhost:8642/index.html'; $e=Invoke-WebRequest -UseBasicParsing -TimeoutSec 1 'http://localhost:8642/lib/catalog-engine.js'; $l=Invoke-WebRequest -UseBasicParsing -TimeoutSec 1 'http://localhost:8642/lib/catalog-loader.js'; if($r.StatusCode -eq 200 -and $r.Content -match 'menuconfigBox' -and $e.Headers['Content-Type'] -match 'javascript' -and $l.Headers['Content-Type'] -match 'javascript'){ $ok=$true; break } } catch {}; Start-Sleep -Milliseconds 250 }; if($ok){ Start-Process 'http://localhost:8642' }"

node tools\serve.mjs site\wrt 8642
set SERVER_EXIT=%ERRORLEVEL%
if "%SERVER_EXIT%"=="0" exit /b 0

echo.
echo [ERROR] Local preview server exited with code %SERVER_EXIT%.
powershell -NoProfile -EncodedCommand VwByAGkAdABlAC0ASABvAHMAdAAgACcAWwAZle+LXQAgACxnMFeEmMiJDWehUmhW8l0PYRZZAJD6UQz/94vlZwt3Ck65ZRmV74sCMCcA
pause
exit /b %SERVER_EXIT%

:port_occupied
echo.
echo [ERROR] Port 8642 is occupied by another program.
powershell -NoProfile -EncodedCommand VwByAGkAdABlAC0ASABvAHMAdAAgACcAWwAZle+LXQAgAO9641MgADgANgA0ADIAIADyXauIdlHWTgt6j15gUyh1AjD3i0hRc1HtlWBTKHULeo9eDlTNkdWLAjAnAA==
pause
exit /b 2
