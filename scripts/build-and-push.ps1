param(
  [string]$CommitMessage = "chore: build and push",
  [switch]$SkipBuild,
  [switch]$NoPush
)

$ErrorActionPreference = "Stop"

$ROOT = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $ROOT

function Assert-NotSensitiveChanges {
  $status = git status --porcelain
  if (-not $status) { return }

  $sensitivePatterns = @(
    '\.env($|[.-])',
    'sync-config\.env',
    'docker-compose\.env',
    'nogit',
    'node_modules',
    '\.next',
    '\.DS_Store'
  )

  foreach ($line in $status -split "`n") {
    if ([string]::IsNullOrWhiteSpace($line)) { continue }
    $path = ($line -split '\s+', 3)[2]
    if (-not $path) { continue }
    if ($path -like '*.example') { continue }
    foreach ($pat in $sensitivePatterns) {
      if ($path -match $pat) {
        throw "Abandon : fichier sensible ou artefact détecté : $path"
      }
    }
  }
}

function HasUncommittedChanges {
  return -not (git diff --quiet --ignore-submodules --) -or (git status --porcelain | Out-String).Trim().Length -gt 0
}

Write-Host "=== Mandala — Build & Push ==="
Write-Host "Root: $ROOT"

Assert-NotSensitiveChanges

if (-not $SkipBuild) {
  Write-Host "`n[1/4] npm run build ..."
  npm run build
}

if (-not (HasUncommittedChanges)) {
  Write-Host "`nAucun changement. Rien à committer."
  exit 0
}

Write-Host "`n[2/4] git add -A"
git add -A

Assert-NotSensitiveChanges

Write-Host "`n[3/4] git commit"
git diff --cached --quiet
if ($LASTEXITCODE -eq 0) {
  Write-Host "Rien de stagé. Fin."
  exit 0
}
git commit -m $CommitMessage

if ($NoPush) {
  Write-Host "`n[4/4] Push ignoré (-NoPush)."
  exit 0
}

$branch = git rev-parse --abbrev-ref HEAD
Write-Host "`n[4/4] git push origin $branch"
git push origin "HEAD:$branch"

Write-Host "`nTerminé."
