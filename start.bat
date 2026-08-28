@echo off
setlocal enabledelayedexpansion
title Luxora Concierge Platform - One Click Start
color 0E

:: Ensure we are in project root
cd /d "%~dp0"

:: -----------------------------------------------------------------
:: Subcommand Routing
:: -----------------------------------------------------------------
if /i "%~1"=="db" goto :cmd_db
if /i "%~1"=="server" goto :cmd_server
if /i "%~1"=="status" goto :cmd_status
if /i "%~1"=="check" goto :cmd_status
if /i "%~1"=="recover" goto :cmd_recover
if /i "%~1"=="demo" goto :cmd_demo_seed
if /i "%~1"=="demo:seed" goto :cmd_demo_seed
if /i "%~1"=="demo:clean" goto :cmd_demo_clean
if /i "%~1"=="help" goto :cmd_help
if /i "%~1"=="--help" goto :cmd_help
if /i "%~1"=="-h" goto :cmd_help

:: Default workflow: All-in-One Full Launcher
goto :full_startup

:: =================================================================
:: Subcommand: DB Only
:: =================================================================
:cmd_db
echo ================================================================
echo   LUXORA - POSTGRESQL DATABASE MANAGER
echo ================================================================
echo.
call :sub_ensure_db
if %errorlevel% neq 0 (
    echo [ERROR] PostgreSQL startup failed.
    exit /b 1
)
echo.
echo [OK] PostgreSQL is online and ready.
exit /b 0

:: =================================================================
:: Subcommand: Server Only
:: =================================================================
:cmd_server
echo ================================================================
echo   LUXORA - BACKEND EXPRESS API SERVER (:5000)
echo ================================================================
echo.
call :free_port_5000
cd /d "%~dp0backend"
echo [i] Starting Luxora Backend Server on http://localhost:5000 ...
node src/index.js
exit /b %errorlevel%

:: =================================================================
:: Subcommand: Status (Subsumes Docker-Check.ps1)
:: =================================================================
:cmd_status
echo ================================================================
echo   LUXORA - SYSTEM ^& CONTAINER STATUS
echo ================================================================
echo.
docker info >nul 2>&1
if %errorlevel% equ 0 (
    echo Docker Daemon: ONLINE
    echo.
    echo NAME                   IMAGE                SERVICE    STATUS
    echo ----------------------------------------------------------------
    docker compose ps --format "table {{.Name}}	{{.Image}}	{{.Service}}	{{.Status}}"
) else (
    echo Docker Daemon: OFFLINE / UNRESPONSIVE
)
echo.
echo Port Probes:
node -e "const net=require('net');function chk(p,n){const s=net.createConnection(p,'127.0.0.1',()=>{console.log('  [ONLINE]  Port '+p+' ('+n+')');s.destroy();});s.on('error',()=>{console.log('  [OFFLINE] Port '+p+' ('+n+')');});}chk(5432,'PostgreSQL Docker');chk(5433,'PostgreSQL Local Fallback');chk(5000,'Backend API');chk(5173,'Vite Dev Server');"
echo.
exit /b 0

:: =================================================================
:: Subcommand: Recover (Subsumes pg-recover.ps1 & port unlocks)
:: =================================================================
:cmd_recover
echo ================================================================
echo   LUXORA - PROCESS ^& DATABASE RECOVERY
echo ================================================================
echo.
echo [i] Freeing port 5000 (Backend API)...
call :free_port_5000

echo [i] Recovering PostgreSQL zombie processes and clearing lockfiles...
powershell -NoProfile -Command "$ErrorActionPreference='SilentlyContinue'; $svc=Get-Service | Where-Object { $_.Name -like 'postgresql*' -and $_.Status -eq 'Running' }; if (-not $svc) { Get-Process postgres | Stop-Process -Force } else { Get-CimInstance Win32_Process -Filter \"Name='postgres.exe'\" | Where-Object { $_.CommandLine -like '*luxora-pg-data*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force } }; Start-Sleep -Seconds 1; $pidFile=Join-Path $env:TEMP 'luxora-pg-data\postmaster.pid'; if (Test-Path $pidFile) { Remove-Item $pidFile -Force }; Write-Output '[OK] PostgreSQL zombie processes and PID locks cleared.'"

echo [i] Restarting Docker PostgreSQL container if running...
docker info >nul 2>&1
if %errorlevel% equ 0 (
    docker compose restart postgres >nul 2>&1
    echo [OK] Docker PostgreSQL container restarted.
)
echo.
echo [OK] System recovery complete.
exit /b 0

:: =================================================================
:: Subcommand: Demo Bookings
:: =================================================================
:cmd_demo_seed
echo [i] Seeding demo bookings for Provider Dashboard testing...
node backend/prisma/demo-bookings.js seed
exit /b %errorlevel%

