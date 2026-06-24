@echo off
title Mossgate — Push Changes
color 0A
cd /d "%~dp0"

echo.
echo  ============================================
echo   Mossgate — Push to GitHub
echo  ============================================
echo.

git add .
git commit -m "Zoom-to-fit camera + flat house cost"
git push

echo.
echo  Done! Netlify will auto-deploy in ~1 min.
echo  https://mossgate.netlify.app
echo.
pause
