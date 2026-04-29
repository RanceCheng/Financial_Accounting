@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required to run Financial Accounting offline.
  echo Please install Node.js from https://nodejs.org and run this file again.
  pause
  exit /b 1
)

node serve.cjs
pause