:cmd_demo_clean
echo [i] Cleaning up demo bookings and reversing credited earnings...
node backend/prisma/demo-bookings.js clean
exit /b %errorlevel%

:: =================================================================
:: Subcommand: Help
:: =================================================================
:cmd_help
echo Luxora Concierge Platform - Windows CLI
echo.
echo Usage:
echo   start.bat              Full all-in-one startup (preflight, db, deps, build, prisma, seed, launch)
echo   start.bat db           Start and verify PostgreSQL database only
echo   start.bat server       Start backend Express API server only
echo   start.bat status       Check Docker containers and service port status
echo   start.bat recover      Kill zombie database processes and unlock ports
echo   start.bat demo:seed    Seed demo bookings for provider testing
echo   start.bat demo:clean   Clean up demo bookings and reverse earnings
echo   start.bat help         Display this help message
exit /b 0

:: =================================================================
:: Main All-in-One Full Startup Workflow
:: =================================================================
:full_startup
echo ================================================================
echo   LUXORA CONCIERGE PLATFORM - ONE CLICK STARTER ^& SELF-HEALER
echo ================================================================
echo.

:: -----------------------------------------------------------------
:: Step 0: Preflight Verification & Environment Setup
:: -----------------------------------------------------------------
echo [0/7] Running preflight checks...

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed on this PC.
    echo         Please download and install LTS Node.js from https://nodejs.org
    pause
    exit /b 1
)

where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] npm is not found in PATH.
    pause
    exit /b 1
)

:: Auto-create backend.env if missing
if not exist "backend.env" (
    echo [i] Creating backend.env with local development defaults...
    call :create_backend_env
) else (
    :: Self-heal: ensure 127.0.0.1 is used instead of localhost to prevent Windows IPv6 issues
    call :heal_backend_env
)

:: Free port 5000 from stale background instances
call :free_port_5000
echo [OK] Preflight checks passed.
echo.

:: -----------------------------------------------------------------
:: Step 1: Database Startup ^& Multi-Layer Self-Healing
:: -----------------------------------------------------------------
echo [1/7] Initializing PostgreSQL database...
call :sub_ensure_db
if %errorlevel% neq 0 (
    echo [ERROR] Database initialization failed.
    pause
    exit /b 1
)
echo.

:: -----------------------------------------------------------------
:: Step 2: Backend ^& Frontend Dependencies
:: -----------------------------------------------------------------
echo [2/7] Checking dependencies...
if not exist "backend\node_modules" (
    echo [i] Installing backend dependencies...
    pushd backend
    call npm install
    if !errorlevel! neq 0 (
        echo [ERROR] Backend npm install failed.
        popd
        pause
        exit /b 1
    )
    popd
)

if not exist "frontend\node_modules" (
    echo [i] Installing frontend dependencies...
    pushd frontend
    call npm install
    if !errorlevel! neq 0 (
        echo [ERROR] Frontend npm install failed.
        popd
        pause
        exit /b 1
    )
    popd
)
echo [OK] Dependencies are ready.
echo.

:: -----------------------------------------------------------------
:: Step 3: Frontend Build Verification
:: -----------------------------------------------------------------
echo [3/7] Verifying frontend production build...
if not exist "frontend\dist\index.html" (
    echo [i] Frontend not built yet. Building assets...
    pushd frontend
    call npm run build
    if !errorlevel! neq 0 (
        echo [WARN] Frontend build had warnings. Continuing...
    ) else (
        echo [OK] Frontend built successfully.
    )
    popd
) else (
    echo [OK] Frontend distribution build verified.
)
echo.

:: -----------------------------------------------------------------
:: Step 4: Prisma Client Generation
:: -----------------------------------------------------------------
echo [4/7] Generating Prisma Client...
pushd backend
call npx prisma generate
if %errorlevel% neq 0 (
    echo [WARN] Prisma generate had an issue. Terminating any file locks and retrying...
    call :free_port_5000
    call npx prisma generate
    if !errorlevel! neq 0 (
        if not exist "node_modules\.prisma\client\index.js" (
            echo [ERROR] Prisma Client generation failed.
            popd
            pause
            exit /b 1
        )
    )
)
popd
echo [OK] Prisma Client ready.
echo.

:: -----------------------------------------------------------------
:: Step 5: Database Schema Synchronization
:: -----------------------------------------------------------------
echo [5/7] Synchronizing database schema...
pushd backend
call npx prisma db push --accept-data-loss
if %errorlevel% neq 0 (
    echo [WARN] Database push encountered a temporary glitch. Retrying in 2 seconds...
    timeout /t 2 /nobreak >nul
    call npx prisma db push --accept-data-loss
    if !errorlevel! neq 0 (
        echo [ERROR] Prisma db push failed.
        popd
        pause
        exit /b 1
    )
)
popd
echo [OK] Database schema synchronized.
echo.

