<#
.SYNOPSIS
  Minimal Stripe billing diagnostics.
  Works with STRIPE_MOCK_MODE=1 to bypass real Stripe calls for dev/E2E.

.PARAMETER BaseUrl
  Backend base URL (default: http://localhost:5000)

.PARAMETER Email
  (Optional) Email for login to fetch token; if omitted, you must pass -Token

.PARAMETER Password
  (Optional) SecureString password for login to fetch token

.PARAMETER Token
  (Optional) Use an existing JWT instead of logging in

.PARAMETER StripeMock
  Set 1 to request mock flows (default 1)

.EXAMPLE
  # Use secure password: Read-Host -AsSecureString
  $sec = Read-Host "Password" -AsSecureString
  .\billing.ps1 -BaseUrl "http://localhost:5000" -Email "test@example.com" -Password $sec -StripeMock 1
#>

param(
  [string]$BaseUrl = "http://localhost:5000",
  [string]$Email,
  [SecureString]$Password,
  [string]$Token,
  [int]$StripeMock = 1
)

# --- REPLACE START: helpers (avoid $pwd automatic var; secure handling) ---
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
# --- REPLACE END ---

Write-Host "== Loventia Billing Diagnostics ==" -ForegroundColor Cyan
Write-Host "BaseUrl: $BaseUrl" -ForegroundColor DarkCyan
Write-Host "StripeMock: $StripeMock" -ForegroundColor DarkCyan

# Get token if not provided
if (-not $Token) {
  if (-not $Email -or -not $Password) {
    Write-Host "[ERR] Provide -Token OR both -Email and -Password (SecureString)." -ForegroundColor Red
    exit 1
  }
  try {
    $login = Invoke-LoginPrimary -Url $BaseUrl -Email $Email -Password $Password
    $Token = Get-AccessToken -Response $login
    if (-not $Token) { throw "Token not found in login response." }
    Write-Host "[OK] Login success" -ForegroundColor Green
  } catch {
    Write-Host "[ERR] Login failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
  }
}

$headers = @{ Authorization = "Bearer $Token" }

# Toggle/verify mock mode if your server supports it via header or query
$qs = if ($StripeMock -eq 1) { "?mock=1" } else { "" }

# Create or fetch a checkout session (endpoint name may differ in your server)
$checkoutUrl = "$BaseUrl/api/billing/create-checkout-session$qs"
try {
  $checkout = Invoke-RestMethod -Method POST -Uri $checkoutUrl -Headers $headers -ContentType "application/json" -Body "{}"
  Write-Host "[OK] create-checkout-session" -ForegroundColor Green
  $checkout | ConvertTo-Json -Depth 6
} catch {
  Write-Host "[WARN] create-checkout-session failed: $($_.Exception.Message)" -ForegroundColor Yellow
}

# Create portal session
$portalUrl = "$BaseUrl/api/billing/create-portal-session$qs"
try {
  $portal = Invoke-RestMethod -Method POST -Uri $portalUrl -Headers $headers -ContentType "application/json" -Body "{}"
  Write-Host "[OK] create-portal-session" -ForegroundColor Green
  $portal | ConvertTo-Json -Depth 6
} catch {
  Write-Host "[WARN] create-portal-session failed: $($_.Exception.Message)" -ForegroundColor Yellow
}

# Sync billing (custom debug endpoint if available)
$syncUrl = "$BaseUrl/api/billing/sync$qs"
try {
  $sync = Invoke-RestMethod -Method POST -Uri $syncUrl -Headers $headers -ContentType "application/json" -Body "{}"
  Write-Host "[OK] billing sync" -ForegroundColor Green
  $sync | ConvertTo-Json -Depth 6
} catch {
  Write-Host "[INFO] billing sync endpoint not available or failed: $($_.Exception.Message)" -ForegroundColor DarkYellow
}

Write-Host "Done." -ForegroundColor Cyan
