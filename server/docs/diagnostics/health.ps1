
---

# File: server/docs/diagnostics/health.ps1
```powershell
<#
.SYNOPSIS
  Quick health diagnostics for Loventia server.

.PARAMETER BaseUrl
  Base URL of the backend (default: http://localhost:5000)

.EXAMPLE
  .\health.ps1
  .\health.ps1 -BaseUrl "http://localhost:5000"
#>

param(
  [string]$BaseUrl = "http://localhost:5000"
)

Write-Host "== Loventia Health Check ==" -ForegroundColor Cyan
Write-Host "BaseUrl: $BaseUrl" -ForegroundColor DarkCyan

$healthUrl = "$BaseUrl/health"

try {
  $res = Invoke-RestMethod -Method GET -Uri $healthUrl -TimeoutSec 10
  Write-Host "[OK] GET /health" -ForegroundColor Green
  $res | ConvertTo-Json -Depth 5
} catch {
  Write-Host "[ERR] GET /health failed:" $_.Exception.Message -ForegroundColor Red
  exit 1
}

# Optional: Swagger docs sanity (dev only)
$docs = @("$BaseUrl/api/docs", "$BaseUrl/docs")
foreach ($u in $docs) {
  try {
    $r = Invoke-WebRequest -Method GET -Uri $u -TimeoutSec 10
    if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 400) {
      Write-Host "[OK] $u reachable" -ForegroundColor Green
    } else {
      Write-Host "[WARN] $u returned $($r.StatusCode)" -ForegroundColor Yellow
    }
  } catch {
    Write-Host "[INFO] $u not available in this environment." -ForegroundColor DarkYellow
  }
}
