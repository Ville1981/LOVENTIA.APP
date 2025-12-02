Param(
    [int]$Iterations = 50,
    [string]$BaseUrl = "http://127.0.0.1:5000",
    [string]$Email = "villehermaala1981@gmail.com",
    [string]$Password = "Paavali1981"
)

Write-Host "=== Loventia Discover Performance Smoketest ==="
Write-Host "BaseUrl   : $BaseUrl"
Write-Host "Iterations: $Iterations"
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

# 1) Login (EI SecureString, EI password-kyselyä)
Write-Host "1) Login as $Email ..."
$loginBody = @{
    email    = $Email
    password = $Password
} | ConvertTo-Json

Write-Host "   Login body: $loginBody"

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

$headers = @{
    Authorization = "Bearer $token"
}

Write-Host "   Login OK, token hankittu."
Write-Host ""

# 2) /api/me sanity-check
Write-Host "2) /api/me sanity-check..."
try {
    $me = Invoke-RestMethod -Uri "$BaseUrl/api/me" -Method Get -Headers $headers -TimeoutSec 10
    $username = $me.user
    $premium  = $me.premium
    $isPremium = $me.isPremium

    Write-Host "   /api/me OK -> user=$username premium=$premium isPremium=$isPremium"
} catch {
    Write-Warning "   /api/me FAILED: $($_.Exception.Message)"
}

Write-Host ""

# 3) Discover-perf-loop
Write-Host "3) Discover performance loop..."
$minMs   = [double]::PositiveInfinity
$maxMs   = 0.0
$totalMs = 0.0
$success = 0
$fail    = 0

$discoverUrl = "$BaseUrl/api/discover?minAge=18&maxAge=60&limit=5"

for ($i = 1; $i -le $Iterations; $i++) {
    $sw = [System.Diagnostics.Stopwatch]::StartNew()

    try {
        $resp = Invoke-WebRequest -Uri $discoverUrl -Method Get -Headers $headers -TimeoutSec 20
        $sw.Stop()

        $ms = $sw.Elapsed.TotalMilliseconds
        $totalMs += $ms
        if ($ms -lt $minMs) { $minMs = $ms }
        if ($ms -gt $maxMs) { $maxMs = $ms }

        if ($resp.StatusCode -eq 200) {
            $success++
        } else {
            $fail++
            Write-Warning ("   [{0}/{1}] Status {2} (latency {3:N1} ms)" -f $i, $Iterations, $resp.StatusCode, $ms)
        }

        if (($i % 10) -eq 0) {
            Write-Host ("   Progress: {0}/{1} (last={2:N1} ms)" -f $i, $Iterations, $ms)
        }
    }
    catch {
        $sw.Stop()
        $fail++
        Write-Warning ("   [{0}/{1}] FAILED: {2}" -f $i, $Iterations, $_.Exception.Message)
    }
}

if ($success -gt 0) {
    $avgMs = $totalMs / $success
} else {
    $avgMs = 0
}

Write-Host ""
Write-Host "=== Summary (Discover) ==="
Write-Host ("Iterations : {0}" -f $Iterations)
Write-Host ("Success    : {0}" -f $success)
Write-Host ("Fail       : {0}" -f $fail)
Write-Host ("Latency ms : min={0:N1}  avg={1:N1}  max={2:N1}" -f $minMs, $avgMs, $maxMs)
Write-Host ""

# 4) /metrics (valinnainen kurkkaus)
Write-Host "4) /metrics (valinnainen kurkkaus)..."
try {
    $metrics = Invoke-WebRequest -Uri "$BaseUrl/metrics" -Method Get -TimeoutSec 5
    Write-Host "   /metrics OK, ensimmäiset rivit:"
    $lines = $metrics.Content -split "`n"
    $maxLines = [Math]::Min($lines.Length - 1, 9)
    for ($j = 0; $j -le $maxLines; $j++) {
        Write-Host ("      {0}" -f $lines[$j])
    }
} catch {
    Write-Warning "   /metrics FAILED: $($_.Exception.Message)"
}

Write-Host ""
Write-Host "=== Smoketest valmis ==="
