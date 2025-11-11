# PATH: server/openapi/openapi.ps1
# --- REPLACE START
<#
.SYNOPSIS
  Lint and bundle the OpenAPI spec locally (Spectral + Redocly).

.DESCRIPTION
  - Runs Spectral against your spec with the project ruleset.
  - Bundles the spec into a dereferenced YAML via Redocly CLI.
  - Works when launched from either repo root or /server directory.

.EXAMPLES
  # From repo root:
  pwsh ./server/openapi/openapi.ps1

  # From /server:
  pwsh ./openapi/openapi.ps1

  # Strict mode (fail also on Spectral warnings):
  pwsh ./server/openapi/openapi.ps1 -Strict
#>

[CmdletBinding()]
param(
  # Relative to /server
  [string]$Spec    = "openapi/openapi.yaml",
  [string]$Ruleset = "openapi/.spectral.yaml",
  [string]$Out     = "openapi/openapi.bundle.yaml",

  # If set, Spectral will fail on warnings as well (not just errors)
  [switch]$Strict
)

$ErrorActionPreference = 'Stop'

# --- Resolve paths and move to /server so relative paths are stable ---
# This script lives in /server/openapi; server root is parent of $PSScriptRoot
$ServerRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $ServerRoot

$SpecPath    = Resolve-Path -LiteralPath $Spec
$RulesetPath = Resolve-Path -LiteralPath $Ruleset
$OutPath     = Join-Path $ServerRoot $Out

# --- Preflight checks --------------------------------------------------------
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Error "Node.js is required but was not found on PATH."
}
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  Write-Error "npm is required but was not found on PATH."
}
if (-not (Test-Path $SpecPath)) {
  Write-Error "Spec file not found: $SpecPath"
}
if (-not (Test-Path $RulesetPath)) {
  Write-Error "Spectral ruleset not found: $RulesetPath"
}

# Build Spectral fail-severity argument
$failArg = ""
if ($Strict) { $failArg = "--fail-severity=warn" }

# Helper to run a CLI step with nice headings
function Invoke-Step {
  param(
    [Parameter(Mandatory=$true)][string]$Title,
    [Parameter(Mandatory=$true)][string]$Command
  )
  Write-Host ""
  Write-Host "=== $Title ===" -ForegroundColor Cyan
  Write-Host $Command -ForegroundColor DarkGray
  iex $Command
}

# --- Install CLIs locally if missing (npx will cache anyway) -----------------
# We use npx directly, but printing versions can help diagnostics.
Invoke-Step -Title "Check Spectral version" -Command "npx @stoplight/spectral-cli --version"
Invoke-Step -Title "Check Redocly version"  -Command "npx @redocly/cli --version"

# --- Lint with Spectral ------------------------------------------------------
$lintCmd = @(
  "npx @stoplight/spectral-cli lint",
  "`"$SpecPath`"",
  "--ruleset `"$RulesetPath`"",
  $failArg
) -join " "
Invoke-Step -Title "Spectral Lint" -Command $lintCmd

# --- Bundle with Redocly (dereferenced) -------------------------------------
$bundleCmd = @(
  "npx @redocly/cli bundle",
  "`"$SpecPath`"",
  "--output `"$OutPath`"",
  "--ext yaml",
  "--dereferenced"
) -join " "
Invoke-Step -Title "Redocly Bundle" -Command $bundleCmd

# --- Show resulting file info ------------------------------------------------
if (Test-Path $OutPath) {
  Write-Host ""
  Write-Host "=== Bundle created ===" -ForegroundColor Green
  Get-Item $OutPath | Select-Object Name, Length, LastWriteTime | Format-List
  Write-Host ""
  Write-Host "Tip: You can preview with Redoc locally using 'npx @redocly/cli preview-doc $OutPath'." -ForegroundColor DarkGray
} else {
  Write-Error "Bundle not found at: $OutPath"
}

# Exit success
exit 0
# --- REPLACE END
