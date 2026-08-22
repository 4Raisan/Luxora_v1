@echo off
title Luxora PostgreSQL Starter (Docker)
cd /d "%~dp0"

echo [i] Starting PostgreSQL for Luxora (Docker Compose)...

docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Docker Desktop is not running.
    echo         Start Docker Desktop and wait for it to say "Docker Desktop is running",
    echo         then run this script again. Local PostgreSQL binaries are no longer used.
    pause
    exit /b 1
)

docker compose up -d postgres
if %errorlevel% neq 0 (
    echo [ERROR] Docker Compose could not start the PostgreSQL container.
    docker compose logs --tail=30 postgres
    pause
    exit /b 1
)

:: Wait for the container healthcheck (pg_isready) AND the host port publish.
set /a PG_TRIES=0
:wait_pg_loop
docker compose exec -T postgres pg_isready -U luxora_user -d luxoradb >nul 2>&1
if %errorlevel% equ 0 (
    docker compose port postgres 5432 >nul 2>&1
    if %errorlevel% equ 0 (
        echo [OK] PostgreSQL is healthy on 127.0.0.1:5432.
        echo [i] Data persists in the named Docker volume "pgdata" across restarts.
        exit /b 0
    )
    :: Healthy but the host port is not published (can happen if the first start
    :: hit a port conflict). Recreate once now that the port should be free.
    echo [i] Port 5432 is not published yet. Recreating the container...
    docker compose up -d --force-recreate postgres >nul 2>&1
)
set /a PG_TRIES+=1
if %PG_TRIES% lss 30 (
    timeout /t 1 /nobreak >nul
    goto :wait_pg_loop
)

echo [ERROR] PostgreSQL did not become healthy within 30 seconds.
docker compose logs --tail=50 postgres
exit /b 1
