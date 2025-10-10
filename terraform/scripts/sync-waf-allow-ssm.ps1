param(
  [Parameter(Mandatory)][ValidateSet('stage','prod')]$Env,
  [string]$Region = 'eu-north-1',
  [string]$ParamName # jos tyhjä → /loventia/<env>/WAF_ALLOW_CIDRS
)

$ErrorActionPreference = 'Stop'

# tfvars-polku
$Tfvars = if ($Env -eq 'stage') { 'infra/terraform/stage.tfvars' } else { 'infra/terraform/prod.tfvars' }
if (-not (Test-Path $Tfvars)) { throw "tfvars not found: $Tfvars" }

# Lue tiedosto raakana
$content = Get-Content $Tfvars -Raw

# Poimi allow_cidrs-blocki: allow_cidrs = [ "...", "..." ]
$allowBlock = [regex]::Match($content, 'allow_cidrs\s*=\s*\[(.*?)\]', 'Singleline')
if (-not $allowBlock.Success) {
  Write-Warning "No allow_cidrs found in $Tfvars. Will write empty value."
  $cidrs = @()
} else {
  # Poimi kaikki lainausmerkeissä olevat arvot blokin sisällä
  $inner = $allowBlock.Groups[1].Value
  $cidrs = [regex]::Matches($inner, '"([^"]+)"') | ForEach-Object { $_.Groups[1].Value.Trim() } | Where-Object { $_ -ne '' } | Select-Object -Unique
}

# Rakenna SSM-parametrin nimi
if ([string]::IsNullOrWhiteSpace($ParamName)) {
  $ParamName = "/loventia/$Env/WAF_ALLOW_CIDRS"
}

# Muodosta comma-separated arvo
$value = ($cidrs -join ',')

Write-Host "Syncing allow_cidrs ($Env) -> SSM" -ForegroundColor Cyan
Write-Host "tfvars: $Tfvars"
Write-Host "cidrs:  $value"
Write-Host "param:  $ParamName  (region: $Region)"

# Kirjoita SSM:een (String, ei SecureString)
$putArgs = @(
  'ssm','put-parameter',
  '--name', $ParamName,
  '--type','String',
  '--value', $value,
  '--overwrite',
  '--region', $Region
)
$proc = Start-Process 'aws' -ArgumentList $putArgs -NoNewWindow -PassThru -Wait
if ($proc.ExitCode -ne 0) { throw "aws ssm put-parameter failed (exit $($proc.ExitCode))" }

Write-Host "Done." -ForegroundColor Green
