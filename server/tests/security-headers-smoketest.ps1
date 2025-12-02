# PATH: server/tests/security-headers-smoketest.ps1

Param(
    [string]$BaseUrl  = "http://127.0.0.1:5000",
    [string]$Email    = "villehermaala1981@gmail.com",
    [SecureString]$Password = (ConvertTo-SecureString -String "Paavali1981" -AsPlainText -Force)
)

Write-Host "=== Security headers smoketest ==="
Write-Host "BaseUrl: $BaseUrl"
Write-Host ""

# 0) Health-check
Write-Host "0) Health-check (GET /health)..."
try {
    $health = Invoke-RestMethod -Uri "$BaseUrl/health" -Method Get -TimeoutSec 10
    Write-Host "   /health OK -> $health"
} catch {
    Write-Warning "   /health FAILED: $($_.Exception.Message)"
}

# 1) Login (simple JSON POST, no SecureString/Marshal)
Write-Host ""
Write-Host "1) Login as $Email to get token..."
$headersAuth = @{}

try {
    $loginBody = @{
        email    = $Email
        password = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto([System.Runtime.InteropServices.Marshal]::SecureStringToCoTaskMemUnicode($Password))
    } | ConvertTo-Json

    $login = Invoke-RestMethod -Uri "$BaseUrl/api/auth/login" -Method Post -ContentType "application/json" -Body $loginBody -TimeoutSec 10
    $accessToken = $login.accessToken

    if ($accessToken) {
        $headersAuth = @{ Authorization = "Bearer $accessToken" }
        Write-Host "   Login OK, token acquired."
    } else {
        Write-Warning "   Login FAILED: accessToken missing in response."
    }
} catch {
    Write-Warning "   Login FAILED: $($_.Exception.Message)"
}

# Helper to print security headers for a given path
function Show-SecurityHeaders {
    param(
        [string]$Path,
        [string]$Label,
        [hashtable]$Headers = $null
    )

    Write-Host ""
    Write-Host "$Label -> security headers..."

    try {
        if ($Headers) {
            $resp = Invoke-WebRequest -Uri "$BaseUrl$Path" -Method Head -Headers $Headers -TimeoutSec 10 -ErrorAction Stop
        } else {
            $resp = Invoke-WebRequest -Uri "$BaseUrl$Path" -Method Head -TimeoutSec 10 -ErrorAction Stop
        }

        $status = [int]$resp.StatusCode
        Write-Host "   Status  : HTTP $status"

        $xct = $resp.Headers["X-Content-Type-Options"]
        $xfo = $resp.Headers["X-Frame-Options"]
        $ref = $resp.Headers["Referrer-Policy"]
        $perm = $resp.Headers["Permissions-Policy"]
        $hsts = $resp.Headers["Strict-Transport-Security"]

        Write-Host "   X-Content-Type-Options: '$xct'"
        Write-Host "   X-Frame-Options: '$xfo' (EXPECTED 'DENY')"
        Write-Host "   Referrer-Policy: '$ref' (EXPECTED 'no-referrer')"

        if ($perm) {
            Write-Host "   Permissions-Policy: '$perm' (EXPECTED to contain 'fullscreen=(self)')"
        } else {
            Write-Host "   Permissions-Policy: MISSING (expected to contain 'fullscreen=(self)')"
        }

        if ($hsts) {
            Write-Host "   Strict-Transport-Security: $hsts"
        } else {
            Write-Host "   Strict-Transport-Security: <none> (expected for http:// dev)"
        }
    } catch {
        Write-Warning "   HEAD $Path FAILED: $($_.Exception.Message)"
    }
}

Write-Host ""
Write-Host "2) HEAD /health -> security headers..."
Show-SecurityHeaders -Path "/health" -Label "2) HEAD /health"

Write-Host ""
Write-Host "3) HEAD /api/me -> security headers (with token)..."

if ($headersAuth.Count -gt 0) {
    Show-SecurityHeaders -Path "/api/me" -Label "3) HEAD /api/me" -Headers $headersAuth
} else {
    Write-Warning "   Skipping /api/me header check because login/token was not available."
}

Write-Host ""
Write-Host "4) HEAD /metrics -> security headers..."
Show-SecurityHeaders -Path "/metrics" -Label "4) HEAD /metrics"

Write-Host ""
Write-Host "5) HEAD /api/metrics -> security headers..."
Show-SecurityHeaders -Path "/api/metrics" -Label "5) HEAD /api/metrics"

Write-Host ""
Write-Host "=== Security headers smoketest complete ==="











