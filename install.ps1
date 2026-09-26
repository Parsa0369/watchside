```powershell
$ErrorActionPreference = "Stop"

$ProjectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ProjectDir

Write-Host "===================================="
Write-Host "       WatchSide Installer"
Write-Host "===================================="
Write-Host ""

# -------------------------------
# 1. Find Node.js
# -------------------------------

Write-Host "[1/5] Checking Node.js..."

$node = Get-Command node -ErrorAction SilentlyContinue

if (-not $node) {

    Write-Host "Node.js not found."
    Write-Host "Downloading Node.js..."

    $installer = "$env:TEMP\nodejs-installer.msi"

    Invoke-WebRequest `
        -Uri "https://nodejs.org/dist/v22.19.0/node-v22.19.0-x64.msi" `
        -OutFile $installer

    Write-Host "Installing Node.js..."

    Start-Process `
        "msiexec.exe" `
        -ArgumentList "/i `"$installer`" /qn /norestart" `
        -Wait

    Remove-Item $installer -Force -ErrorAction SilentlyContinue

    # Refresh PATH
    $env:Path = `
        [Environment]::GetEnvironmentVariable("Path", "Machine") +
        ";" +
        [Environment]::GetEnvironmentVariable("Path", "User")

    $node = Get-Command node -ErrorAction SilentlyContinue

    if (-not $node) {
        throw "Node.js نصب شد ولی PowerShell هنوز آن را پیدا نمی‌کند. PowerShell را ببند و دوباره باز کن."
    }
}

Write-Host "Node.js found:"
node --version

Write-Host ""

# -------------------------------
# 2. Check server.js
# -------------------------------

Write-Host "[2/5] Checking server.js..."

if (-not (Test-Path ".\server.js")) {
    throw "server.js پیدا نشد. باید کنار install.ps1 باشد."
}

Write-Host "server.js OK"
Write-Host ""

# -------------------------------
# 3. Initialize npm
# -------------------------------

Write-Host "[3/5] Preparing npm..."

if (-not (Test-Path ".\package.json")) {

    npm init -y

    if ($LASTEXITCODE -ne 0) {
        throw "npm init failed."
    }
}

Write-Host "npm OK"
Write-Host ""

# -------------------------------
# 4. Install dependencies
# -------------------------------

Write-Host "[4/5] Installing dependencies..."

npm install express multer

if ($LASTEXITCODE -ne 0) {
    throw "npm install failed."
}

Write-Host "Dependencies installed."
Write-Host ""

# -------------------------------
# 5. Create videos folder
# -------------------------------

Write-Host "[5/5] Preparing videos folder..."

if (-not (Test-Path ".\videos")) {
    New-Item `
        -ItemType Directory `
        -Path ".\videos" |
        Out-Null
}

Write-Host ""
Write-Host "===================================="
Write-Host "        WatchSide is READY"
Write-Host "===================================="
Write-Host ""

Write-Host "Open this on the RDP:"
Write-Host "http://127.0.0.1:5000"
Write-Host ""

Write-Host "Starting server..."
Write-Host ""

node .\server.js
```
