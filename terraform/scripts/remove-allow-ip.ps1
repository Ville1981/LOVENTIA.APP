param(
  [Parameter(Mandatory)][ValidateSet('stage','prod')]$Env,
  [Parameter(Mandatory)][string]$IpOrCidr
)

$tfvars = if($Env -eq 'stage') {'infra/terraform/stage.tfvars'} else {'infra/terraform/prod.tfvars'}
$cidr = if($IpOrCidr -match '/\d+$') { $IpOrCidr } else { "$IpOrCidr/32" }

Write-Host "Removing $cidr from $tfvars ..." -ForegroundColor Cyan
$content = Get-Content $tfvars -Raw
if ($content -match 'allow_cidrs') {
  $content = ($content -replace 'allow_cidrs\s*=\s*\[(.*?)\]', { param($m)
    $list = $m.Groups[1].Value
    $pattern = "(`r?`n)?\s*`"$([regex]::Escape($cidr))`"\s*,?"
    $list = ($list -replace $pattern, '')
    "allow_cidrs = [`r`n$($list.Trim())`r`n]"
  })
  $content = ($content -replace 'allow_cidrs\s*=\s*\[\s*\]','')
  Set-Content $tfvars $content
  Push-Location infra/terraform
  terraform init | Out-Null
  $vf = ($Env + '.tfvars')
  terraform apply -auto-approve -var-file=$vf
  Pop-Location
  Write-Host "Done." -ForegroundColor Green
} else {
  Write-Warning "allow_cidrs not present in $tfvars"
}
