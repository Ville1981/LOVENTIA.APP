# smoke-api.ps1 — API + root smoke (tests both /api/auth/* and legacy root)
$ErrorActionPreference = "Stop"

# --- config ---
$Base  = "http://localhost:5000"
$Email = "test$((Get-Date).ToFileTimeUtc())@example.com"
$Pass  = "salasana123"

function Green([string]$t){ Write-Host $t -ForegroundColor Green }
function Yellow([string]$t){ Write-Host $t -ForegroundColor Yellow }
function Cyan([string]$t){ Write-Host $t -ForegroundColor Cyan }
function Red([string]$t){ Write-Host $t -ForegroundColor Red }
function Gray([string]$t){ Write-Host $t -ForegroundColor DarkGray }

Write-Host "Base:  $Base" -ForegroundColor Cyan
Write-Host "Email: $Email" -ForegroundColor Cyan

# Helper to POST JSON and always show server body on errors
function Invoke-JsonPost {
  param([string]$Url, [hashtable]$Body, [hashtable]$Headers)
  $json = $null
  if ($Body -ne $null) { $json = ($Body | ConvertTo-Json -Depth 10) } else { $json = "{}" }
  try {
    return Invoke-RestMethod -Uri $Url -Method Post -ContentType "application/json" -Headers $Headers -Body $json
  } catch {
    $resp = $_.Exception.Response
    $code = $resp.StatusCode.value__
    $txt = ""
    try { $txt = (New-Object IO.StreamReader($resp.GetResponseStream())).ReadToEnd() } catch {}
    throw "POST $Url -> $code $txt"
  }
}

function Invoke-JsonPut {
  param([string]$Url, [hashtable]$Body, [hashtable]$Headers)
  $json = ($Body | ConvertTo-Json -Depth 10)
  try {
    return Invoke-RestMethod -Uri $Url -Method Put -ContentType "application/json" -Headers $Headers -Body $json
  } catch {
    $resp = $_.Exception.Response
    $code = $resp.StatusCode.value__
    $txt = ""
    try { $txt = (New-Object IO.StreamReader($resp.GetResponseStream())).ReadToEnd() } catch {}
    throw "PUT $Url -> $code $txt"
  }
}

function Get-AuthHeader { param([string]$Token) return @{ Authorization = "Bearer $Token" } }

# Test runner for one prefix
function Test-Prefix {
  param([string]$Prefix)

  if ($Prefix -eq "") {
    $registerUrl = "$Base/register"
    $loginUrl    = "$Base/login"
    $meUrl       = "$Base/me"
    $profileUrl  = "$Base/profile"
    $refreshUrl  = "$Base/refresh"
    $logoutUrl   = "$Base/logout"
  } else {
    # assume /api/auth prefix (e.g. "/api/auth")
    $registerUrl = "$Base$Prefix/register"
    $loginUrl    = "$Base$Prefix/login"
    $meUrl       = "$Base/api/users/me"
    $profileUrl  = "$Base/api/users/profile"
    $refreshUrl  = "$Base$Prefix/refresh"
    $logoutUrl   = "$Base$Prefix/logout"
  }

  Cyan "=== Testing prefix '$Prefix' ==="

  # 1) Register
  try {
    Yellow "REGISTER:"
    $reg = Invoke-JsonPost -Url $registerUrl -Body @{ email=$Email; password=$Pass; name="Test User" }
    $reg | ConvertTo-Json
  } catch { Red $_; return $false }

  # 2) Login -> accessToken
  $ACCESS = $null
  try {
    Yellow "LOGIN:"
    $login = Invoke-JsonPost -Url $loginUrl -Body @{ email=$Email; password=$Pass }
    $login | ConvertTo-Json
    if ($login.PSObject.Properties.Name -contains 'accessToken') { $ACCESS = $login.accessToken }
    elseif ($login.PSObject.Properties.Name -contains 'token') { $ACCESS = $login.token }
    elseif ($login.data -and $login.data.accessToken) { $ACCESS = $login.data.accessToken }
    if ([string]::IsNullOrWhiteSpace($ACCESS)) { throw "No access token in login response" }
    Green ("ACCESS (first 24): {0}..." -f $ACCESS.Substring(0,[Math]::Min(24,$ACCESS.Length)))
  } catch { Red $_; return $false }

  # 3) Protected: /me, /profile
  try {
    $hdr = Get-AuthHeader -Token $ACCESS
    Green "ME:"
    $me = Invoke-RestMethod -Uri $meUrl -Headers $hdr
    $me | ConvertTo-Json

    Green "PROFILE GET:"
    $prof = Invoke-RestMethod -Uri $profileUrl -Headers $hdr
    $prof | ConvertTo-Json

    Green "PROFILE PUT:"
    $profPut = Invoke-JsonPut -Url $profileUrl -Headers $hdr -Body @{ summary = "Smoke ok" }
    $profPut | ConvertTo-Json
  } catch { Red $_; return $false }

  # 4) Refresh (STRICT JSON: send "{}")
  try {
    Cyan "REFRESH:"
    $ref = Invoke-JsonPost -Url $refreshUrl -Body @{}
    $ref | ConvertTo-Json
  } catch { Red $_; return $false }

  # 5) Logout (STRICT JSON: send "{}")
  try {
    Cyan "LOGOUT:"
    $logout = Invoke-JsonPost -Url $logoutUrl -Body @{}
    $logout | ConvertTo-Json
  } catch { Red $_; return $false }

  return $true
}

# --- Run tests: API prefix first, then legacy root as fallback ---
$okApi  = Test-Prefix "/api/auth"
if (-not $okApi) {
  Yellow "API prefix failed; trying legacy root..."
  $okRoot = Test-Prefix ""
} else {
  $okRoot = $true
}

# 6) Webhooks (expect 400/401; not 5xx) — use Invoke-WebRequest to see status
# 6) Webhooks (expect 400/401; not 5xx) — use Invoke-WebRequest to see status
function Invoke-PostCode([string]$Url) {
  try { (Invoke-WebRequest -UseBasicParsing -Method POST -Uri $Url).StatusCode }
  catch { $_.Exception.Response.StatusCode.value__ }
}
$stripe = Invoke-PostCode "$Base/stripe-webhook"
$paypal = Invoke-PostCode "$Base/paypal/webhook"
Gray ("WEBHOOKS stripe={0} paypal={1}" -f $stripe,$paypal)


# 7) Health burst
1..5 | ForEach-Object { Invoke-WebRequest -UseBasicParsing "$Base/api/health" | Out-Null }
Green "HEALTH PINGS: OK"

# Summary
if ($okApi -and $okRoot) { Green  "SUMMARY: PASS (API + root)" }
elseif ($okApi)          { Yellow "SUMMARY: PARTIAL (API ok, root failed)" }
elseif ($okRoot)         { Yellow "SUMMARY: PARTIAL (root ok, API failed)" }
else                     { Red    "SUMMARY: FAIL (both prefixes failed)" }
