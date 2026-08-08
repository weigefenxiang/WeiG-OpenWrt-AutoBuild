@echo off
setlocal EnableExtensions DisableDelayedExpansion
REM Exact-commit promotion assistant with explicit confirmation and post-push verification.
cd /d "%~dp0"

:menu
cls
echo ============================================================
echo WeiG Release Promotion
echo ============================================================
echo   1. Promote dev -^> staging
echo   2. Promote staging -^> main
echo   3. Show release status
echo   0. Exit
echo ============================================================
set "ACTION="
set /p "ACTION=Select: "
if "%ACTION%"=="0" exit /b 0
if "%ACTION%"=="1" goto dev_staging
if "%ACTION%"=="2" goto staging_main
if "%ACTION%"=="3" goto status
echo Invalid selection.
timeout /t 2 /nobreak >nul
goto menu

:dev_staging
node tools\promote-release.mjs promote dev-staging
if errorlevel 1 goto done_fail
goto done

:staging_main
node tools\promote-release.mjs promote staging-main
if errorlevel 1 goto done_fail
goto done

:status
node tools\promote-release.mjs status
if errorlevel 1 goto done_fail
goto done

:done
echo.
pause
goto menu

:done_fail
echo.
echo Promotion failed. Review the BLOCKED message above.
pause
goto menu
