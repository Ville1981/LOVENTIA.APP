
```powershell
# File: scripts/rollback-ecs.ps1
# --- REPLACE START: Windows PowerShell rollback helper (ECS + optional CF) ---
param(
  [Parameter(Mandatory=$true)] [string] $Cluster,
  [Parameter(Mandatory=$true)] [string] $Service,
  [Parameter(Mandatory=$false)] [string] $ToRevision = "previous",  # "previous" or explicit "family:rev" or full ARN
  [Parameter(Mandatory=$false)] [string] $DistributionId,
  [Parameter(Mandatory=$false)] [string] $InvalidatePaths = "/*",
  [switch] $DryRun
)

function Require-AwsCli {
  if (-not (Get-Command aws -ErrorAction SilentlyContinue)) {
    Write-Error "AWS CLI not found in PATH. Install AWS CLI v2 and retry."
    exit 1
  }
}
Require-AwsCli

Write-Host "ECS rollback starting..." -ForegroundColor Cyan
Write-Host "Cluster: $Cluster" -ForegroundColor Gray
Write-Host "Service: $Service" -ForegroundColor Gray
Write-Host "Target revision: $ToRevision" -ForegroundColor Gray

# 1) Resolve current task definition
$currentTd = aws ecs describe-services --cluster $Cluster --services $Service --query "services[0].taskDefinition" --output text
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($currentTd)) {
  Write-Error "Failed to read current task definition for service."
  exit 1
}
Write-Host "Current task definition: $currentTd" -ForegroundColor Yellow

# 2) Resolve target task definition
$targetTd = $null
if ($ToRevision -eq "previous") {
  # Get family from currentTd (ARN format: ...:task-definition/<family>:<rev>)
  $family = ($currentTd -split "/")[-1] -split ":" | Select-Object -First 1
  $defs = aws ecs list-task-definitions --family-prefix $family --sort DESC --max-items 5 --output json | ConvertFrom-Json
  if (-not $defs.taskDefinitionArns -or $defs.taskDefinitionArns.Count -lt 2) {
    Write-Error "Could not find a previous task definition for family '$family'."
    exit 1
  }
  $targetTd = $defs.taskDefinitionArns[1]
} else {
  $targetTd = $ToRevision
}
Write-Host "Target task definition: $targetTd" -ForegroundColor Yellow

if ($DryRun) {
  Write-Host "[DryRun] Would update service to $targetTd" -ForegroundColor Magenta
} else {
  # 3) Update service
  aws ecs update-service --cluster $Cluster --service $Service --task-definition $targetTd | Out-Null
  if ($LASTEXITCODE -ne 0) {
    Write-Error "ecs update-service failed."
    exit 1
  }
  Write-Host "Update-service submitted. Waiting for stability..." -ForegroundColor Cyan

  # 4) Wait for stability
  aws ecs wait services-stable --cluster $Cluster --services $Service
  if ($LASTEXITCODE -ne 0) {
    Write-Error "Service did not reach stable state."
    exit 1
  }
  Write-Host "Service is stable on target task definition." -ForegroundColor Green
}

# 5) Optional CloudFront invalidation
if ($DistributionId) {
  if ($DryRun) {
    Write-Host "[DryRun] Would invalidate CloudFront $DistributionId with paths '$InvalidatePaths'" -ForegroundColor Magenta
  } else {
    aws cloudfront create-invalidation --distribution-id $DistributionId --paths $InvalidatePaths | Out-Null
    if ($LASTEXITCODE -ne 0) {
      Write-Warning "CloudFront invalidation failed. Check permissions/ID."
    } else {
      Write-Host "CloudFront invalidation created." -ForegroundColor Green
    }
  }
}

Write-Host "Rollback script finished." -ForegroundColor Cyan
# --- REPLACE END ---



# File: scripts/rollback-ecs.ps1

# --- REPLACE START: ECS rollback + optional CloudFront invalidation (PowerShell) ---
<#
.SYNOPSIS
  Roll back an ECS service to the previous task definition revision and optionally invalidate CloudFront.

.PREREQS
  - AWS CLI v2 asennettuna ja profiili/sessiokrediitit kunnossa (aws sts get-caller-identity).
  - Käyttöoikeudet: ecs:DescribeServices, ecs:UpdateService, ecs:DescribeTaskDefinition,
                    ecs:ListTaskDefinitions, cloudfront:CreateInvalidation (jos käytät invalidointia).

.EXAMPLES
  .\rollback-ecs.ps1 -Region eu-north-1 -Cluster my-staging -Service api -DistributionId E123ABC456 -Paths "/*"
  .\rollback-ecs.ps1 -Region eu-north-1 -Cluster my-prod -Service api -Profile prod
#>

[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)]  [string] $Region,
  [Parameter(Mandatory=$true)]  [string] $Cluster,
  [Parameter(Mandatory=$true)]  [string] $Service,
  [Parameter()]                 [string] $Profile,
  [Parameter()]                 [string] $DistributionId,
  [Parameter()]                 [string[]] $Paths = @("/*"),
  [Parameter()]                 [switch] $WaitForStability = $true
)

function Invoke-Aws {
  param([string]$Args)
  $profileArg = $Profile ? "--profile $Profile" : ""
  $cmd = "aws $Args --region $Region $profileArg"
  Write-Host "› $cmd" -ForegroundColor DarkCyan
  $out = & $env:ComSpec /c $cmd 2>&1
  if ($LASTEXITCODE -ne 0) {
    throw "AWS CLI failed ($LASTEXITCODE): `n$out"
  }
  return $out
}

