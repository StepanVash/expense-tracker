@echo off
cd /d "%~dp0"

:: Check if Vite server is already running on port 5173
netstat -ano | findstr /R /C:":5173 .*LISTENING" >nul 2>&1
if %errorlevel% equ 0 (
    start http://localhost:5173
    exit /b 0
)

:: Start Vite dev server in background
start /min "Expense Tracker Server" cmd /c "npm run dev"

:: Wait briefly for Vite server to initialize
timeout /t 2 /nobreak >nul 2>&1

:: Open browser to localhost
start http://localhost:5173
exit /b 0
