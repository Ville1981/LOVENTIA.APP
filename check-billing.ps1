param(
  [string]$Token,
  [string]$Email,
  [string]$Password,
  [string]$ServerUrl = "http://localhost:5000"
)

function Write-Section($t){ Write-Host "`n==== $t ====" -ForegroundColor Cyan }

Write-Section "Stripe ENV (current PowerShell session)"
node -e "console.log({
  STRIPE_SECRET_KEY:(process.env.STRIPE_SECRET_KEY||'').slice(0,12),
  STRIPE_PRICE_ID:process.env.STRIPE_PRICE_ID||'',
  STRIPE_WEBHOOK_SECRET:(process.env.STRIPE_WEBHOOK_SECRET||'').slice(0,12)
})" 2>$null

Write-Section "Node server process"
try {
  $procs = Get-Process node -ErrorAction Stop
  Write-Host ("node running: " + ($procs.Id -join ", "))
} catch {
  Write-Host "node is NOT running. Start with: npm --prefix .\server run server" -ForegroundColor Yellow
}

function Get-Jwt {
  param([string]$T,[string]$E,[string]$P)
  if ($T) { return $T }
  if ($E -and $P) {
    try {
      $body = @{ email=$E; password=$P } | ConvertTo-Json
      $resp = Invoke-RestMethod -Method POST -Uri "$ServerUrl/api/auth/login" -ContentType "application/json" -Body $body
      # Adjust this if your backend uses different field name (e.g. accessToken)
      $tok = $resp.token
      if (-not $tok) { throw "Login response did not include 'token' field." }
      Write-Host "[AUTH] Got fresh JWT via /auth/login"
      return $tok
    } catch {
      Write-Host "[AUTH] Login failed: $($_.Exception.Message)" -ForegroundColor Yellow
      throw
    }
  }
  throw "No token provided. Pass -Token `<JWT>` or -Email/-Password."
}

try {
  $jwt = Get-Jwt -T $Token -E $Email -P $Password
} catch {
  Write-Host $_ -ForegroundColor Red
  exit 1
}
$H = @{ Authorization = "Bearer $jwt" }

Write-Section "POST /api/billing/sync"
try {
  $r = Invoke-RestMethod -Method POST -Uri "$ServerUrl/api/billing/sync" -Headers $H
  $r | Format-List | Out-Host
} catch {
  Write-Host "Sync failed: $($_.Exception.Message)" -ForegroundColor Yellow
  try { $_.ErrorDetails.Message | Out-Host } catch {}
}

Write-Section "POST /api/billing/create-portal-session"
try {
  $r = Invoke-RestMethod -Method POST -Uri "$ServerUrl/api/billing/create-portal-session" -Headers $H
  $r | Format-Table -Auto | Out-Host
} catch {
  Write-Host "Portal failed: $($_.Exception.Message)" -ForegroundColor Yellow
  try { $_.ErrorDetails.Message | Out-Host } catch {}
}

Write-Host "`n== Health-check done ==" -ForegroundColor Green
