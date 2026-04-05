@echo off
title WA Appt OS - Launcher
color 0A

echo ================================================
echo   WA Appt OS - Starting All Services
echo ================================================
echo.

:: ── Check Node.js ──────────────────────────────────
where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js not found. Install from https://nodejs.org
    pause & exit /b 1
)

:: ── Check Python ───────────────────────────────────
where python >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python not found. Install from https://python.org
    pause & exit /b 1
)

:: ── Fix postcss.config.js warning ──────────────────
echo [FIX] Adding "type":"module" to frontend package.json...
powershell -Command "(Get-Content frontend\package.json) -replace '\"private\": true', '\"private\": true,\n  \"type\": \"module\"' | Set-Content frontend\package.json" 2>nul

:: ── Install frontend deps if needed ────────────────
if not exist "frontend\node_modules\react-qr-code" (
    echo [INSTALL] Installing frontend dependencies...
    cd frontend
    call npm install
    cd ..
)

:: ── Install backend deps if needed ─────────────────
if not exist "backend\node_modules" (
    echo [INSTALL] Installing backend dependencies...
    cd backend
    call npm install
    cd ..
)

:: ── Install python-chatbot node deps if needed ─────
if not exist "python-chatbot\node_modules\whatsapp-web.js" (
    echo [INSTALL] Installing python-chatbot node dependencies...
    cd python-chatbot
    call npm install
    cd ..
)

:: ── Install Python dependencies ─────────────────────
echo [INSTALL] Installing Python dependencies...
pip install -r python-chatbot\requirements.txt --quiet

echo.
echo [START] Launching all services in separate windows...
echo.

:: ── Start MongoDB (if not running) ─────────────────
echo [1/4] Starting MongoDB...
start "MongoDB" cmd /k "mongod --dbpath C:\data\db 2>nul || echo MongoDB already running or not installed - ensure it is running!"

timeout /t 3 /nobreak >nul

:: ── Start Backend (Express on port 5000) ───────────
echo [2/4] Starting Backend (port 5000)...
start "WA Backend - port 5000" cmd /k "cd /d %~dp0backend && npm run dev"

timeout /t 2 /nobreak >nul

:: ── Start Python AI Chatbot (FastAPI on port 8001) ─
echo [3/4] Starting Python AI Bot (port 8001)...
start "WA Python Bot - port 8001" cmd /k "cd /d %~dp0python-chatbot && python -m uvicorn app:app --host 127.0.0.1 --port 8001 --reload"

timeout /t 2 /nobreak >nul

:: ── Start WhatsApp Bot (Node on port 3001) ──────────
echo [4/5] Starting WhatsApp Bot (port 3001)...
start "WA WhatsApp Bot - port 3001" cmd /k "cd /d %~dp0python-chatbot && node src/bot.js"

timeout /t 2 /nobreak >nul

:: ── Start Frontend (Vite on port 3000) ─────────────
echo [5/5] Starting Frontend (port 3000)...
start "WA Frontend - port 3000" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo ================================================
echo   All services started!
echo ================================================
echo.
echo   Frontend:       http://localhost:3000
echo   Backend API:    http://localhost:5000
echo   Python AI Bot:  http://localhost:8001
echo   WhatsApp Bot:   http://localhost:3001
echo   MongoDB:        mongodb://localhost:27017
echo.
echo   Scan the QR code in the "WA WhatsApp Bot" window
echo   to connect WhatsApp.
echo.
echo   Press any key to open the app in your browser...
pause >nul
start http://localhost:3000