@echo off
setlocal
cd /d "%~dp0"

echo ==========================================
echo   LUXORA - REVERSE 1 COMMIT
echo ==========================================
echo.
echo This will hard-reset LOCAL main by 1 commit
echo and force-update GitHub origin/main.
echo.
choice /C YN /N /M "Continue? [Y/N]: "
if errorlevel 2 goto :cancel

git branch --show-current | findstr /X /C:"main" >nul
if errorlevel 1 (
    echo ERROR: You are not on main.
    pause
    exit /b 1
)

git fetch origin
if errorlevel 1 (
    echo ERROR: git fetch failed.
    pause
    exit /b 1
)

git reset --hard HEAD~1
if errorlevel 1 (
    echo ERROR: hard reset failed.
    pause
    exit /b 1
)

git push origin main --force-with-lease
if errorlevel 1 (
    echo.
    echo PUSH FAILED. GitHub may be blocking force pushes.
    pause
    exit /b 1
)

echo.
echo DONE: main was reversed by 1 commit and pushed to GitHub.
pause
exit /b 0

:cancel
echo Cancelled.
pause
exit /b 0
