@echo off
chcp 65001 >nul
echo === Limarija WD-36: pravljenje instalacije ===
where node >nul 2>nul || (echo Nije instaliran Node.js. Preuzmi LTS verziju sa https://nodejs.org pa pokreni ovaj fajl ponovo. & pause & exit /b 1)
call npm install || (echo Greska pri npm install & pause & exit /b 1)
call npm test || (echo Testovi nisu prosli & pause & exit /b 1)
call npm run dist || (echo Greska pri pravljenju instalacije & pause & exit /b 1)
echo.
echo Gotovo. Instalacija je u folderu "dist" (Limarija WD-36 Setup *.exe).
start "" dist
pause
