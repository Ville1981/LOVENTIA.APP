# PATH: server/tests/dealbreakers-search.ps1
# Simple smoke test for POST /api/search with dealbreakers payload.

$ErrorActionPreference = "Stop"

$baseUrl = "http://localhost:5000/api"

Write-Host "=== Loventia dealbreakers search smoke test ===" -ForegroundColor Cyan
Write-Host "Backend base URL: $baseUrl" -ForegroundColor DarkCyan

# --- 1) Ask credentials (use Premium account first, then you can re-run with a Free account) ---
$email = Read-Host "Login email"
$securePassword = Read-Host "Password" -AsSecureString
$plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
)

# Prepare session so HttpOnly cookies are preserved (if needed)
$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession

# --- 2) Login ---
$loginBody = @{
    email    = $email
    password = $plainPassword
} | ConvertTo-Json -Depth 3

Write-Host "`n--> POST /auth/login" -ForegroundColor Yellow

try {
    # Use Invoke-WebRequest so we can read StatusCode even on success
    $loginRaw = Invoke-WebRequest `
        -Uri ($baseUrl + "/auth/login") `
        -Method Post `
        -Body $loginBody `
        -ContentType "application/json" `
        -WebSession $session

    $loginStatus = [int]$loginRaw.StatusCode
    Write-Host "Status: $loginStatus" -ForegroundColor Green

    $loginResponse = $loginRaw.Content | ConvertFrom-Json
} catch {
    Write-Host "Login failed:" -ForegroundColor Red
    if ($_.Exception.Response -and $_.Exception.Response.ContentLength -gt 0) {
        $errJson = ([System.IO.StreamReader]$_.Exception.Response.GetResponseStream()).ReadToEnd()
        Write-Host $errJson
    } else {
        Write-Host $_.Exception.Message
    }
    return
}

$accessToken = $loginResponse.accessToken
$user        = $loginResponse.user

if ($user) {
    $isPremium = $false
    if ($user.premium -eq $true -or $user.isPremium -eq $true -or $user.entitlements.tier -eq "premium") {
        $isPremium = $true
    }
    Write-Host "Logged in as: $($user.email)" -ForegroundColor Gray
    Write-Host "Premium: $isPremium" -ForegroundColor Gray
} else {
    Write-Host "Login response did not contain a user object." -ForegroundColor Yellow
}

if (-not $accessToken) {
    Write-Host "No accessToken in login response, aborting." -ForegroundColor Red
    return
}

# --- 3) Build search body with dealbreakers ---
$searchBody = @{
    minAge      = 18
    maxAge      = 120
    includeSelf = 1

    # Free-form filters; adjust if you want to test other criteria
    username    = $null
    gender      = $null
    orientation = $null

    dealbreakers = @{
        distanceKm     = 50
        ageMin         = 18
        ageMax         = 120
        mustHavePhoto  = $true
        nonSmokerOnly  = $true
        noDrugs        = $true
        petsOk         = $null      # null means "does not care"
        religion       = @()        # e.g. @("christianity","islam")
        education      = @()        # e.g. @("bachelor","master")
    }
}

$searchJson = $searchBody | ConvertTo-Json -Depth 6

$headers = @{
    "Authorization" = "Bearer $accessToken"
}

# --- 4) Call POST /api/search ---
Write-Host "`n--> POST /search (with dealbreakers)" -ForegroundColor Yellow
Write-Host "Request body (JSON):" -ForegroundColor DarkGray
Write-Host $searchJson

try {
    $searchRaw = Invoke-WebRequest `
        -Uri ($baseUrl + "/search") `
        -Method Post `
        -Headers $headers `
        -Body $searchJson `
        -ContentType "application/json" `
        -WebSession $session

    $searchStatus = [int]$searchRaw.StatusCode
    Write-Host "`nStatus: $searchStatus" -ForegroundColor Green

    $searchResponse = $searchRaw.Content | ConvertFrom-Json

    Write-Host "`nResponse JSON:" -ForegroundColor DarkGray
    $searchResponse | ConvertTo-Json -Depth 8
} catch {
    Write-Host "`nSearch request failed:" -ForegroundColor Red

    if ($_.Exception.Response) {
        $resp = $_.Exception.Response
        Write-Host "HTTP status: $($resp.StatusCode) $([int]$resp.StatusCode)" -ForegroundColor Red
        if ($resp.ContentLength -gt 0) {
            $errJson = ([System.IO.StreamReader]$resp.GetResponseStream()).ReadToEnd()
            Write-Host "Error body:"
            Write-Host $errJson
        }
    } else {
        Write-Host $_.Exception.Message
    }
}

Write-Host "`n=== Done ===" -ForegroundColor Cyan