try {
  Write-Host "Reading current task definition for service $Service in $Cluster..." -ForegroundColor Cyan
  $svc = (Invoke-Aws "ecs describe-services --cluster `"$Cluster`" --services `"$Service`" | jq -r '.services[0]'") | ConvertFrom-Json
  if (-not $svc) { throw "Service not found." }

  $currentTdArn = $svc.taskDefinition
  Write-Host ("Current task definition: " + $currentTdArn) -ForegroundColor Yellow

  # Parse family and revision from ARN: ...:task-definition/<family>:<revision>
  if ($currentTdArn -notmatch "task-definition\/([^:]+):(\d+)$") {
    throw "Unable to parse family:revision from $currentTdArn"
  }
  $family   = $Matches[1]
  $revision = [int]$Matches[2]
  $targetRev = $revision - 1
  if ($targetRev -lt 1) { throw "No previous revision exists (current rev = $revision)." }

  Write-Host "Family: $family, current rev: $revision → target rev: $targetRev" -ForegroundColor Cyan

  # Verify the previous revision exists (ACTIVE)
  $list = Invoke-Aws "ecs list-task-definitions --family-prefix `"$family`" --status ACTIVE --sort DESC | jq -r '.taskDefinitionArns[]'"
  $prevArn = ($list | Select-String -Pattern ":$targetRev$").ToString()
  if (-not $prevArn) {
    # fallback: pick the next ACTIVE lower than current
    $prevArn = ($list | Select-String -Pattern ":([0-9]+)$" | ForEach-Object {
      if ($_ -match ":([0-9]+)$") { [int]$Matches[1] }
    } | Where-Object { $_ -lt $revision } | Sort-Object -Descending | Select-Object -First 1)
    if ($prevArn) {
      $prevArn = ($list | Select-String -Pattern ":$prevArn$").ToString()
    }
  }
  if (-not $prevArn) { throw "Could not find a previous ACTIVE task definition for $family (< $revision)." }

  Write-Host "Rolling back to: $prevArn" -ForegroundColor Yellow
  Invoke-Aws "ecs update-service --cluster `"$Cluster`" --service `"$Service`" --task-definition `"$prevArn`" --force-new-deployment" | Out-Null

  if ($WaitForStability) {
    Write-Host "Waiting for service stability..." -ForegroundColor Cyan
    Invoke-Aws "ecs wait services-stable --cluster `"$Cluster`" --services `"$Service`""
  }

  if ($DistributionId) {
    $pathsJson = ($Paths | ForEach-Object { '"' + $_ + '"' }) -join ","
    $payload = "{ `"Paths`": { `"Quantity`": $($Paths.Count), `"Items`": [ $pathsJson ] }, `"CallerReference`": `"$([Guid]::NewGuid())`" }"
    Write-Host "Creating CloudFront invalidation: $DistributionId for paths: $($Paths -join ', ')" -ForegroundColor Cyan
    $tmp = New-TemporaryFile
    $payload | Out-File -FilePath $tmp -Encoding ascii
    Invoke-Aws "cloudfront create-invalidation --distribution-id `"$DistributionId`" --invalidation-batch file://$tmp" | Out-Null
    Remove-Item $tmp -Force
    Write-Host "CloudFront invalidation requested." -ForegroundColor Green
  }

  Write-Host "Rollback complete." -ForegroundColor Green
}
catch {
  Write-Error $_.Exception.Message
  exit 1
},,,
# --- REPLACE END ---
,,,