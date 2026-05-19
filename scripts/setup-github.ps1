# Crée le dépôt GitHub eludinart/Mandala et pousse main.
# Prérequis : gh auth login (une fois)

$ErrorActionPreference = "Stop"
$env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" +
  [System.Environment]::GetEnvironmentVariable("Path", "User")

$ROOT = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $ROOT

gh auth status 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
  Write-Host "Connexion GitHub requise. Lancez : gh auth login"
  exit 1
}

$repo = "eludinart/workspace-mandala"
$exists = gh repo view $repo 2>$null
if (-not $exists) {
  Write-Host "Création du dépôt privé $repo ..."
  gh repo create workspace-mandala --private --source . --remote origin --description "Mandala — plateforme multi-communautés (Next.js + MariaDB)"
} else {
  Write-Host "Dépôt $repo existe déjà."
  git remote remove origin 2>$null
  git remote add origin "https://github.com/$repo.git"
}

Write-Host "Push vers origin main ..."
git push -u origin main
Write-Host "OK : https://github.com/$repo"
