Param(
    [string]$BaseUrl  = "http://127.0.0.1:5000",
    [string]$Email    = "villehermaala1981@gmail.com",
    [SecureString]$Password = (Read-Host -Prompt "Enter password" -AsSecureString)
)

Write-Host "=== Admin /api/admin/ping smoketest ==="
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

# 1) Login to get token (plain JSON, no SecureString)
Write-Host "1) Login as $Email to get token..."
$headersAuth = @{}

try {
    $plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($Password))
    $loginBody = @{
        email    = $Email
        password = $plainPassword
    } | ConvertTo-Json

    $login = Invoke-RestMethod -Uri "$BaseUrl/api/auth/login" -Method Post -ContentType "application/json" -Body $loginBody -TimeoutSec 10

    if ($login -and $login.accessToken) {
        $accessToken = $login.accessToken
        $headersAuth = @{ Authorization = "Bearer $accessToken" }
        Write-Host "   Login OK, token acquired."
    } else {
        Write-Warning "   Login response did not contain accessToken."
    }
} catch {
    Write-Warning "   Login FAILED: $($_.Exception.Message)"
}
Write-Host ""

# 2) /api/admin/ping WITHOUT token (should be 401/403)
Write-Host "2) GET /api/admin/ping WITHOUT token (should be 401/403)..."
try {
    $respNoAuth = Invoke-WebRequest -Uri "$BaseUrl/api/admin/ping" -Method Get -TimeoutSec 10 -ErrorAction Stop
    Write-Host ("   /api/admin/ping (no auth) UNEXPECTED -> HTTP {0}" -f [int]$respNoAuth.StatusCode)
} catch {
    $code = $_.Exception.Response.StatusCode.value__ 2>$null
    if ($code) {
        Write-Host ("   /api/admin/ping (no auth) -> HTTP {0} (expected 401 or 403)" -f $code)
        try {
            $bodyStream = $_.Exception.Response.GetResponseStream()
            $reader = New-Object System.IO.StreamReader($bodyStream)
            $text = $reader.ReadToEnd()
            if ($text) {
                Write-Host "   Body:"
                Write-Host "   $text"
            }
        } catch {
            # ignore body read errors
        }
    } else {
        Write-Warning "   /api/admin/ping (no auth) FAILED: $($_.Exception.Message)"
    }
}
Write-Host ""

# 3) /api/admin/ping WITH user token (should be 403 for non-admin)
Write-Host "3) GET /api/admin/ping WITH user token (should be 403 for non-admin)..."

if (-not $headersAuth -or $headersAuth.Count -eq 0) {
    Write-Warning "   Skipping auth test because login/token was not available."
} else {
    try {
        $respUser = Invoke-WebRequest -Uri "$BaseUrl/api/admin/ping" -Method Get -Headers $headersAuth -TimeoutSec 10 -ErrorAction Stop
        Write-Host ("   /api/admin/ping (user token) UNEXPECTED -> HTTP {0}" -f [int]$respUser.StatusCode)
        if ($respUser.Content) {
            Write-Host "   Body:"
            $respUser.Content
        }
    } catch {
        $code = $_.Exception.Response.StatusCode.value__ 2>$null
        if ($code) {
            Write-Host ("   /api/admin/ping (user token) -> HTTP {0} (expected 403)" -f $code)
            try {
                $body = $_.Exception.Response.GetResponseStream()
                $reader = New-Object System.IO.StreamReader($body)
                $text = $reader.ReadToEnd()
                if ($text) {
                    Write-Host "   Body:"
                    Write-Host "   $text"
                }
            } catch {
                # ignore body read errors
            }
        } else {
            Write-Warning "   /api/admin/ping (user token) FAILED: $($_.Exception.Message)"
        }
    }
}

Write-Host ""
Write-Host "=== Admin /api/admin/ping smoketest complete ==="
