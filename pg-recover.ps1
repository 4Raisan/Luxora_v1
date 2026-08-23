# Recovers the Luxora dev PostgreSQL (port 5433) from zombie processes.
# A hard-killed parent leaves forked children (io_worker etc.) holding the
# shared memory block, which blocks any restart.
#
# Safety: if a Windows PostgreSQL *service* is currently running, only
# processes that mention the dev data directory are killed. Otherwise all
# postgres.exe processes belong to the dev instance and are cleared.

$ErrorActionPreference = 'SilentlyContinue'

$svcRunning = Get-Service | Where-Object { $_.Name -like 'postgresql*' -and $_.Status -eq 'Running' }

if (-not $svcRunning) {
    Get-Process postgres | Stop-Process -Force
} else {
    Get-CimInstance Win32_Process -Filter "Name='postgres.exe'" |
        Where-Object { $_.CommandLine -like '*luxora-pg-data*' } |
        ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
}

Start-Sleep -Seconds 2
$pgdata = Join-Path $env:TEMP 'luxora-pg-data'
$postmasterPid = Join-Path $pgdata 'postmaster.pid'
if (Test-Path $postmasterPid) { Remove-Item $postmasterPid -Force }
Write-Output 'recovered'
