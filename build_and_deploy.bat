@echo off
cd /d "C:\Users\Tom\Documents\App Development\Mossgate"
echo Installing dependencies...
call npm install
echo.
echo Building Mossgate...
call npm run build
echo.
echo Build complete! dist folder is ready.
pause
