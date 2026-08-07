@echo off
setlocal EnableExtensions DisableDelayedExpansion
REM ============================================================
REM  WeiG AutoBuild web environment launcher.
REM  Pure ASCII + CRLF. Local URLs belong in OpenWebPage.local.cmd.
REM ============================================================
cd /d "%~dp0"
set "LOCAL_CONFIG=%~dp0OpenWebPage.local.cmd"
if exist "%LOCAL_CONFIG%" call "%LOCAL_CONFIG%"

if /i "%~1"=="local" goto local_preview
if /i "%~1"=="dev" goto dev_preview
if /i "%~1"=="staging" goto staging_preview
if /i "%~1"=="vps" goto vps_preview
if /i "%~1"=="standalone" goto standalone_production
if /i "%~1"=="github" goto github_pages
if /i "%~1"=="blog" goto blog_production
if /i "%~1"=="pair" goto staging_pair

:menu
cls
echo ============================================================
echo WeiG AutoBuild Web
echo ============================================================
echo   1. Local Preview
echo   2. Dev Preview
echo   3. Staging Preview
echo   4. VPS Staging
echo   5. Standalone Production ^(Cloudflare Pages^)
echo   6. Standalone GitHub Pages
echo   7. Blog Production /wrt
echo   8. Staging Pair ^(Standalone Preview + VPS^)
echo   0. Exit
echo ============================================================
set "ACTION="
set /p "ACTION=Select: "
if "%ACTION%"=="0" exit /b 0
if "%ACTION%"=="1" goto local_preview
if "%ACTION%"=="2" goto dev_preview
if "%ACTION%"=="3" goto staging_preview
if "%ACTION%"=="4" goto vps_preview
if "%ACTION%"=="5" goto standalone_production
if "%ACTION%"=="6" goto github_pages
if "%ACTION%"=="7" goto blog_production
if "%ACTION%"=="8" goto staging_pair
echo Invalid selection.
timeout /t 2 /nobreak >nul
goto menu

:dev_preview
call :open_url DEV_PREVIEW_URL "Dev Preview"
goto return_menu

:staging_preview
call :open_url STAGING_PREVIEW_URL "Staging Preview"
goto return_menu

:vps_preview
call :open_url VPS_STAGING_URL "VPS Staging"
goto return_menu

:standalone_production
call :open_url STANDALONE_PRODUCTION_URL "Standalone Production"
goto return_menu

:github_pages
call :open_url GITHUB_PAGES_URL "Standalone GitHub Pages"
goto return_menu

:blog_production
call :open_url BLOG_PRODUCTION_URL "Blog Production"
goto return_menu

:staging_pair
call :open_url STAGING_PREVIEW_URL "Staging Preview"
if errorlevel 1 goto return_menu
call :open_url VPS_STAGING_URL "VPS Staging"
goto return_menu

:open_url
setlocal
call set "TARGET_URL=%%%~1%%"
if not defined TARGET_URL (
  echo [INFO] %~2 URL is not configured.
  echo Copy OpenWebPage.local.example.cmd to OpenWebPage.local.cmd and fill it locally.
  endlocal & exit /b 1
)
start "" "%TARGET_URL%"
echo Opened %~2: %TARGET_URL%
endlocal & exit /b 0

:return_menu
if not "%~1"=="" exit /b 0
echo.
pause
goto menu

:local_preview
where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js not found. Install: https://nodejs.org/
  pause
  exit /b 1
)

powershell -NoProfile -Command "try { $r=Invoke-WebRequest -UseBasicParsing -TimeoutSec 1 'http://localhost:8642/index.html'; $e=Invoke-WebRequest -UseBasicParsing -TimeoutSec 1 'http://localhost:8642/lib/catalog-engine.js'; $l=Invoke-WebRequest -UseBasicParsing -TimeoutSec 1 'http://localhost:8642/lib/catalog-loader.js'; $s=Invoke-WebRequest -UseBasicParsing -TimeoutSec 1 'http://localhost:8642/lib/catalog-schema6.js'; $w=Invoke-WebRequest -UseBasicParsing -TimeoutSec 1 'http://localhost:8642/lib/catalog-search-worker.js'; if ($r.StatusCode -eq 200 -and $r.Content -match 'menuconfigBox' -and $e.Headers['Content-Type'] -match 'javascript' -and $l.Headers['Content-Type'] -match 'javascript' -and $s.Headers['Content-Type'] -match 'javascript' -and $w.Headers['Content-Type'] -match 'javascript') { exit 0 } } catch {}; exit 1"
if not errorlevel 1 (
  start "" "http://localhost:8642"
  exit /b 0
)

powershell -NoProfile -Command "$p=Get-NetTCPConnection -State Listen -LocalPort 8642 -ErrorAction SilentlyContinue | Select-Object -First 1; if($p){ Write-Host ('Port 8642 is already occupied by PID ' + $p.OwningProcess); exit 2 }; exit 0"
if errorlevel 2 goto port_occupied

title wrt-server - local preview 8642
echo Starting local preview server ...
echo.
echo   PC:    http://localhost:8642
for /f %%i in ('powershell -NoProfile -Command "(Get-NetIPAddress -AddressFamily IPv4 -PrefixOrigin Dhcp,Manual | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254*' } | Select-Object -First 1).IPAddress"') do set LANIP=%%i
if defined LANIP echo   Phone: http://%LANIP%:8642
echo.
echo Close this wrt-server window to stop the server.

start "" /b powershell -NoProfile -WindowStyle Hidden -Command "$ok=$false; for($i=0;$i -lt 40;$i++){ try { $r=Invoke-WebRequest -UseBasicParsing -TimeoutSec 1 'http://localhost:8642/index.html'; $e=Invoke-WebRequest -UseBasicParsing -TimeoutSec 1 'http://localhost:8642/lib/catalog-engine.js'; $l=Invoke-WebRequest -UseBasicParsing -TimeoutSec 1 'http://localhost:8642/lib/catalog-loader.js'; $s=Invoke-WebRequest -UseBasicParsing -TimeoutSec 1 'http://localhost:8642/lib/catalog-schema6.js'; $w=Invoke-WebRequest -UseBasicParsing -TimeoutSec 1 'http://localhost:8642/lib/catalog-search-worker.js'; if($r.StatusCode -eq 200 -and $r.Content -match 'menuconfigBox' -and $e.Headers['Content-Type'] -match 'javascript' -and $l.Headers['Content-Type'] -match 'javascript' -and $s.Headers['Content-Type'] -match 'javascript' -and $w.Headers['Content-Type'] -match 'javascript'){ $ok=$true; break } } catch {}; Start-Sleep -Milliseconds 250 }; if($ok){ Start-Process 'http://localhost:8642' }"
node tools\serve.mjs site\wrt 8642
set "SERVER_EXIT=%ERRORLEVEL%"
if "%SERVER_EXIT%"=="0" exit /b 0
echo.
echo [ERROR] Local preview server exited with code %SERVER_EXIT%.
pause
exit /b %SERVER_EXIT%

:port_occupied
echo.
echo [ERROR] Port 8642 is occupied by another program.
pause
exit /b 2
