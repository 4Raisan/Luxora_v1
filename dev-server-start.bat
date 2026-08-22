@echo off
title Luxora Backend API (:5000)
cd /d "%~dp0backend"
echo [i] Starting Luxora Backend API on http://localhost:5000 ...
node src/index.js
pause
