param(
  [string]\ = "openapi/openapi.yaml"
)
Write-Host "Lint..." -ForegroundColor Cyan
npx spectral lint \
Write-Host "Validate..." -ForegroundColor Cyan
npx swagger-cli validate \
Write-Host "Bundle..." -ForegroundColor Cyan
npx swagger-cli bundle \ -o openapi/openapi.bundle.yaml -t yaml
Get-Item openapi/openapi.bundle.yaml | Select-Object Name, Length, LastWriteTime
