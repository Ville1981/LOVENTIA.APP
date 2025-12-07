param(
    [string]$BaseUrl  = "http://localhost:5000/api",
    [string]$Email    = "villehermaala1981@gmail.com",
    [SecureString]$Password = (ConvertTo-SecureString "Paavali1981" -AsPlainText -Force)
)

Write-Host "=== Loventia emailVerified badge smoke test ===" -ForegroundColor Cyan
Write-Host "Backend base URL:" $BaseUrl
Write-Host "Login email:" $Email
Write-Host ""

# 1) Login -> accessToken
Write-Host "--> POST /auth/login" -ForegroundColor Yellow
$loginBody = @{
    email    = $Email
    password = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto([System.Runtime.InteropServices.Marshal]::SecureStringToCoTaskMemUnicode($Password))
}

try {
    $loginResponse = Invoke-RestMethod -Method Post -Uri "$BaseUrl/auth/login" `
        -ContentType "application/json" `
        -Body ($loginBody | ConvertTo-Json)

    $status = if ($loginResponse) { 200 } else { "?" }
    Write-Host "Status: $status"
}
catch {
    Write-Host "Login failed:" $_.Exception.Message -ForegroundColor Red
    throw
}

$accessToken = $loginResponse.accessToken
if (-not $accessToken) {
    Write-Host "No accessToken in login response, cannot continue." -ForegroundColor Red
    throw "Missing accessToken"
}

$authHeaders = @{
    "Authorization" = "Bearer $accessToken"
}

# 2) GET /auth/me
Write-Host ""
Write-Host "--> GET /auth/me" -ForegroundColor Yellow
try {
    $authMe = Invoke-RestMethod -Method Get -Uri "$BaseUrl/auth/me" -Headers $authHeaders
    Write-Host "Status: 200"
}
catch {
    Write-Host "/auth/me failed:" $_.Exception.Message -ForegroundColor Red
    throw
}

# 3) GET /me (alias)
Write-Host ""
Write-Host "--> GET /me" -ForegroundColor Yellow
try {
    $me = Invoke-RestMethod -Method Get -Uri "$BaseUrl/me" -Headers $authHeaders
    Write-Host "Status: 200"
}
catch {
    Write-Host "/me failed:" $_.Exception.Message -ForegroundColor Red
    $me = $null
}

# 4) Summary
Write-Host ""
Write-Host "Summary (/auth/me):" -ForegroundColor Green
$authSummary = [pscustomobject]@{
    email         = $authMe.email
    emailVerified = $authMe.emailVerified
    isPremium     = $authMe.isPremium
    premium       = $authMe.premium
}
$authSummary | Format-List

if ($me) {
    Write-Host ""
    Write-Host "Summary (/me):" -ForegroundColor Green
    $meSummary = [pscustomobject]@{
        email         = $me.email
        emailVerified = $me.emailVerified
        isPremium     = $me.isPremium
        premium       = $me.premium
    }
    $meSummary | Format-List
}

Write-Host ""
Write-Host "Raw keys present in /auth/me:" -ForegroundColor DarkCyan
$authMe | Get-Member -MemberType NoteProperty | Select-Object -ExpandProperty Name

Write-Host ""
Write-Host "=== Done ===" -ForegroundColor Cyan
