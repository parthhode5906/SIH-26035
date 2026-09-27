@echo off
setlocal

title NAWI Development Environment

REM ============================================================
REM NAWI - One Click Development Launcher
REM ============================================================

set "ROOT=%~dp0"
set "BACKEND=%ROOT%backend"
set "FRONTEND=%ROOT%NAWI Frontend 7"

echo.
echo ============================================================
echo              NAWI DEVELOPMENT ENVIRONMENT
echo ============================================================
echo.
echo Backend  : http://localhost:8000
echo Frontend : http://localhost:5174
echo.

REM ============================================================
REM CHECK BACKEND
REM ============================================================

if not exist "%BACKEND%" (
    echo [ERROR] Backend folder not found:
    echo %BACKEND%
    echo.
    pause
    exit /b 1
)

echo [OK] Backend folder found.

REM ============================================================
REM CHECK FRONTEND
REM ============================================================

if not exist "%FRONTEND%" (
    echo [ERROR] NAWI Frontend 7 folder not found:
    echo %FRONTEND%
    echo.
    pause
    exit /b 1
)

if not exist "%FRONTEND%\package.json" (
    echo [ERROR] package.json not found in:
    echo %FRONTEND%
    echo.
    pause
    exit /b 1
)

echo [OK] NAWI Frontend 7 found.

REM ============================================================
REM FRONTEND DEPENDENCIES
REM ============================================================

if not exist "%FRONTEND%\node_modules" (

    echo.
    echo [INFO] Frontend dependencies not found.
    echo [INFO] Installing npm dependencies...
    echo.

    pushd "%FRONTEND%"

    call npm.cmd install

    if errorlevel 1 (
        echo.
        echo [ERROR] npm install failed.
        echo.
        popd
        pause
        exit /b 1
    )

    popd

    echo.
    echo [OK] Frontend dependencies installed.
)

REM ============================================================
REM START BACKEND
REM ============================================================

echo.
echo [INFO] Starting NAWI Backend...

REM
REM IMPORTANT:
REM Replace YOUR_BACKEND_COMMAND_HERE with the exact command
REM you currently use to start your working FastAPI backend.
REM
REM Example:
REM uvicorn main:app --reload --host 0.0.0.0 --port 8000
REM

start "NAWI Backend" cmd /k "cd /d ""%BACKEND%"" && YOUR_BACKEND_COMMAND_HERE"

REM ============================================================
REM START FRONTEND
REM ============================================================

echo [INFO] Starting NAWI Frontend 7...

start "NAWI Frontend 7" cmd /k "cd /d ""%FRONTEND%"" && call npm.cmd run dev"

REM ============================================================
REM WAIT FOR VITE
REM ============================================================

echo.
echo [INFO] Waiting for frontend to start...

timeout /t 3 /nobreak >nul

REM ============================================================
REM OPEN FRONTEND IN DEFAULT BROWSER
REM ============================================================

echo [INFO] Opening NAWI Frontend...
echo.

start "" "http://localhost:5174/"

REM ============================================================
REM DONE
REM ============================================================

echo ============================================================
echo              NAWI STARTUP COMPLETE
echo ============================================================
echo.
echo Backend  : http://localhost:8000
echo Frontend : http://localhost:5174
echo.
echo The frontend has been opened in your default browser.
echo.
echo Backend and Frontend terminals are running separately.
echo ============================================================
echo.

exit /b 0