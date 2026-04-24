@echo off
title GIDEONSEARTH // RECON GRID
color 0A

echo.
echo  ██████╗ ██╗██████╗ ███████╗ ██████╗ ███╗   ██╗███████╗
echo ██╔════╝ ██║██╔══██╗██╔════╝██╔═══██╗████╗  ██║██╔════╝
echo ██║  ███╗██║██║  ██║█████╗  ██║   ██║██╔██╗ ██║███████╗
echo ██║   ██║██║██║  ██║██╔══╝  ██║   ██║██║╚██╗██║╚════██║
echo ╚██████╔╝██║██████╔╝███████╗╚██████╔╝██║ ╚████║███████║
echo  ╚═════╝ ╚═╝╚═════╝ ╚══════╝ ╚═════╝ ╚═╝  ╚═══╝╚══════╝
echo.
echo  RECON GRID // BOOT SEQUENCE
echo  -----------------------------------------
echo  Checking port 8765...

netstat -ano | findstr ":8765" | findstr "LISTENING" >nul 2>&1
if %errorlevel%==0 (
    echo  [OK] Server already running on port 8765
    goto launch
)

echo  [..] Starting server...
start "GIDEONSEARTH SERVER" /min powershell -NoExit -Command "node '%~dp0server.js'"

echo  [..] Waiting for server to come online...
:waitloop
ping -n 2 127.0.0.1 >nul 2>&1
netstat -ano | findstr ":8765" | findstr "LISTENING" >nul 2>&1
if %errorlevel% neq 0 goto waitloop

:launch
echo  [OK] Server is LIVE on http://localhost:8765
echo  [..] Launching browser...
start "" "http://localhost:8765"

echo.
echo  -----------------------------------------
echo  RECON GRID ONLINE. This window can be closed.
echo  Keep the minimized SERVER window open.
echo  -----------------------------------------
echo.
timeout /t 4 >nul
exit
