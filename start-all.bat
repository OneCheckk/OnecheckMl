@echo off
title OneCheck Unified Services Launcher
echo ======================================================================
echo           Starting OneCheck Full-Stack AICTE Verification System
echo ======================================================================
echo.

echo [1/3] Launching Python FastAPI ML Microservice on port 8000...
start "OneCheck - ML Microservice (Port 8000)" cmd /k "cd /d "%~dp0ml-service" && python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload"

timeout /t 3 /nobreak >nul

echo [2/3] Launching Node.js Express Backend on port 3000...
start "OneCheck - Node.js Backend (Port 3000)" cmd /k "cd /d "%~dp0backend" && npm run dev"

timeout /t 3 /nobreak >nul

echo [3/3] Launching React Vite Frontend on port 5173...
start "OneCheck - React Frontend (Port 5173)" cmd /k "cd /d "%~dp0frontend\apps\web" && npm run dev"

echo.
echo ======================================================================
echo All 3 tiers have been started in separate terminal windows:
echo   - ML Microservice : http://localhost:8000 (Swagger: /docs)
echo   - Backend Service : http://localhost:3000 (API Health: /api/health)
echo   - Frontend Web UI : http://localhost:5173
echo ======================================================================
