@echo off
setlocal
cd /d "%~dp0"

echo ==========================================
echo   LUXORA - REVERSE 2 COMMITS
echo ==========================================
echo.
echo This will hard-reset LOCAL main by 2 commits
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

git reset --hard HEAD~2
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
echo DONE: main was reversed by 2 commits and pushed to GitHub.
pause
exit /b 0

:cancel
echo Cancelled.
pause
exit /b 0
