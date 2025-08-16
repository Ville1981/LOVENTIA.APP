# --- REPLACE START: One-click script to build & run the Docker stack (Windows PowerShell) ---

<#
.SYNOPSIS
  Build and run the Loventia Docker stack reliably on Windows.

.DESCRIPTION
  - Ensures Docker Desktop service is running and the WSL2 engine is ready.
  - Switches docker context to 'desktop-linux'.
  - Runs: docker compose down -v, build (optional --no-cache), up -d, ps
  - Optionally tails server logs.

.PARAMETER ProjectRoot
  Path to the project root containing docker-compose.yml (default: C:\Loventia.app-new)

.PARAMETER NoCache
  If set, builds images with --no-cache.

.PARAMETER Logs
  If set, tails the server container logs after start.

.EXAMPLE
  .\run-docker.ps1

.EXAMPLE
  .\run-docker.ps1 -NoCache -Logs

.NOTES
  Comments are in English. Adjust $DockerDesktopExe if Docker is installed elsewhere.
#>

param(
  [string]$ProjectRoot = "C:\Loventia.app-new",
  [switch]$NoCache,
  [switch]$Logs
)

$ErrorActionPreference = 'Stop'

# --- Configurable paths and timeouts ---
$DockerDesktopExe = "C:\Program Files\Docker\Docker\Docker Desktop.exe"
$DockerServiceName = "com.docker.service"
$ContextName = "desktop-linux"
$ComposeFile = Join-Path $ProjectRoot "docker-compose.yml"
$WaitDockerTimeoutSec = 180
$WaitSleepMs = 1500

function Write-Info($msg)  { Write-Host "[INFO]  $msg" -ForegroundColor Cyan }
function Write-Warn($msg)  { Write-Host "[WARN]  $msg" -ForegroundColor Yellow }
function Write-ErrorLine($msg) { Write-Host "[ERROR] $msg" -ForegroundColor Red }
function Write-Ok($msg)    { Write-Host "[OK]    $msg" -ForegroundColor Green }

function Assert-ComposeFile {
  if (-not (Test-Path -LiteralPath $ComposeFile)) {
    Write-ErrorLine "docker-compose.yml not found at: $ComposeFile"
    throw "Missing compose file"
  }
}

function Ensure-DockerService {
  try {
    $svc = Get-Service -Name $DockerServiceName -ErrorAction Stop
    if ($svc.Status -ne 'Running') {
      Write-Info "Starting Docker Windows service: $DockerServiceName"
      Start-Service -Name $DockerServiceName
    } else {
      Write-Info "Docker Windows service already running."
    }
  } catch {
    Write-Warn "Docker Windows service '$DockerServiceName' not found. Continuing (Desktop may manage it automatically)."
  }
}

function Start-DockerDesktop {
  if (-not (Test-Path -LiteralPath $DockerDesktopExe)) {
    Write-Warn "Docker Desktop executable not found at: $DockerDesktopExe"
    return
  }
  Write-Info "Starting Docker Desktop GUI..."
  Start-Process -FilePath $DockerDesktopExe | Out-Null
}

function Wait-DockerDaemon {
  Write-Info "Waiting for Docker daemon (timeout ${WaitDockerTimeoutSec}s)..."
  $sw = [Diagnostics.Stopwatch]::StartNew()
  while ($sw.Elapsed.TotalSeconds -lt $WaitDockerTimeoutSec) {
    try {
      $ver = docker version --format '{{.Server.Version}}' 2>$null
      if ($LASTEXITCODE -eq 0 -and $ver) {
        Write-Ok "Docker daemon is ready. Server version: $ver"
        return
      }
    } catch { }
    Start-Sleep -Milliseconds $WaitSleepMs
  }
  throw "Docker daemon did not become ready within ${WaitDockerTimeoutSec}s"
}

function Ensure-DockerContext {
  Write-Info "Setting docker context to '$ContextName'..."
  try {
    docker context use $ContextName | Out-Null
    Write-Ok "Docker context set to '$ContextName'."
  } catch {
    Write-Warn "Failed to set context '$ContextName'. Listing contexts..."
    docker context ls
    throw "Cannot continue without '$ContextName' context."
  }
}

function Show-ComposePs {
  Write-Host ""
  Write-Info "Current compose services:"
  docker compose -f $ComposeFile ps
  Write-Host ""
}

function Compose-Down {
  Write-Info "Running: docker compose down -v"
  docker compose -f $ComposeFile down -v
}

function Compose-Build {
  if ($NoCache) {
    Write-Info "Running: docker compose build --no-cache"
    docker compose -f $ComposeFile build --no-cache
  } else {
    Write-Info "Running: docker compose build"
    docker compose -f $ComposeFile build
  }
}

function Compose-Up {
  Write-Info "Running: docker compose up -d"
  docker compose -f $ComposeFile up -d
}

function Tail-ServerLogs {
  # Try common container names; fall back to first "*server*" from compose ps
  $candidates = @("dateapp-server", "loventiaapp-new-server")
  $container = $null

  foreach ($name in $candidates) {
    $exists = docker ps --format '{{.Names}}' | Select-String -SimpleMatch $name
    if ($exists) { $container = $name; break }
  }

  if (-not $container) {
    $list = docker ps --format '{{.Names}}'
    $serverMatch = $list | Where-Object { $_ -match "server" } | Select-Object -First 1
    if ($serverMatch) { $container = $serverMatch }
  }

  if ($container) {
    Write-Info "Tailing logs for container: $container (Ctrl+C to stop)"
    docker logs -f $container
  } else {
    Write-Warn "Server container not found. Showing 'docker compose ps' instead."
    Show-ComposePs
  }
}

# ----------------------------
# Main flow
# ----------------------------
try {
  Write-Host "=== Loventia Docker runner ===" -ForegroundColor Magenta

  # 0) Move to project root
  if (-not (Test-Path -LiteralPath $ProjectRoot)) {
    throw "Project root not found: $ProjectRoot"
  }
  Set-Location -Path $ProjectRoot
  Write-Ok "Working directory: $ProjectRoot"

  # 1) Pre-flight checks
  Assert-ComposeFile
  Ensure-DockerService
  Start-DockerDesktop
  Wait-DockerDaemon
  Ensure-DockerContext

  # 2) Compose cycle
  Show-ComposePs
  Compose-Down
  Compose-Build
  Compose-Up
  Show-ComposePs

  # 3) Optional: tail server logs
  if ($Logs) {
    Tail-ServerLogs
  } else {
    Write-Info "Tip: run with -Logs to tail server logs automatically."
  }

  Write-Ok  "Done."
  Write-Info "Health check (if server exposes /api/health or /health):"
  Write-Host '  Invoke-WebRequest http://localhost:5000/api/health -UseBasicParsing | Select-Object -Expand Content' -ForegroundColor Gray
  Write-Host '  Invoke-WebRequest http://localhost:5000/health -UseBasicParsing | Select-Object -Expand Content' -ForegroundColor Gray
}
catch {
  Write-ErrorLine $_
  exit 1
}

# --- REPLACE END ---
