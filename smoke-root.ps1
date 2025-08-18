# smoke-root.ps1 — resilient root + /api/auth smoke with summary (fixed bodies)

$ErrorActionPreference = "Stop"

# Config
$Base  = "http://localhost:5000"
$Email = "test$((Get-Date).ToFileTimeUtc())@example.com"
$Pass  = "salasana123"

Write-Host "Base:  $Base"  -ForegroundColor Cyan
Write-Host "Email: $Email" -ForegroundColor Cyan

function Invoke-Step {
  param(
    [string]$Name,
    [scriptblock]$Action
  )
  $result = [ordered]@{ step=$Name; ok=$false; err=$null; data=$null }
  try {
    $data = & $Action
    $result.ok   = $true
    $result.data = $data
    Write-Host ("{0}: PASS" -f $Name) -ForegroundColor Green
  } catch {
    $msg = ($_ | Select-Object -ExpandProperty Exception).Message
    $result.err = $msg
    Write-Host ("{0}: FAIL -> {1}" -f $Name, $msg) -ForegroundColor Red
  }
  return [pscustomobject]$result
}

function Test-AuthFlow {
  param([string]$Prefix)

  Write-Host "`n=== Testing prefix '$Prefix' ===" -ForegroundColor Magenta
  $r = @()

  # 1) REGISTER
  $regBody = @{ email=$Email; password=$Pass; name="Test User" } | ConvertTo-Json
  $r += Invoke-Step "REGISTER $Prefix" { 
    Invoke-RestMethod -Uri ($Base + $Prefix + "/register") -Method Post -ContentType "application/json" -Body $regBody
  }

  # 2) LOGIN
  $ACCESS = $null
  $loginBody = @{ email=$Email; password=$Pass } | ConvertTo-Json
  $r += Invoke-Step "LOGIN $Prefix" { 
    $resp = Invoke-RestMethod -Uri ($Base + $Prefix + "/login") -Method Post -ContentType "application/json" -Body $loginBody
    if ($resp.accessToken) { $script:ACCESS = $resp.accessToken }
    elseif ($resp.token)   { $script:ACCESS = $resp.token }
    elseif ($resp.data -and $resp.data.accessToken) { $script:ACCESS = $resp.data.accessToken }
    if (-not $script:ACCESS) { throw "No accessToken in response" }
    $resp
  }

  $authHeader = @{}
  if ($ACCESS) {
    $authHeader = @{ Authorization = "Bearer $ACCESS" }
    Write-Host ("ACCESS (first 24): {0}..." -f $ACCESS.Substring(0,[Math]::Min(24,$ACCESS.Length))) -ForegroundColor DarkGreen
  }

  # 3) /me
  $r += Invoke-Step "ME $Prefix" {
    if (-not $ACCESS) { throw "Missing access token" }
    Invoke-RestMethod -Uri ($Base + $Prefix + "/me") -Headers $authHeader
  }

  # 4) GET /profile
  $r += Invoke-Step "PROFILE GET $Prefix" {
    if (-not $ACCESS) { throw "Missing access token" }
    Invoke-RestMethod -Uri ($Base + $Prefix + "/profile") -Headers $authHeader
  }

  # 5) PUT /profile
  $r += Invoke-Step "PROFILE PUT $Prefix" {
    if (-not $ACCESS) { throw "Missing access token" }
    $putBody = @{ summary = "Smoke ok via $Prefix" } | ConvertTo-Json
    Invoke-RestMethod -Uri ($Base + $Prefix + "/profile") -Method Put -ContentType "application/json" -Headers $authHeader -Body $putBody
  }

  # 6) REFRESH (tyhjä JSON aina plain '{}')
  $r += Invoke-Step "REFRESH $Prefix" {
    Invoke-RestMethod -Uri ($Base + $Prefix + "/refresh") -Method Post -ContentType "application/json" -Body '{}'
  }

  # 7) LOGOUT (tyhjä JSON aina plain '{}')
  $r += Invoke-Step "LOGOUT $Prefix" {
    Invoke-RestMethod -Uri ($Base + $Prefix + "/logout") -Method Post -ContentType "application/json" -Body '{}'
  }

  return ,$r
}

$all = @()
$all += Test-AuthFlow ""              # legacy root
$all += Test-AuthFlow "/api/auth"     # canonical

# 8) Webhooks (expect 400/401, not 5xx)
$all += Invoke-Step "WEBHOOK STRIPE" {
  (Invoke-WebRequest -UseBasicParsing -Method POST -ContentType "application/json" -Body '{}' -Uri ($Base + "/stripe-webhook")).StatusCode
}
$all += Invoke-Step "WEBHOOK PAYPAL" {
  (Invoke-WebRequest -UseBasicParsing -Method POST -ContentType "application/json" -Body '{}' -Uri ($Base + "/paypal/webhook")).StatusCode
}

# 9) Health pings
$all += Invoke-Step "HEALTH x5" {
  1..5 | ForEach-Object { Invoke-WebRequest -UseBasicParsing ($Base + "/api/health") | Out-Null }
  "OK"
}

# Summary table
Write-Host "`n===== SUMMARY =====" -ForegroundColor Cyan
$all | ForEach-Object {
  $status = if ($_.ok) { "PASS" } else { "FAIL" }
  "{0,-20} {1}" -f $_.step, $status
} | Write-Host
