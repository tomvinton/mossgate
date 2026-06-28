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

for /f "delims=" %%M in ('powershell -NoProfile -Command "$files = git diff --cached --name-only; if (-not $files) { 'Update files' } else { $names = $files | ForEach-Object { Split-Path $_ -Leaf }; $top = $names | Select-Object -First 5; $msg = 'Update ' + ($top -join ', '); if ($names.Count -gt 5) { $msg += ' +more' }; $msg }"') do set COMMITMSG=%%M

echo Committing: %COMMITMSG%
git commit -m "%COMMITMSG%"
git push

echo.
echo  Done! Netlify will auto-deploy in ~1 min.
echo  https://mossgate.netlify.app
echo.
pause
