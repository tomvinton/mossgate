@echo off
cd /d "C:\Users\Tom\Documents\App Development\Mossgate"
echo Installing Netlify CLI...
call npm install -g netlify-cli
echo.
echo Deploying to Netlify...
echo A browser window will open for you to log in (free account).
echo After logging in, return to this window.
echo.
call netlify deploy --prod --dir=dist --site-name=mossgate
pause
