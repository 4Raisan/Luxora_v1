@echo off
:: Starts the Luxora backend API on port 5000 (assumes PostgreSQL is already up)
cd /d "%~dp0backend"
node src/index.js > "%TEMP%\luxora-server.log" 2>&1
