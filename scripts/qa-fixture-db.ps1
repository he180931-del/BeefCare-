param(
    [Parameter(Mandatory=$true)]
    [ValidateSet('start','reset')]
    [string]$Action
)
$ErrorActionPreference = 'Stop'
$compose = Join-Path $PSScriptRoot '..\compose.qa-fixtures.yml'
if (-not $env:BEEFCARE_DB_PASSWORD) { throw 'Set BEEFCARE_DB_PASSWORD in this terminal first.' }
if ($Action -eq 'reset') {
    Write-Host 'Deleting only the disposable beefcare-qa-fixtures Compose volume. Stop its backend first.'
    docker compose --project-name beefcare-qa-fixtures -f $compose down --volumes
    if ($LASTEXITCODE -ne 0) { throw 'QA database reset failed.' }
}
docker compose --project-name beefcare-qa-fixtures -f $compose up -d --wait
if ($LASTEXITCODE -ne 0) { throw 'QA database did not start.' }
