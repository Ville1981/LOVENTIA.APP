<#
.SYNOPSIS
  Auth flow smoke tests:
  - Login via /api/auth/login (primary)
  - Fallback /api/users/login (legacy)
  - Validate token against /api/auth/me, /api/me, /api/users/me

.PARAMETER BaseUrl
  Backend base URL (default: http://localhost:5000)

.PARAMETER Email
  Test user email

.PARAMETER Password
  SecureString password (use Read-Host -AsSecureString)

.EXAMPLE
  $sec = Read-Host "Password" -AsSecureString
  .\auth.ps1 -BaseUrl "http://localhost:5000" -Email "testuser1@example.com" -Password $sec
#>

param(
  [string]$BaseUrl = "http://localhost:5000",
  [Parameter(Mandatory = $true)][string]$Email,
  [Parameter(Mandatory = $true)][SecureString]$Password
)

# --- REPLACE START: helpers (approved verbs, no '??', secure password handling) ---
function Get-PlainTextFromSecureString {
  param([Parameter(Mandatory=$true)][SecureString]$Secure)
  try {
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Secure)
    [Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
  } finally {
    if ($bstr) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
  }
}

function Get-AccessToken {
  param([Parameter(Mandatory=$true)]$Response)
  if ($null -ne $Response) {
    if ($Response.PSObject.Properties['token'])       { return $Response.token }
    if ($Response.PSObject.Properties['accessToken']) { return $Response.accessToken }
    if ($Response.PSObject.Properties['data'] -and $Response.data.PSObject.Properties['token']) { return $Response.data.token }
  }
  return $null
}

function Invoke-LoginPrimary {
  param([string]$Url, [string]$Email, [SecureString]$Password)
  # PSScriptAnalyzer: avoid $pwd (automatic variable). Use $plainPassword.
  $plainPassword = Get-PlainTextFromSecureString -Secure $Password
  try {
    $payload = @{ email = $Email; password = $plainPassword } | ConvertTo-Json
    Invoke-RestMethod -Method POST -Uri "$Url/api/auth/login" -ContentType "application/json" -Body $payload
  } finally {
    if ($plainPassword) { [System.Array]::Clear([char[]]$plainPassword, 0, $plainPassword.Length) }
  }
}

function Invoke-LoginLegacy {
  param([string]$Url, [string]$Email, [SecureString]$Password)
  # PSScriptAnalyzer: avoid $pwd (automatic variable). Use $plainPassword.
  $plainPassword = Get-PlainTextFromSecureString -Secure $Password
  try {
    $payload = @{ email = $Email; password = $plainPassword } | ConvertTo-Json
    Invoke-RestMethod -Method POST -Uri "$Url/api/users/login" -ContentType "application/json" -Body $payload
  } finally {
    if ($plainPassword) { [System.Array]::Clear([char[]]$plainPassword, 0, $plainPassword.Length) }
  }
}
# --- REPLACE END ---

Write-Host "== Loventia Auth Diagnostics ==" -ForegroundColor Cyan
Write-Host "BaseUrl: $BaseUrl" -ForegroundColor DarkCyan

$token = $null
try {
  $r = Invoke-LoginPrimary -Url $BaseUrl -Email $Email -Password $Password
  $token = Get-AccessToken -Response $r
  if (-not $token) { throw "Token not found in /api/auth/login response." }
  Write-Host "[OK] /api/auth/login" -ForegroundColor Green
} catch {
  Write-Host "[WARN] /api/auth/login failed, trying legacy..." -ForegroundColor Yellow
  try {
    $r = Invoke-LoginLegacy -Url $BaseUrl -Email $Email -Password $Password
    $token = Get-AccessToken -Response $r
    if (-not $token) { throw "Token not found in /api/users/login response." }
    Write-Host "[OK] /api/users/login" -ForegroundColor Green
  } catch {
    Write-Host "[ERR] login failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
  }
}

$headers = @{ Authorization = "Bearer $token" }

$paths = @(
  "/api/auth/me",
  "/api/me",
  "/api/users/me"
)

foreach ($p in $paths) {
  $u = "$BaseUrl$p"
  try {
    $res = Invoke-RestMethod -Method GET -Uri $u -Headers $headers
    Write-Host "[OK] GET $p" -ForegroundColor Green
    # Show only the important subset
    $obj = @{
      id = $res.id
      email = $res.email
      premium = $res.premium
      noAds = $res.noAds
      roles = $res.roles
    }
    $obj | ConvertTo-Json -Depth 5
  } catch {
    Write-Host "[ERR] GET $p failed: $($_.Exception.Message)" -ForegroundColor Red
  }
}

Write-Host "Done." -ForegroundColor Cyan
