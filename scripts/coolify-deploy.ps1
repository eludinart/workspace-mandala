#Requires -Version 5.1
<#
.SYNOPSIS
  Après push main → file un déploiement Coolify Mandala et attend la fin.

.EXAMPLE
  .\scripts\coolify-deploy.ps1
#>
param(
  [string] $SshTarget = $(if ($env:MANDALA_VPS_SSH) { $env:MANDALA_VPS_SSH } elseif ($env:KORYMB_VPS_SSH) { $env:KORYMB_VPS_SSH } else { "root@187.124.42.135" }),
  [int] $PollSeconds = 20,
  [int] $MaxTicks = 80,
  [switch] $SkipSmoke
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$HelperDir = Join-Path $PSScriptRoot "coolify"

# UUID Coolify prod Mandala (rafraîchir via list-all-apps.php)
$AppUuid = "c1kgkqqlagjt9auec0elpsma"

function Invoke-Ssh([string]$Remote) {
  & ssh -o BatchMode=yes -o ConnectTimeout=20 $SshTarget $Remote
  if ($LASTEXITCODE -ne 0) {
    throw "ssh failed ($LASTEXITCODE): $Remote"
  }
}

function Ensure-Helpers {
  foreach ($f in @("queue-by-uuid.php", "deploy-status.php")) {
    $local = Join-Path $HelperDir $f
    if (-not (Test-Path $local)) { throw "Missing helper: $local" }
  }
  Write-Host ("Upload helpers → {0}:/tmp/" -f $SshTarget) -ForegroundColor Cyan
  & scp -o BatchMode=yes -o ConnectTimeout=20 `
    (Join-Path $HelperDir "queue-by-uuid.php") `
    (Join-Path $HelperDir "deploy-status.php") `
    ($SshTarget + ":/tmp/")
  if ($LASTEXITCODE -ne 0) { throw "scp failed ($LASTEXITCODE)" }
  Invoke-Ssh "docker cp /tmp/queue-by-uuid.php coolify:/tmp/queue-by-uuid.php; docker cp /tmp/deploy-status.php coolify:/tmp/deploy-status.php"
}

Ensure-Helpers

Write-Host "Queue Mandala ($AppUuid)…" -ForegroundColor Cyan
$out = & ssh -o BatchMode=yes -o ConnectTimeout=20 $SshTarget "docker exec coolify php /tmp/queue-by-uuid.php $AppUuid"
if ($LASTEXITCODE -ne 0) { throw "queue Mandala failed: $out" }
$id = ($out | Select-Object -Last 1).ToString().Trim()
if (-not $id) { throw "no deployment uuid for Mandala" }
Write-Host "Mandala deploy id=$id" -ForegroundColor Gray

$st = "unknown"
for ($i = 1; $i -le $MaxTicks; $i++) {
  Start-Sleep -Seconds $PollSeconds
  $st = (& ssh -o BatchMode=yes -o ConnectTimeout=20 $SshTarget "docker exec coolify php /tmp/deploy-status.php $id").ToString().Trim()
  Write-Host "tick $i Mandala $st"
  if ($st -match '^(finished|failed|cancelled|error)$') {
    if ($st -ne 'finished') { throw "Mandala deploy ended: $st" }
    Write-Host "Mandala DONE" -ForegroundColor Green
    break
  }
  if ($i -eq $MaxTicks) { throw "Mandala deploy timeout (last=$st)" }
}

if (-not $SkipSmoke) {
  Write-Host "Smoke https://mandala.eludein.art/api/health …" -ForegroundColor Cyan
  $health = Invoke-RestMethod -Uri "https://mandala.eludein.art/api/health" -TimeoutSec 30
  Write-Host ($health | ConvertTo-Json -Compress)
  if (-not $health.ok) { throw "smoke health not ok" }
}

Write-Host "Terminé." -ForegroundColor Green
