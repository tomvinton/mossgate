@echo off
title Mossgate — GitHub Push
color 0A

echo.
echo  ============================================
echo   Mossgate — Initial Push to GitHub
echo  ============================================
echo.

cd /d "%~dp0"

echo [1/5] Configuring git identity...
git config --global user.email "tommvinton@gmail.com"
git config --global user.name "Tom Vinton"
echo.

echo [2/5] Initialising git repository...
git init
git checkout -b main 2>nul
echo.

echo [3/5] Staging all files...
git add .
echo.

echo [4/5] Creating initial commit...
git commit -m "Initial commit"
echo.

echo [5/5] Pushing to GitHub...
git remote remove origin 2>nul
git remote add origin https://github.com/tomvinton/mossgate.git
git push -u origin main

echo.
echo  ============================================
echo   Done! Check GitHub:
echo   https://github.com/tomvinton/mossgate
echo  ============================================
echo.
pause
