param(
  [Parameter(Mandatory)][ValidateSet('stage','prod')]$Env,
  [Parameter(Mandatory)][string]$Ip # esim. 203.0.113.55 tai 203.0.113.55/32
)

$tfvars = if($Env -eq 'stage') {'infra/terraform/stage.tfvars'} else {'infra/terraform/prod.tfvars'}
$cidr = if($Ip -match '/\d+$') { $Ip } else { "$Ip/32" }

Write-Host "Adding $cidr to $tfvars ..." -ForegroundColor Cyan
$content = Get-Content $tfvars -Raw
if ($content -notmatch 'allow_cidrs') {
  $content += "`r`nallow_cidrs = [`r`n  `"$cidr`"`r`n]`r`n"
} else {
  $content = ($content -replace 'allow_cidrs\s*=\s*\[(.*?)\]', { param($m)
    $list = $m.Groups[1].Value
    if ($list -notmatch [regex]::Escape($cidr)) {
      $list = $list.Trim()
      if ($list -and $list[-1] -ne ',') { $list += ',' }
      $list += "`r`n  `"$cidr`""
    }
    "allow_cidrs = [`r`n$list`r`n]"
  })
}
Set-Content $tfvars $content
Push-Location infra/terraform
terraform init
$vf = ($Env + '.tfvars')
terraform apply -auto-approve -var-file=$vf
Pop-Location
Write-Host "Done." -ForegroundColor Green
