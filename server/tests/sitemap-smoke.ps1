# PATH: server/tests/sitemap-smoke.ps1
# Simple smoke test for sitemap endpoint(s).

$ErrorActionPreference = "Stop"

$urls = @(
    "http://localhost:5000/sitemap.xml",
    "http://localhost:5173/sitemap.xml",
    "http://localhost:5000/api/sitemap"
)

Write-Host "=== Loventia sitemap smoke test ===" -ForegroundColor Cyan
Write-Host "Testing possible sitemap URLs..." -ForegroundColor DarkCyan

foreach ($url in $urls) {
    Write-Host "`n--> Trying $url" -ForegroundColor Yellow
    try {
        $resp = Invoke-WebRequest -Uri $url -Method Get -TimeoutSec 5
        $status = [int]$resp.StatusCode
        Write-Host "Status: $status" -ForegroundColor Green

        # Print first ~10 lines of content for inspection
        $contentLines = $resp.Content -split "`n"
        $preview = $contentLines | Select-Object -First 10
        Write-Host "Content preview:" -ForegroundColor DarkGray
        $preview | ForEach-Object { Write-Host $_ }
    } catch {
        Write-Host "Request failed for $url" -ForegroundColor Red
        if ($_.Exception.Response) {
            $r = $_.Exception.Response
            Write-Host "HTTP status: $($r.StatusCode) $([int]$r.StatusCode)" -ForegroundColor Red
        } else {
            Write-Host $_.Exception.Message -ForegroundColor Red
        }
    }
}

Write-Host "`n=== Done ===" -ForegroundColor Cyan
