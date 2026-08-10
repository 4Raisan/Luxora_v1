@echo off
title Luxora Backend - One Click Start
color 0E

echo ========================================
echo   LUXORA BACKEND - ONE CLICK STARTER
echo ========================================
echo.

:: Move to project root
cd /d "%~dp0"

:: 1. Start PostgreSQL
echo [1/7] Starting PostgreSQL...
docker compose up -d postgres >nul 2>&1
if %errorlevel% equ 0 (
    echo [i] Docker Compose PostgreSQL available on port 5432.
) else (
    echo [i] Docker not available.
)

:: Always make sure the local dev instance on 5433 is up (backend/.env default)
if exist "C:\Program Files\PostgreSQL\18\bin\pg_ctl.exe" set "PGBIN=C:\Program Files\PostgreSQL\18\bin"
if not defined PGBIN if exist "C:\Program Files\PostgreSQL\17\bin\pg_ctl.exe" set "PGBIN=C:\Program Files\PostgreSQL\17\bin"
if not defined PGBIN if exist "C:\Program Files\PostgreSQL\16\bin\pg_ctl.exe" set "PGBIN=C:\Program Files\PostgreSQL\16\bin"
if not defined PGBIN if exist "C:\Program Files\PostgreSQL\15\bin\pg_ctl.exe" set "PGBIN=C:\Program Files\PostgreSQL\15\bin"

if defined PGBIN call :setup_local_pg
if not defined PGBIN echo [i] Local PostgreSQL not installed - relying on the Docker instance.
echo.

:: 2. Install backend dependencies
echo [2/7] Installing backend dependencies...
cd backend
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] npm install failed.
    pause
    exit /b 1
)
echo.

:: Stop any backend instance left over from a previous session -
:: it locks the Prisma engine DLL and makes prisma generate fail with EPERM.
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 5000 -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Write-Host ('[i] Stopping previous backend instance (PID ' + $_ + ')'); Stop-Process -Id $_ -Force }"

:: 3. Generate Prisma Client
echo [3/7] Generating Prisma Client...
call npx prisma generate
if %errorlevel% neq 0 (
    if exist "node_modules\.prisma\client\index.js" (
        echo [WARN] prisma generate failed ^(locked engine DLL?^) - using existing client, continuing.
    ) else (
        echo [ERROR] Prisma generate failed and no client exists.
        pause
        exit /b 1
    )
)
echo.

:: 4. Push database schema
echo [4/7] Pushing database schema...
call npx prisma db push
if %errorlevel% neq 0 (
    echo [ERROR] Prisma db push failed. Is PostgreSQL running?
    pause
    exit /b 1
)
echo.

:: 5. Seed database
echo [5/7] Seeding database...
call node prisma/seed.js
if %errorlevel% neq 0 (
    echo [ERROR] Seed failed.
    pause
    exit /b 1
)
echo.

:: 6+7. Start backend server
echo [6/7] Starting backend server...
echo.
echo ========================================
echo.
echo    OPEN THE WEBSITE HERE:
echo.
echo    ^>^>^>  http://localhost:5000  ^<^<^<
echo.
echo    Website      : http://localhost:5000
echo    Login page   : http://localhost:5000/login
echo    API docs     : http://localhost:5000/api/docs
echo.
echo    Press Ctrl+C in this window to stop.
echo.
echo ========================================
echo.
node src/index.js
pause
exit /b 0

:: ---------- Subroutine: ensure local dev PostgreSQL on 5433 ----------
:setup_local_pg
set "PGDATA=%TEMP%\luxora-pg-data"

if not exist "%PGDATA%\PG_VERSION" (
    if exist "%PGDATA%" rmdir /s /q "%PGDATA%" >nul 2>&1
    echo [i] First run: initializing dev database cluster...
    "%PGBIN%\initdb.exe" -U luxora_user -A trust -D "%PGDATA%" -E UTF8
    if not exist "%PGDATA%\PG_VERSION" (
        echo [ERROR] Failed to initialize database cluster.
        echo         If it says the directory "exists but is not empty", delete it first:
        echo           rmdir /s /q "%PGDATA%"
        pause
        exit /b 1
    )
    echo [i] Database cluster created.
)

"%PGBIN%\pg_isready.exe" -h localhost -p 5433 -U luxora_user >nul 2>&1
if %errorlevel% equ 0 (
    echo [i] Dev PostgreSQL already running on port 5433.
    goto :pg_ready
)

echo [i] Starting dev PostgreSQL on port 5433...
"%PGBIN%\pg_ctl.exe" -D "%PGDATA%" -o "-p 5433" -l "%TEMP%\luxora-pg.log" start >nul 2>&1

set /a tries=0
:pg_wait
"%PGBIN%\pg_isready.exe" -h localhost -p 5433 -U luxora_user >nul 2>&1
if %errorlevel% equ 0 goto :pg_up
set /a tries+=1
if %tries% lss 10 (
    timeout /t 1 /nobreak >nul
    goto :pg_wait
)

:: Self-heal: a hard-killed previous run leaves zombie postgres processes
:: (including forked workers) holding the postmaster.pid lock and the shared
:: memory block. pg-recover.ps1 clears them safely, then we retry.
echo [i] PostgreSQL unresponsive - cleaning up stale processes and retrying...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0pg-recover.ps1" >nul 2>&1
"%PGBIN%\pg_ctl.exe" -D "%PGDATA%" -o "-p 5433" -l "%TEMP%\luxora-pg.log" start >nul 2>&1

set /a tries=0
:pg_wait2
"%PGBIN%\pg_isready.exe" -h localhost -p 5433 -U luxora_user >nul 2>&1
if %errorlevel% equ 0 goto :pg_up
set /a tries+=1
if %tries% lss 15 (
    timeout /t 1 /nobreak >nul
    goto :pg_wait2
)
echo [ERROR] PostgreSQL did not become ready. Check %TEMP%\luxora-pg.log
pause
exit /b 1

:pg_up
echo [i] PostgreSQL started.

:pg_ready
"%PGBIN%\psql.exe" -U luxora_user -p 5433 -h localhost -d postgres -c "CREATE DATABASE luxoradb;" >nul 2>&1
echo [i] Database 'luxoradb' ready on port 5433.
exit /b 0
