@echo off
REM One-click health check / run all syntax + data validations
cd /d "%~dp0"
where node >nul 2>nul || (echo [ERROR] Node.js not found: https://nodejs.org/ & pause & exit /b 1)
node tools\check-all.mjs
pause