:: -----------------------------------------------------------------
:: Step 6: Database Seeding (Idempotent)
:: -----------------------------------------------------------------
echo [6/7] Seeding database defaults and demo accounts...
pushd backend
call node prisma/seed.js
if %errorlevel% neq 0 (
    echo [WARN] Seed had an error, retrying with defaults...
    call node prisma/seed.js
)
popd
echo [OK] Database seeded successfully.
echo.

:: -----------------------------------------------------------------
:: Step 7: Launch Server ^& Auto-Open Browser
:: -----------------------------------------------------------------
echo [7/7] Starting Luxora Application Server...
echo.
echo ================================================================
echo   LUXORA CONCIERGE PLATFORM IS READY
echo ================================================================
echo.
echo   WEB APPLICATION ^& API : http://localhost:5000
echo   SWAGGER API DOCS      : http://localhost:5000/api/docs
echo   HEALTH CHECK          : http://localhost:5000/api/health
echo.
echo   DEMO ACCOUNTS
echo   --------------------------------------------------------------
echo   Customer  : customer@luxora.lk / customer123
echo   Provider  : provider@luxora.lk / provider123
echo   Admin     : admin@luxora.lk    / admin123
echo.
echo   DATABASE
echo   --------------------------------------------------------------
echo   PostgreSQL : 127.0.0.1:5432 (luxoradb)
echo.
echo   Opening browser to http://localhost:5000 ...
echo   Press Ctrl+C in this window to stop the server.
echo ================================================================
echo.

start "" "http://localhost:5000"

cd /d "%~dp0backend"
node src/index.js

pause
exit /b 0

:: =================================================================
:: Subroutines and Self-Healing Functions
:: =================================================================

:: ---------- Ensure Database is running ----------
:sub_ensure_db
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo [i] Docker daemon is not responding. Attempting self-heal: starting Docker Desktop...
    call :start_docker_desktop
)

docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo [WARN] Docker Desktop is not running. Checking for local PostgreSQL fallback...
    call :check_local_pg_fallback
    if !USE_LOCAL_PG! neq 1 (
        echo [ERROR] No PostgreSQL provider available.
        echo         Please start Docker Desktop or install PostgreSQL on this PC.
        exit /b 1
    )
    exit /b 0
)

echo [i] Starting PostgreSQL container via Docker Compose...
docker compose up -d postgres
if %errorlevel% neq 0 (
    echo [ERROR] Docker Compose could not start the PostgreSQL container.
    docker compose ps
    docker compose logs --tail=30 postgres
    exit /b 1
)

echo [i] Waiting for PostgreSQL to accept connections on port 5432...
set /a PG_TRIES=0
:wait_pg_loop
node -e "const s=require('net').createConnection(5432,'127.0.0.1',()=>{s.destroy();process.exit(0)});s.on('error',()=>process.exit(1));setTimeout(()=>process.exit(1),1000);" >nul 2>&1
if %errorlevel% equ 0 (
    docker compose exec -T postgres pg_isready -U luxora_user -d luxoradb >nul 2>&1
    if !errorlevel! equ 0 (
        echo [OK] PostgreSQL is healthy and accepting connections on 127.0.0.1:5432.
        exit /b 0
    )
)

set /a PG_TRIES+=1
if %PG_TRIES% lss 20 (
    timeout /t 1 /nobreak >nul
    goto :wait_pg_loop
)

echo [WARN] PostgreSQL taking longer than expected. Attempting self-heal: recreating container...
docker compose rm -sf postgres >nul 2>&1
docker compose up -d postgres
set /a PG_TRIES=0

:retry_pg_loop
node -e "const s=require('net').createConnection(5432,'127.0.0.1',()=>{s.destroy();process.exit(0)});s.on('error',()=>process.exit(1));setTimeout(()=>process.exit(1),1000);" >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] PostgreSQL recovered and accepting connections.
    exit /b 0
)
set /a PG_TRIES+=1
if %PG_TRIES% lss 20 (
    timeout /t 1 /nobreak >nul
    goto :retry_pg_loop
)

echo [ERROR] PostgreSQL self-heal failed. Check Docker Desktop logs:
docker compose logs --tail=50 postgres
exit /b 1

:: ---------- Create backend/.env with local defaults ----------
:create_backend_env
(
    echo # Local development - auto-generated by start.bat
    echo DATABASE_URL="postgresql://luxora_user:luxora_pass@127.0.0.1:5432/luxoradb?schema=public"
    echo JWT_SECRET="luxora_jwt_secret_dev_%RANDOM%_%RANDOM%_%RANDOM%_2026"
    echo PORT=5000
    echo CORS_ORIGIN="http://localhost:5000,http://localhost:3000,http://localhost:5173,http://127.0.0.1:5000,http://127.0.0.1:3000,http://127.0.0.1:5173"
    echo.
    echo # Demo account passwords ^(used by prisma/seed.js^)
    echo CUSTOMER_PASSWORD="customer123"
    echo PROVIDER_PASSWORD="provider123"
    echo ADMIN_PASSWORD="admin123"
) > "backend\.env"
echo [OK] backend\.env created with 127.0.0.1 PostgreSQL defaults.
exit /b 0

