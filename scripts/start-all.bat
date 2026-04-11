@echo off
title WA Appt OS - Launcher
color 0A

echo ================================================
echo   WA Appt OS - Starting All Services
echo ================================================
echo.

set "ROOT=%~dp0.."

:: Check Node.js
where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js not found. Install from https://nodejs.org
    pause & exit /b 1
)

:: Check Python launcher
where py >nul 2>&1
if errorlevel 1 (
    where python >nul 2>&1
    if errorlevel 1 (
        echo [ERROR] Python not found. Install from https://python.org
        pause & exit /b 1
    )
    set "PY_CMD=python"
) else (
    set "PY_CMD=py -3"
)

echo.
echo [START] Launching all services in separate windows...
echo.

echo [1/4] Starting Backend (port 5000)...
start "WA Backend - port 5000" cmd /k "cd /d %ROOT%\backend && npm run dev"

timeout /t 2 /nobreak >nul

echo [2/4] Starting Python AI Bot (port 8001)...
start "WA Python Bot - port 8001" cmd /k "cd /d %ROOT%\python-chatbot && %PY_CMD% -m uvicorn app:app --host 127.0.0.1 --port 8001 --reload"

timeout /t 2 /nobreak >nul

echo [3/4] Starting WhatsApp Bot (port 3001)...
start "WA WhatsApp Bot - port 3001" cmd /k "cd /d %ROOT%\python-chatbot && npm start"

timeout /t 2 /nobreak >nul

echo [4/4] Starting Frontend (port 3000)...
start "WA Frontend - port 3000" cmd /k "cd /d %ROOT%\frontend && npm run dev"

echo.
echo ================================================
echo   All services started!
echo ================================================
echo.
echo   Frontend:       http://localhost:3000
echo   Backend API:    http://localhost:5000
echo   Python AI Bot:  http://localhost:8001
echo   WhatsApp Bot:   http://localhost:3001
echo.
echo   Make sure project dependencies are already installed
echo   before using this launcher.
echo.
echo   Press any key to open the app in your browser...
pause >nul
start http://localhost:3000
