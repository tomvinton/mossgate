@echo off
title Mossgate — Dev Server
color 0A
cd /d "%~dp0"

echo.
echo  ============================================
echo   Mossgate — Starting Dev Server
echo  ============================================
echo.
echo  Your local network URLs will appear below.
echo  Use the Network URL to view from other devices
echo  on the same Wi-Fi (phone, work PC, etc.)
echo.
echo  Keep this window open while developing.
echo  Ctrl+C to stop.
echo.

npm run dev
