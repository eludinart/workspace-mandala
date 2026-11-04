# Sync Mandala Play listing from fastlane metadata via Play API (Node).
# Prerequisites: docs/PLAY-STORE-API.md (service account JSON in nogit/play-certs/)
param(
  [switch]$DryRun,
  [switch]$TextsOnly,
  [switch]$ImagesOnly,
  [switch]$SkipAssetCopy
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path (Join-Path $Root "android-twa"))) {
  $Root = $PSScriptRoot | Split-Path -Parent
}

$Meta = Join-Path $Root "android-twa\fastlane\metadata\android\fr-FR"
$SrcAssets = Join-Path $Root "nogit\play-store-assets"
$KeyDefault = Join-Path $Root "nogit\play-certs\play-api-sa.json"

if (-not $SkipAssetCopy) {
  if (-not (Test-Path $SrcAssets)) {
    throw "Assets manquants: $SrcAssets"
  }
  $Img = Join-Path $Meta "images"
  New-Item -ItemType Directory -Force -Path (Join-Path $Img "phoneScreenshots") | Out-Null
  Copy-Item (Join-Path $SrcAssets "icon-512.png") (Join-Path $Img "icon.png") -Force
  Copy-Item (Join-Path $SrcAssets "feature-graphic-1024x500.png") (Join-Path $Img "featureGraphic.png") -Force
  Get-ChildItem (Join-Path $Img "phoneScreenshots\*") -ErrorAction SilentlyContinue | Remove-Item -Force
  Get-ChildItem (Join-Path $SrcAssets "0*-*.png") | Sort-Object Name | ForEach-Object {
    $n = $_.Name.Substring(0, 2)
    Copy-Item $_.FullName (Join-Path $Img "phoneScreenshots\$n.png") -Force
  }
  Write-Host "Assets copies -> $Img"
}

$Pkg = Join-Path $Root "scripts\play-store"
if (-not (Test-Path (Join-Path $Pkg "node_modules\googleapis"))) {
  Write-Host "npm install (scripts/play-store)..."
  Push-Location $Pkg
  npm install
  Pop-Location
}

if (-not $env:GOOGLE_APPLICATION_CREDENTIALS -and -not $env:GOOGLE_PLAY_JSON_KEY) {
  if (Test-Path $KeyDefault) {
    $env:GOOGLE_APPLICATION_CREDENTIALS = $KeyDefault
  }
}

$nodeArgs = @("sync.mjs")
if ($DryRun) { $nodeArgs += "--dry-run" }
if ($TextsOnly) { $nodeArgs += "--texts-only" }
if ($ImagesOnly) { $nodeArgs += "--images-only" }

Push-Location $Pkg
try {
  node @nodeArgs
} finally {
  Pop-Location
}
