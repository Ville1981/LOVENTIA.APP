Param(
    [string]$BaseUrl  = "http://127.0.0.1:5000",
    [string]$Email    = "villehermaala1981@gmail.com",
    [SecureString]$Password = (ConvertTo-SecureString "Paavali1981" -AsPlainText -Force)
)

Write-Host "=== Security CSP-Enforce smoketest ==="
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
Write-Host ""

# 1) Login to get token
Write-Host "1) Login as $Email to get token..."
$loginBody = @{
    email    = $Email
    password = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto([System.Runtime.InteropServices.Marshal]::SecureStringToCoTaskMemUnicode($Password))
} | ConvertTo-Json

$headersAuth = @{}
try {
    $login = Invoke-RestMethod -Uri "$BaseUrl/api/auth/login" -Method Post -ContentType "application/json" -Body $loginBody -TimeoutSec 10
    Write-Host "   Login OK, token acquired."
    $accessToken = $login.accessToken
    $headersAuth = @{ Authorization = "Bearer $accessToken" }
} catch {
    Write-Warning "   Login FAILED: $($_.Exception.Message)"
}
Write-Host ""

# 2) Small helper to inspect CSP headers on a given path
function Show-CspHeaders {
    param(
        [string]$Path,
        [hashtable]$Headers = @{}
    )

    $url = "$BaseUrl$Path"
    Write-Host "2) HEAD $Path -> CSP headers..."
    try {
        $resp = Invoke-WebRequest -Uri $url -Method Head -Headers $Headers -TimeoutSec 10 -ErrorAction Stop
        $h = $resp.Headers

        $cspRO = $h.'Content-Security-Policy-Report-Only'
        $csp   = $h.'Content-Security-Policy'

        Write-Host ("   Status  : HTTP {0}" -f [int]$resp.StatusCode)
        Write-Host ("   CSP-RO  : {0}" -f ($cspRO -join " "))
        Write-Host ("   CSP     : {0}" -f ($csp   -join " "))
    } catch {
        $code = $_.Exception.Response.StatusCode.value__ 2>$null
        if ($code) {
            Write-Warning ("   HEAD {0} FAILED -> HTTP {1}" -f $Path, $code)
        } else {
            Write-Warning ("   HEAD {0} FAILED: {1}" -f $Path, $_.Exception.Message)
        }
    }
    Write-Host ""
}

# 3) Check CSP headers on a few key endpoints
#    Nyt: odotetaan, että CSP-RO on asetettu, CSP (enforce) puuttuu.
#    Myöhemmin (kun CSP-enforce kytketään päälle prodissa):
#    - CSP-RO voi jäädä rinnalle tai poistua
#    - CSP header ilmestyy (strict policy)
Show-CspHeaders -Path "/health"
Show-CspHeaders -Path "/ready"
Show-CspHeaders -Path "/api/me" -Headers $headersAuth
Show-CspHeaders -Path "/metrics"
Show-CspHeaders -Path "/api/metrics"

Write-Host "=== Security CSP-Enforce smoketest complete ==="
