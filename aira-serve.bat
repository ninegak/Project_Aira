@echo off
REM Aira Server Launch Script for Windows
REM Starts both the backend API server and frontend development server

echo 🌸 Starting Aira
echo =================
echo.

REM Check if backend exists
if not exist "aira\target\release\aira_server.exe" (
    echo ❌ Backend not built. Please build it first:
    echo    cd aira ^&^& cargo build --release
    exit /b 1
)

echo 🚀 Starting backend server...
start "Aira Backend" cmd /k "cd aira && .\target\release\aira_server.exe"

REM Wait for backend to be ready
echo ⏳ Waiting for backend to be ready...
timeout /t 5 /nobreak >nul

echo.
echo 🚀 Starting frontend development server...
start "Aira Frontend" cmd /k "cd aira\frontend && npm run dev"

REM Wait for frontend
timeout /t 3 /nobreak >nul

echo.
echo 🎉 Aira is starting!
echo ===================
echo.
echo 🌐 Web UI: http://localhost:5173
echo 🔌 API Server: http://127.0.0.1:3000
echo.
echo Both servers are running in separate windows.
echo Close those windows to stop Aira.
echo.
pause
