# PATH: server/tests/security-csp-enforce-toggle-smoketest.ps1
# Simple smoketest for CSP enforce vs report-only headers.
# - Shows both Content-Security-Policy and Content-Security-Policy-Report-Only
# - Checks /health (public) and /api/me (auth) endpoints
# - Does NOT fail hard if CSP enforce is disabled; this is a diagnostic tool.

param(
  [string]$BaseUrl = "http://127.0.0.1:5000"
)

Write-Host "=== Security CSP ENFORCE toggle smoketest ==="
Write-Host "BaseUrl: $BaseUrl"
Write-Host ""

# Helper: safely show a header or <none>
function Show-Header {
  param(
    [string]$Name,
    $Headers
  )
  $value = $Headers[$Name]
  if ([string]::IsNullOrWhiteSpace($value)) {
    $value = "<none>"
  }
  Write-Host ("   {0}: {1}" -f $Name, $value)
}

# Helper: HEAD request and print CSP headers
function Test-CspForPath {
  param(
    [string]$Path,
    [hashtable]$Headers = @{}
  )

  Write-Host ""
  Write-Host ("CSP headers for {0} ..." -f $Path)

  $uri = "$BaseUrl$Path"

  try {
    $resp = Invoke-WebRequest -Uri $uri -Method Head -Headers $Headers -UseBasicParsing
    Write-Host ("   Status  : HTTP {0}" -f $resp.StatusCode)
    Show-Header -Name "Content-Security-Policy" -Headers $resp.Headers
    Show-Header -Name "Content-Security-Policy-Report-Only" -Headers $resp.Headers
    Show-Header -Name "X-Frame-Options" -Headers $resp.Headers
    Show-Header -Name "Referrer-Policy" -Headers $resp.Headers
    Show-Header -Name "Permissions-Policy" -Headers $resp.Headers
  }
  catch {
    Write-Warning ("   HEAD {0} FAILED: {1}" -f $Path, $_.Exception.Message)
  }
}

# 0) Health-check (GET /health)...
Write-Host "0) Health-check (GET /health)..."
try {
  $health = Invoke-WebRequest -Uri "$BaseUrl/health" -Method Get -UseBasicParsing
  if ($health.StatusCode -eq 200 -and $health.Content -eq "OK") {
    Write-Host "   /health OK -> OK"
  } else {
    Write-Warning ("   /health unexpected status/content: {0} / {1}" -f $health.StatusCode, $health.Content)
  }
}
catch {
  Write-Warning ("   /health FAILED: {0}" -f $_.Exception.Message)
}

# 1) Login to get token (Bearer) – uses interactive password prompt.
Write-Host ""
Write-Host "1) Login as villehermaala1981@gmail.com to get token..."

$accessToken = $null

try {
  $securePassword = Read-Host "Enter password" -AsSecureString

  if (-not $securePassword -or $securePassword.Length -eq 0) {
    Write-Warning "   No password entered, skipping login and /api/me part."
  }
  else {
    $ptr = [System.Runtime.InteropServices.Marshal]::SecureStringToCoTaskMemUnicode($securePassword)
    try {
      $plainPassword = [System.Runtime.InteropServices.Marshal]::PtrToStringUni($ptr)
    }
    finally {
      if ($ptr -ne [IntPtr]::Zero) {
        [System.Runtime.InteropServices.Marshal]::ZeroFreeCoTaskMemUnicode($ptr)
      }
    }

    $loginBody = @{
      email    = "villehermaala1981@gmail.com"
      password = $plainPassword
    } | ConvertTo-Json

    $loginResp = Invoke-RestMethod -Uri "$BaseUrl/api/auth/login" -Method Post -ContentType "application/json" -Body $loginBody
    if ($loginResp.accessToken) {
      $accessToken = $loginResp.accessToken
      Write-Host "   Login OK, token acquired."
    }
    else {
      Write-Warning "   Login response did not contain accessToken."
    }
  }
}
catch {
  Write-Warning ("   Login FAILED: {0}" -f $_.Exception.Message)
}

# 2) CSP headers for /health (no auth)
Write-Host ""
Write-Host "2) Check CSP headers for /health (public)..."
Test-CspForPath -Path "/health"

# 3) CSP headers for /api/me (auth) – only if we have a token
Write-Host ""
Write-Host "3) Check CSP headers for /api/me (auth)..."
if ($accessToken) {
  $authHeaders = @{
    Authorization = "Bearer $accessToken"
  }
  Test-CspForPath -Path "/api/me" -Headers $authHeaders
}
else {
  Write-Warning "   Skipping /api/me CSP test because token was not available."
}

Write-Host ""
Write-Host "=== Security CSP ENFORCE toggle smoketest complete ==="
