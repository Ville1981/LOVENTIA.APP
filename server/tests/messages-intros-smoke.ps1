# PATH: server/tests/messages-intros-smoke.ps1
# Simple smoke test for Messages + intros-gate endpoints.
# - Login
# - GET /messages/overview
# - Try GET /messages/can-send-intro/:userId if we can resolve a target userId

$ErrorActionPreference = "Stop"
$baseUrl = "http://localhost:5000/api"

Write-Host "=== Loventia messages / intros smoke test ===" -ForegroundColor Cyan
Write-Host "Backend base URL: $baseUrl" -ForegroundColor DarkCyan

# 1) Login (use Premium account if possible)
$email = Read-Host "Login email"
$securePassword = Read-Host "Password" -AsSecureString
$plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
)

$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession

$loginBody = @{
    email    = $email
    password = $plainPassword
} | ConvertTo-Json -Depth 3

Write-Host "`n--> POST /auth/login" -ForegroundColor Yellow

try {
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
if (-not $accessToken) {
    Write-Host "No accessToken in login response, aborting." -ForegroundColor Red
    return
}

$headers = @{
    "Authorization" = "Bearer $accessToken"
}

# 2) GET /messages/overview
Write-Host "`n--> GET /messages/overview" -ForegroundColor Yellow
try {
    $ovRaw = Invoke-WebRequest `
        -Uri ($baseUrl + "/messages/overview") `
        -Headers $headers `
        -Method Get `
        -WebSession $session

    $ovStatus = [int]$ovRaw.StatusCode
    Write-Host "Status: $ovStatus" -ForegroundColor Green
    $overview = $ovRaw.Content | ConvertFrom-Json
} catch {
    Write-Host "Overview failed:" -ForegroundColor Red
    if ($_.Exception.Response -and $_.Exception.Response.ContentLength -gt 0) {
        $errJson = ([System.IO.StreamReader]$_.Exception.Response.GetResponseStream()).ReadToEnd()
        Write-Host $errJson
    } else {
        Write-Host $_.Exception.Message
    }
    return
}

# Show a small preview so we see thread shape
Write-Host "`nOverview JSON (truncated):" -ForegroundColor DarkGray
try {
    $overview | ConvertTo-Json -Depth 5 | Out-String | Write-Host
} catch {
    Write-Host "(Could not serialize overview as JSON)" -ForegroundColor DarkGray
}

# 3) Resolve threads from overview
# In your case overview is directly an array of threads, not { threads: [...] }.
if (
    $overview -is [System.Collections.IEnumerable] -and
    -not ($overview.PSObject.Properties.Name -contains "threads")
) {
    $threads = $overview
} else {
    $threads = $overview.threads
}

if (-not $threads -or $threads.Count -eq 0) {
    Write-Host "`nNo threads in overview, cannot test intros-gate on a specific user." -ForegroundColor Yellow
    Write-Host "Backend is OK up to overview." -ForegroundColor Yellow
    Write-Host "`n=== Done ===" -ForegroundColor Cyan
    return
}

# 4) Pick a target userId, skipping obvious dummy / all-zero IDs
function Test-DummyUserId {
    param(
        [string]$Id
    )
    if (-not $Id) { return $true }
    $trimmed = $Id.Trim()
    if ($trimmed -eq "") { return $true }
    if ($trimmed -match '^[0]+$') { return $true }        # all zeros
    return $false
}

$candidateProps = @(
    "userId",
    "partnerId",
    "otherUserId",
    "targetUserId",
    "id",
    "_id"
)

$targetId = $null
$chosenThread = $null

foreach ($thread in $threads) {
    foreach ($p in $candidateProps) {
        if ($thread.PSObject.Properties.Name -contains $p) {
            $val = [string]$thread.$p
            if ($val -and -not (Test-DummyUserId -Id $val)) {
                $targetId = $val
                $chosenThread = $thread
                break
            }
        }
    }
    if ($targetId) { break }
}

Write-Host "`nUsing target userId: $targetId" -ForegroundColor Gray

if (-not $targetId) {
    Write-Host "Could not resolve a non-empty, non-dummy target userId from threads." -ForegroundColor Yellow
    Write-Host "Check the overview structure above and adjust candidate property names if needed." -ForegroundColor Yellow
    Write-Host "`n=== Done ===" -ForegroundColor Cyan
    return
}

Write-Host "Chosen thread snippet: $($chosenThread.snippet)" -ForegroundColor DarkGray

# 5) GET /messages/can-send-intro/:userId
Write-Host "`n--> GET /messages/can-send-intro/$targetId" -ForegroundColor Yellow
try {
    $canRaw = Invoke-WebRequest `
        -Uri ($baseUrl + "/messages/can-send-intro/$targetId") `
        -Headers $headers `
        -Method Get `
        -WebSession $session

    $canStatus = [int]$canRaw.StatusCode
    Write-Host "Status: $canStatus" -ForegroundColor Green
    $canResp = $canRaw.Content | ConvertFrom-Json

    Write-Host "`nResponse JSON:" -ForegroundColor DarkGray
    $canResp | ConvertTo-Json -Depth 5 | Out-String | Write-Host
} catch {
    Write-Host "can-send-intro failed:" -ForegroundColor Red
    if ($_.Exception.Response -and $_.Exception.Response.ContentLength -gt 0) {
        $errJson = ([System.IO.StreamReader]$_.Exception.Response.GetResponseStream()).ReadToEnd()
        Write-Host "Error body:"
        Write-Host $errJson
    } else {
        Write-Host $_.Exception.Message
    }
}

Write-Host "`n=== Done ===" -ForegroundColor Cyan


