# PATH: server/scripts/openapi-check.ps1
# --- REPLACE START
[CmdletBinding()]
param(
  [string]$Spec = "openapi/openapi.yaml"
)
Write-Host "OpenAPI check (Spectral + Validate + Bundle)" -ForegroundColor Cyan
npx spectral lint $Spec
npx swagger-cli validate $Spec
npx swagger-cli bundle $Spec -o openapi/openapi.bundle.yaml -t yaml
Get-Item openapi/openapi.bundle.yaml | Select-Object Name, Length, LastWriteTime
# --- REPLACE END
