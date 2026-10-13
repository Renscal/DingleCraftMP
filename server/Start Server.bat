@echo off
rem DINGLECRAFT multiplayer server launcher for Windows. Double-click it. Needs Node.js 20 or newer (https://nodejs.org).
rem Settings: data\server.json next to this file (written on the first run), or add options after the last line's %*.
setlocal
title DINGLECRAFT Server
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   Node.js was not found on this computer.
  echo   Install the LTS version from https://nodejs.org  ^(keep "Add to PATH" ticked^), then run this file again.
  echo.
  pause
  exit /b 1
)

for /f "tokens=1 delims=." %%a in ('node -p "process.versions.node"') do set NODE_MAJOR=%%a
if %NODE_MAJOR% LSS 20 (
  echo.
  echo   This server needs Node.js 20 or newer; this computer has version %NODE_MAJOR%.
  echo   Install the LTS version from https://nodejs.org and run this file again.
  echo.
  pause
  exit /b 1
)

node "%~dp0dinglecraft-server.mjs" %*
echo.
echo   The server has stopped.
pause