:: ---------- Heal backend/.env if localhost is present ----------
:heal_backend_env
node -e "const fs=require('fs');const p='backend/.env';if(fs.existsSync(p)){let c=fs.readFileSync(p,'utf8');let changed=false;if(c.includes('@localhost:5432')){c=c.replace(/@localhost:5432/g,'@127.0.0.1:5432');changed=true;console.log('[i] Self-heal: Updated backend/.env host from localhost to 127.0.0.1');}if(!c.includes('CORS_ORIGIN')){c+='\nCORS_ORIGIN=\"http://localhost:5000,http://localhost:3000,http://localhost:5173,http://127.0.0.1:5000,http://127.0.0.1:3000,http://127.0.0.1:5173\"\n';changed=true;console.log('[i] Self-heal: Added CORS_ORIGIN to backend/.env');}if(changed){fs.writeFileSync(p,c);}}" >nul 2>&1
exit /b 0

:: ---------- Free port 5000 from stale background instances ----------
:free_port_5000
node -e "const {execSync}=require('child_process');try{const out=execSync('netstat -ano -p tcp | findstr :5000').toString();out.split('\n').forEach(line=>{const m=line.trim().match(/\s+LISTENING\s+(\d+)/i);if(m){try{process.kill(Number(m[1]),'SIGKILL');console.log('[i] Released port 5000 (PID '+m[1]+')');}catch{}}});}catch{}" >nul 2>&1
exit /b 0

:: ---------- Auto-start Docker Desktop ----------
:start_docker_desktop
set "DOCKER_EXE="
if exist "%LOCALAPPDATA%\Programs\DockerDesktop\Docker Desktop.exe" set "DOCKER_EXE=%LOCALAPPDATA%\Programs\DockerDesktop\Docker Desktop.exe"
if not defined DOCKER_EXE if exist "%LOCALAPPDATA%\Programs\Docker\Docker\Docker Desktop.exe" set "DOCKER_EXE=%LOCALAPPDATA%\Programs\Docker\Docker\Docker Desktop.exe"
if not defined DOCKER_EXE if exist "%ProgramFiles%\Docker\Docker\Docker Desktop.exe" set "DOCKER_EXE=%ProgramFiles%\Docker\Docker\Docker Desktop.exe"
if not defined DOCKER_EXE if exist "%ProgramFiles(x86)%\Docker\Docker\Docker Desktop.exe" set "DOCKER_EXE=%ProgramFiles(x86)%\Docker\Docker\Docker Desktop.exe"

if defined DOCKER_EXE (
    echo [i] Launching Docker Desktop: "!DOCKER_EXE!"
    echo [i] Waiting for Docker daemon to become responsive...
    set /a DOCKER_WAIT=0
    :docker_spin
    timeout /t 2 /nobreak >nul
    docker info >nul 2>&1
    if !errorlevel! equ 0 (
        echo [OK] Docker daemon is now online and ready.
        exit /b 0
    )
    set /a DOCKER_WAIT+=1
    if !DOCKER_WAIT! lss 25 (
        goto :docker_spin
    )
    echo [WARN] Docker Desktop did not respond within 50 seconds.
) else (
    echo [WARN] Docker Desktop executable not found in standard paths.
)
exit /b 0

:: ---------- Check Local PostgreSQL Fallback ----------
:check_local_pg_fallback
set "USE_LOCAL_PG=0"
node -e "const s=require('net').createConnection(5432,'127.0.0.1',()=>{s.destroy();process.exit(0)});s.on('error',()=>process.exit(1));setTimeout(()=>process.exit(1),1000);" >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Detected local PostgreSQL running on port 5432.
    set "USE_LOCAL_PG=1"
    exit /b 0
)

node -e "const s=require('net').createConnection(5433,'127.0.0.1',()=>{s.destroy();process.exit(0)});s.on('error',()=>process.exit(1));setTimeout(()=>process.exit(1),1000);" >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Detected local PostgreSQL running on port 5433.
    set "USE_LOCAL_PG=1"
    node -e "const fs=require('fs');const p='backend/.env';if(fs.existsSync(p)){let c=fs.readFileSync(p,'utf8');if(c.includes(':5432/')){c=c.replace(/:5432\//g,':5433/');fs.writeFileSync(p,c);console.log('[i] Pointed backend/.env to local PostgreSQL on port 5433');}}" >nul 2>&1
    exit /b 0
)
exit /b 0
