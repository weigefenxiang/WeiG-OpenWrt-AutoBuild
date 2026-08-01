@echo off
REM ============================================================
REM  Open the firmware customizer web page locally (Chinese name: DaKaiWangYe)
REM  How to use: double-click this file. It starts a tiny local
REM  web server (needs Node.js) and opens your browser.
REM  To test on your PHONE: connect it to the SAME WiFi and open
REM  the "Phone" address printed below.
REM  To STOP: close the minimized "wrt-server" window.
REM  (Chinese messages are emitted via PowerShell -EncodedCommand
REM   so this file stays pure ASCII and works on any codepage.)
REM ============================================================
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js not found. Please install: https://nodejs.org/
  powershell -NoProfile -EncodedCommand VwByAGkAdABlAC0ASABvAHMAdAAgACcAWwAZle+LXQAgACpnwGhLbTBSIABOAG8AZABlAC4AagBzACwA94tIUYlbxYg6ACAAaAB0AHQAcABzADoALwAvAG4AbwBkAGUAagBzAC4AbwByAGcALwAnAA==
  pause
  exit /b 1
)

echo Starting local preview server ...
powershell -NoProfile -EncodedCommand VwByAGkAdABlAC0ASABvAHMAdAAgACcAY2soVy9UqFIsZzBXhJjIiQ1noVJoVi4ALgAuACcA

REM Reuse a healthy preview server. A 404 means that port 8642 is
REM occupied by the wrong process/root, so do not open a broken page.
powershell -NoProfile -Command "try { $r=Invoke-WebRequest -UseBasicParsing -TimeoutSec 1 'http://localhost:8642/index.html'; if ($r.StatusCode -eq 200 -and $r.Content -match 'devpkgBox') { exit 0 } } catch {}; exit 1"
if not errorlevel 1 goto server_ready

REM Keep the minimized window open on failure so its Node error can be read.
start "wrt-server" /min cmd /k "node tools\serve.mjs site\wrt 8642"
powershell -NoProfile -Command "$ok=$false; for($i=0;$i -lt 20;$i++){ try { $r=Invoke-WebRequest -UseBasicParsing -TimeoutSec 1 'http://localhost:8642/index.html'; if ($r.StatusCode -eq 200 -and $r.Content -match 'devpkgBox') { $ok=$true; break } } catch {}; Start-Sleep -Milliseconds 250 }; if($ok){exit 0}else{exit 1}"
if errorlevel 1 goto server_failed

:server_ready
start "" "http://localhost:8642"
echo.
echo   PC:    http://localhost:8642
for /f %%i in ('powershell -NoProfile -Command "(Get-NetIPAddress -AddressFamily IPv4 -PrefixOrigin Dhcp,Manual | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254*' } | Select-Object -First 1).IPAddress"') do set LANIP=%%i
if defined LANIP echo   Phone (same WiFi): http://%LANIP%:8642
if defined LANIP powershell -NoProfile -EncodedCommand VwByAGkAdABlAC0ASABvAHMAdAAgACgAJwAgACAAIABLYjpnKADejwxUAE4qTiAAVwBpAEYAaQAgAL+L7pUpADoAIABoAHQAdABwADoALwAvACcAIAArACAAJABlAG4AdgA6AEwAQQBOAEkAUAAgACsAIAAnADoAOAA2ADQAMgAnACkA
echo.
echo Close the minimized "wrt-server" window to stop the server.
powershell -NoProfile -EncodedCommand VwByAGkAdABlAC0ASABvAHMAdAAgACcAhJjIiYxb1WsOVCwAc1HtlQBnD1wWU4R2IAB3AHIAdAAtAHMAZQByAHYAZQByACAAl3rjU3NT71NcUGJrDWehUmhWAjB/Tyh19IsOZjoAzFP7USxnh2X2TnNT71M7AACXgYnyXYlbxYggAE4AbwBkAGUALgBqAHMAOwBLYjpnS23Vi/eL3o8MVABOKk4gAFcAaQBGAGkAAjAnAA==
pause
exit /b 0

:server_failed
echo.
echo [ERROR] Local preview did not start on http://localhost:8642/
echo Port 8642 may be occupied. Open the minimized "wrt-server" window to read the Node error.
echo Close that window, then run this file again.
powershell -NoProfile -EncodedCommand VwByAGkAdABlAC0ASABvAHMAdAAgACcAWwAZle+LXQAgACxnMFeEmMiJDWehUmhWKmf9gChXIAA4ADYANAAyACAA73rjUy9UqFICMO9T/YAJZ+dl248LemBTKHXveuNTG//3i1NiAF8AZw9cFlOEdiAAdwByAHQALQBzAGUAcgB2AGUAcgAgAJd641PlZwt3pWIZlQz/c1HtlQ5UzZGwZcxT+1EsZ4dl9k4CMCcAIAAtAEYAbwByAGUAZwByAG8AdQBuAGQAQwBvAGwAbwByACAAUgBlAGQA
pause
exit /b 1
