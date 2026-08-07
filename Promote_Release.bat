@echo off
setlocal EnableExtensions DisableDelayedExpansion
REM Exact-commit promotion assistant. It never pushes automatically.
cd /d "%~dp0"

:menu
cls
echo ============================================================
echo WeiG Release Promotion
echo ============================================================
echo   1. Check dev -^> staging
echo   2. Check staging -^> main
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

:fetch
where git >nul 2>nul || (echo [ERROR] Git not found.& exit /b 1)
git fetch --prune origin
exit /b %ERRORLEVEL%

:dev_staging
call :fetch || goto done_fail
set "CANDIDATE="
set /p "CANDIDATE=Candidate ref/SHA [origin/dev]: "
if not defined CANDIDATE set "CANDIDATE=origin/dev"
node tools\promote-release.mjs dev-staging "%CANDIDATE%"
if errorlevel 1 goto done_fail
goto done_ok

:staging_main
call :fetch || goto done_fail
node tools\promote-release.mjs staging-main
if errorlevel 1 goto done_fail
goto done_ok

:status
call :fetch || goto done_fail
node tools\promote-release.mjs status
if errorlevel 1 goto done_fail
goto done_ok

:done_ok
echo.
echo Check completed. Git refs were not changed.
pause
goto menu

:done_fail
echo.
echo Promotion check failed. Nothing was pushed.
pause
goto menu
