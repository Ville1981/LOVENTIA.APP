Param(
    [string]$BaseUrl = "http://127.0.0.1:5000",
    [string]$Email = "villehermaala1981@gmail.com",
    [SecureString]$Password
)

Write-Host "=== Loventia Security Smoketest: CSP headers ==="
Write-Host "BaseUrl: $BaseUrl"
Write-Host ""

# 0) Health & Ready
Write-Host "0) Health-check..."
try {
    $health = Invoke-RestMethod -Uri "$BaseUrl/health" -Method Get -TimeoutSec 5
    Write-Host "   /health OK -> $health"
} catch {
    Write-Warning "   /health FAILED: $($_.Exception.Message)"
}

Write-Host "0b) Ready-check..."
try {
    $ready = Invoke-RestMethod -Uri "$BaseUrl/ready" -Method Get -TimeoutSec 5
    Write-Host "   /ready OK -> $($ready | ConvertTo-Json -Compress)"
} catch {
    Write-Warning "   /ready FAILED: $($_.Exception.Message)"
}

Write-Host ""

# 1) Login
Write-Host "1) Login as $Email ..."
$plainPassword = [System.Net.NetworkCredential]::new('', $Password).Password
$loginBody = @{
    email    = $Email
    password = $plainPassword
} | ConvertTo-Json

try {
    $login = Invoke-RestMethod -Uri "$BaseUrl/api/auth/login" -Method Post -ContentType "application/json" -Body $loginBody -TimeoutSec 10
} catch {
    Write-Error "Login FAILED: $($_.Exception.Message)"
    return
}

# Token-kenttä voi olla accessToken TAI token
$token = $null
if ($login.accessToken) {
    $token = $login.accessToken
} elseif ($login.token) {
    $token = $login.token
}

if (-not $token) {
    Write-Error "Login OK mutta token-kenttää ei löytynyt (accessToken/token)."
    return
}

$headersAuth = @{
    Authorization = "Bearer $token"
}

Write-Host "   Login OK, token hankittu."
Write-Host ""

# 2) /api/me sanity-check
Write-Host "2) /api/me sanity-check..."
try {
    $me = Invoke-RestMethod -Uri "$BaseUrl/api/me" -Method Get -Headers $headersAuth -TimeoutSec 10
    $username = $me.user
    $premium  = $me.premium
    $isPremium = $me.isPremium
    Write-Host "   /api/me OK -> user=$username premium=$premium isPremium=$isPremium"
} catch {
    Write-Warning "   /api/me FAILED: $($_.Exception.Message)"
}

Write-Host ""

# 3) Tarkistetaan CSP-headerit muutamasta endpointista
function Show-CspHeaders {
    param(
        [string]$Url,
        [hashtable]$Headers = $null
    )

    Write-Host "3) HEAD $Url"
    try {
        if ($Headers) {
            $resp = Invoke-WebRequest -Uri $Url -Method Head -Headers $Headers -TimeoutSec 10
        } else {
            $resp = Invoke-WebRequest -Uri $Url -Method Head -TimeoutSec 10
        }

        $csp      = $resp.Headers["Content-Security-Policy"]
        $cspRo    = $resp.Headers["Content-Security-Policy-Report-Only"]

        Write-Host "   Status: $($resp.StatusCode)"
        if ($csp) {
            Write-Host "   Content-Security-Policy:"
            Write-Host "      $csp"
        } else {
            Write-Host "   Content-Security-Policy: (none)"
        }

        if ($cspRo) {
            Write-Host "   Content-Security-Policy-Report-Only:"
            Write-Host "      $cspRo"
        } else {
            Write-Host "   Content-Security-Policy-Report-Only: (none)"
        }
    } catch {
        Write-Warning "   HEAD $Url FAILED: $($_.Exception.Message)"
    }

    Write-Host ""
}

# 3a) /health (public)
Show-CspHeaders -Url "$BaseUrl/health"

# 3b) /metrics (public)
Show-CspHeaders -Url "$BaseUrl/metrics"

# 3c) /api/me (auth)
Show-CspHeaders -Url "$BaseUrl/api/me" -Headers $headersAuth

Write-Host "=== CSP-smoketest valmis ==="
