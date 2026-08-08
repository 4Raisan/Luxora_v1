@echo off
:: Starts the Luxora dev PostgreSQL instance on port 5433 (detached, safe to re-run)
taskkill /IM postgres.exe /F >nul 2>&1
timeout /t 2 /nobreak >nul
if exist "%TEMP%\luxora-pg-data\postmaster.pid" del /f /q "%TEMP%\luxora-pg-data\postmaster.pid" >nul 2>&1
"C:\Program Files\PostgreSQL\18\bin\pg_ctl.exe" -D "%TEMP%\luxora-pg-data" -o "-p 5433" -l "%TEMP%\luxora-pg.log" start
