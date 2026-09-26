```powershell
$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "        WATCHSIDE AUTO INSTALLER" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# -------------------------------------------------
# Go to project directory
# -------------------------------------------------

$ProjectDir = Split-Path -Parent $MyInvocation.MyCommand.Path

if (-not $ProjectDir) {
    $ProjectDir = Get-Location
}

Set-Location $ProjectDir

Write-Host "[1/5] Project directory:" -ForegroundColor Yellow
Write-Host $ProjectDir
Write-Host ""

# -------------------------------------------------
# Find Python
# -------------------------------------------------

Write-Host "[2/5] Checking Python..." -ForegroundColor Yellow

$Python = $null

$commands = @(
    "python",
    "py",
    "python3"
)

foreach ($cmd in $commands) {
    try {
        $result = Get-Command $cmd -ErrorAction SilentlyContinue

        if ($result) {
            $Python = $result.Source
            break
        }
    }
    catch {
    }
}

# -------------------------------------------------
# Install Python if missing
# -------------------------------------------------

if (-not $Python) {

    Write-Host "Python was not found." -ForegroundColor Red
    Write-Host "Installing Python automatically..." -ForegroundColor Yellow
    Write-Host ""

    $PythonInstaller = "$env:TEMP\python-installer.exe"

    $PythonUrl = "https://www.python.org/ftp/python/3.13.7/python-3.13.7-amd64.exe"

    Write-Host "Downloading Python..." -ForegroundColor Cyan

    Invoke-WebRequest `
        -Uri $PythonUrl `
        -OutFile $PythonInstaller `
        -UseBasicParsing

    Write-Host "Installing Python..." -ForegroundColor Cyan

    Start-Process `
        -FilePath $PythonInstaller `
        -ArgumentList "/quiet InstallAllUsers=1 PrependPath=1 Include_pip=1" `
        -Wait

    Remove-Item $PythonInstaller -Force -ErrorAction SilentlyContinue

    # Refresh PATH
    $env:Path = [System.Environment]::GetEnvironmentVariable(
        "Path",
        "Machine"
    ) + ";" + [System.Environment]::GetEnvironmentVariable(
        "Path",
        "User"
    )

    # Find Python again
    $Python = $null

    foreach ($cmd in $commands) {

        try {

            $result = Get-Command $cmd -ErrorAction SilentlyContinue

            if ($result) {
                $Python = $result.Source
                break
            }

        }
        catch {
        }
    }

    if (-not $Python) {
        throw "Python installation completed but Python could not be found. Please restart PowerShell and run install.ps1 again."
    }
}

Write-Host "Python found:" -ForegroundColor Green
Write-Host $Python
Write-Host ""

# -------------------------------------------------
# Check Python version
# -------------------------------------------------

& $Python --version

if ($LASTEXITCODE -ne 0) {
    throw "Python could not be executed."
}

Write-Host ""

# -------------------------------------------------
# Upgrade pip
# -------------------------------------------------

Write-Host "[3/5] Preparing pip..." -ForegroundColor Yellow

& $Python -m ensurepip --upgrade

if ($LASTEXITCODE -ne 0) {
    Write-Host "ensurepip returned an error. Trying pip directly..." -ForegroundColor DarkYellow
}

& $Python -m pip install --upgrade pip

if ($LASTEXITCODE -ne 0) {
    throw "Could not install/upgrade pip."
}

Write-Host ""

# -------------------------------------------------
# Install dependencies
# -------------------------------------------------

Write-Host "[4/5] Installing Python libraries..." -ForegroundColor Yellow

& $Python -m pip install --upgrade flask werkzeug

if ($LASTEXITCODE -ne 0) {
    throw "Could not install Flask/Werkzeug."
}

Write-Host ""
Write-Host "Flask and Werkzeug installed successfully." -ForegroundColor Green
Write-Host ""

# -------------------------------------------------
# Check server.py
# -------------------------------------------------

if (-not (Test-Path ".\server.py")) {

    Write-Host "server.py was not found!" -ForegroundColor Red
    Write-Host "Make sure server.py exists in:" -ForegroundColor Yellow
    Write-Host $ProjectDir

    exit 1
}

# -------------------------------------------------
# Create videos directory
# -------------------------------------------------

if (-not (Test-Path ".\videos")) {

    Write-Host "Creating videos directory..." -ForegroundColor Cyan

    New-Item `
        -ItemType Directory `
        -Path ".\videos" `
        -Force | Out-Null
}

Write-Host ""

# -------------------------------------------------
# Start server
# -------------------------------------------------

Write-Host "[5/5] Starting WatchSide..." -ForegroundColor Yellow
Write-Host ""

Write-Host "=========================================" -ForegroundColor Green
Write-Host " WatchSide is starting..." -ForegroundColor Green
Write-Host " Local: http://127.0.0.1:5000" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green
Write-Host ""

& $Python ".\server.py"
```
