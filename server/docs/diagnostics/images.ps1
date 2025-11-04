<#
.SYNOPSIS
  Image routes diagnostics:
   - Upload an image
   - Delete by slot
   - Delete by path
   - Reorder
   - Set avatar

.PARAMETER BaseUrl
  Backend base URL (default: http://localhost:5000)

.PARAMETER Token
  Bearer JWT (required)

.PARAMETER UserId
  Target user id (required)

.PARAMETER FilePath
  Path to an image file to upload (required for upload)

.EXAMPLE
  .\images.ps1 -BaseUrl "http://localhost:5000" -Token "<JWT>" -UserId "6655aa..." -FilePath "C:\Temp\pic.jpg"
#>

param(
  [string]$BaseUrl = "http://localhost:5000",
  [Parameter(Mandatory = $true)][string]$Token,
  [Parameter(Mandatory = $true)][string]$UserId,
  [string]$FilePath
)

$Headers = @{ Authorization = "Bearer $Token" }

Write-Host "== Loventia Image Routes Diagnostics ==" -ForegroundColor Cyan
Write-Host "BaseUrl: $BaseUrl" -ForegroundColor DarkCyan

function Show-User {
  param($u, $h)
  try {
    $me = Invoke-RestMethod -Method GET -Uri "$u/api/users/$UserId" -Headers $h
    Write-Host "[INFO] user snapshot:" -ForegroundColor DarkCyan
    @{
      id = $me.id
      avatar = $me.avatar
      photos = $me.photos
      extraImages = $me.extraImages
    } | ConvertTo-Json -Depth 6
  } catch {
    Write-Host "[INFO] GET /api/users/{id} is not available; skipping snapshot." -ForegroundColor DarkYellow
  }
}

# 1) Upload
if ($FilePath) {
  if (-not (Test-Path $FilePath)) {
    Write-Host "[ERR] File not found: $FilePath" -ForegroundColor Red
    exit 1
  }
  try {
    $form = @{ "photos[]" = Get-Item -LiteralPath $FilePath }
    $uploadUrl = "$BaseUrl/api/users/$UserId/upload-photos"
    $upload = Invoke-RestMethod -Method POST -Uri $uploadUrl -Headers $Headers -Form $form
    Write-Host "[OK] upload-photos" -ForegroundColor Green
    $upload | ConvertTo-Json -Depth 6
  } catch {
    Write-Host "[ERR] upload-photos failed: $($_.Exception.Message)" -ForegroundColor Red
  }
}

Show-User -u $BaseUrl -h $Headers

# 2) Delete by slot
try {
  $slot = 0
  $delSlotUrl = "$BaseUrl/api/users/$UserId/photos/$slot"
  $delSlot = Invoke-RestMethod -Method DELETE -Uri $delSlotUrl -Headers $Headers
  Write-Host "[OK] delete slot $slot" -ForegroundColor Green
  $delSlot | ConvertTo-Json -Depth 6
} catch {
  Write-Host "[WARN] delete slot failed (may be no photo at slot): $($_.Exception.Message)" -ForegroundColor Yellow
}

# 3) Delete by path
try {
  $pathToDelete = "/uploads/does-not-exist.png"
  $delPathUrl = "$BaseUrl/api/users/$UserId/photos?path=$([uri]::EscapeDataString($pathToDelete))"
  $delPath = Invoke-RestMethod -Method DELETE -Uri $delPathUrl -Headers $Headers
  Write-Host "[OK] delete by path" -ForegroundColor Green
  $delPath | ConvertTo-Json -Depth 6
} catch {
  Write-Host "[INFO] delete by path may 404 if path missing: $($_.Exception.Message)" -ForegroundColor DarkYellow
}

# 4) Reorder
try {
  $order = @{ order = @("/uploads/a.jpg", "/uploads/b.jpg") } | ConvertTo-Json
  $reorderUrl = "$BaseUrl/api/users/$UserId/photos/reorder"
  $reorder = Invoke-RestMethod -Method PUT -Uri $reorderUrl -Headers $Headers -ContentType "application/json" -Body $order
  Write-Host "[OK] reorder" -ForegroundColor Green
  $reorder | ConvertTo-Json -Depth 6
} catch {
  Write-Host "[INFO] reorder may fail if given paths do not exist: $($_.Exception.Message)" -ForegroundColor DarkYellow
}

# 5) Set avatar
try {
  $body = @{ index = 0 } | ConvertTo-Json
  $avatarUrl = "$BaseUrl/api/users/$UserId/set-avatar"
  $avatar = Invoke-RestMethod -Method POST -Uri $avatarUrl -Headers $Headers -ContentType "application/json" -Body $body
  Write-Host "[OK] set-avatar" -ForegroundColor Green
  $avatar | ConvertTo-Json -Depth 6
} catch {
  Write-Host "[INFO] set-avatar may fail when no images exist: $($_.Exception.Message)" -ForegroundColor DarkYellow
}

Write-Host "Done." -ForegroundColor Cyan
