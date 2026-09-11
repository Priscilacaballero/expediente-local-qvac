[CmdletBinding()]
param(
  [string]$Message = "chore: publish local platform update",
  [string]$Remote = "origin",
  [string]$Branch = ""
)

$ErrorActionPreference = "Stop"
$repo = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $repo

function Invoke-Npm([string[]]$Arguments) {
  $nodePath = "C:\Program Files\nodejs"
  if (Test-Path (Join-Path $nodePath "npm.cmd")) { $env:Path = "$nodePath;$env:Path" }
  & npm.cmd @Arguments
  if ($LASTEXITCODE -ne 0) { throw "npm $($Arguments -join ' ') failed with exit code $LASTEXITCODE" }
}

if (-not $Branch) { $Branch = (git branch --show-current).Trim() }
if (-not $Branch) { throw "No se pudo determinar la rama actual." }
if ($Branch -eq "HEAD") { throw "El repositorio está en detached HEAD." }

$sensitive = @(git status --short | ForEach-Object { $_.Substring(3).Trim() } | Where-Object { $_ -match '(^|[\\/])\.env($|\.)|(^|[\\/])\.qvac([\\/]|$)|\.db(-|$)|\.sqlite|\.pem$|\.key$|\.crt$|\.gguf$|\.safetensors$' })
if ($sensitive.Count -gt 0) { throw "Se detectaron archivos sensibles o runtime que no se publicarán: $($sensitive -join ', ')" }

Invoke-Npm @("run", "build")
Invoke-Npm @("test")
Invoke-Npm @("run", "offline")

git add -A
if ((git diff --cached --quiet)) {
  Write-Output "No hay cambios para publicar."
  exit 0
}

git diff --cached --check
git commit -m $Message
git push $Remote $Branch
Write-Output "Publicado en $Remote/$Branch."
