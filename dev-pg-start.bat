@echo off
title Luxora PostgreSQL Starter
cd /d "%~dp0"

echo [i] Starting PostgreSQL for Luxora...

:: Try Docker first if available
docker info >nul 2>&1
if %errorlevel% equ 0 (
    echo [i] Starting Docker PostgreSQL container...
    docker compose up -d postgres
    echo [OK] PostgreSQL container started on port 5432.
    exit /b 0
)

:: Otherwise try local PostgreSQL
set "PGBIN="
if exist "C:\Program Files\PostgreSQL\18\bin\pg_ctl.exe" set "PGBIN=C:\Program Files\PostgreSQL\18\bin"
if not defined PGBIN if exist "C:\Program Files\PostgreSQL\17\bin\pg_ctl.exe" set "PGBIN=C:\Program Files\PostgreSQL\17\bin"
if not defined PGBIN if exist "C:\Program Files\PostgreSQL\16\bin\pg_ctl.exe" set "PGBIN=C:\Program Files\PostgreSQL\16\bin"
if not defined PGBIN if exist "C:\Program Files\PostgreSQL\15\bin\pg_ctl.exe" set "PGBIN=C:\Program Files\PostgreSQL\15\bin"

if defined PGBIN (
    taskkill /IM postgres.exe /F >nul 2>&1
    timeout /t 2 /nobreak >nul
    if exist "%TEMP%\luxora-pg-data\postmaster.pid" del /f /q "%TEMP%\luxora-pg-data\postmaster.pid" >nul 2>&1
    "%PGBIN%\pg_ctl.exe" -D "%TEMP%\luxora-pg-data" -o "-p 5433" -l "%TEMP%\luxora-pg.log" start
    echo [OK] Local PostgreSQL started on port 5433.
) else (
    echo [ERROR] Neither Docker Desktop nor local PostgreSQL binaries were found.
    pause
)
