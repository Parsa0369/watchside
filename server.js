```javascript
const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const app = express();

const HOST = "0.0.0.0";
const PORT = 5000;

const BASE_DIR = __dirname;
const VIDEO_DIR = path.join(BASE_DIR, "videos");

if (!fs.existsSync(VIDEO_DIR)) {
    fs.mkdirSync(VIDEO_DIR, { recursive: true });
}

const allowedExtensions = [
    ".mp4",
    ".mkv",
    ".webm",
    ".mov",
    ".avi",
    ".m4v"
];

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, VIDEO_DIR);
    },

    filename: (req, file, cb) => {
        let original = path.basename(file.originalname);
        let ext = path.extname(original).toLowerCase();
        let name = path.basename(original, ext);

        if (!allowedExtensions.includes(ext)) {
            return cb(new Error("فرمت فایل پشتیبانی نمی‌شود."));
        }

        // حذف کاراکترهای مشکل‌ساز
        name = name.replace(/[<>:"/\\|?*\x00-\x1F]/g, "_");

        let filename = name + ext;
        let counter = 1;

        while (fs.existsSync(path.join(VIDEO_DIR, filename))) {
            filename = `${name}_${counter}${ext}`;
            counter++;
        }

        cb(null, filename);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 20 * 1024 * 1024 * 1024
    }
});

function getMimeType(file) {
    const ext = path.extname(file).toLowerCase();

    const types = {
        ".mp4": "video/mp4",
        ".webm": "video/webm",
        ".mkv": "video/x-matroska",
        ".mov": "video/quicktime",
        ".avi": "video/x-msvideo",
        ".m4v": "video/mp4"
    };

    return types[ext] || "application/octet-stream";
}

function safeFilePath(filename) {
    const clean = path.basename(filename);
    const filePath = path.join(VIDEO_DIR, clean);

    if (!filePath.startsWith(VIDEO_DIR)) {
        return null;
    }

    return filePath;
}

// صفحه اصلی
app.get("/", (req, res) => {
    const files = fs.readdirSync(VIDEO_DIR)
        .filter(file => {
            return allowedExtensions.includes(
                path.extname(file).toLowerCase()
            );
        });

    const items = files.map(file => {
        const encoded = encodeURIComponent(file);

        return `
            <div class="card">
                <div class="name">${escapeHtml(file)}</div>

                <div class="buttons">
                    <a class="watch" href="/watch/${encoded}">
                        ▶ پخش
                    </a>

                    <button class="delete"
                        onclick="deleteVideo(${JSON.stringify(file)})">
                        حذف
                    </button>
                </div>
            </div>
        `;
    }).join("");

    res.send(`
<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">

<title>WatchSide</title>

<style>
* {
    box-sizing: border-box;
}

body {
    margin: 0;
    background: #101114;
    color: #fff;
    font-family: Arial, sans-serif;
}

.container {
    width: min(1000px, 94%);
    margin: 30px auto;
}

h1 {
    text-align: center;
    margin-bottom: 25px;
}

.upload {
    background: #191b20;
    padding: 20px;
    border-radius: 15px;
    margin-bottom: 25px;
}

input[type=file] {
    width: 100%;
    margin-bottom: 15px;
}

button,
a {
    border: 0;
    padding: 10px 16px;
    border-radius: 9px;
    cursor: pointer;
    text-decoration: none;
    font-size: 14px;
}

.upload button {
    background: #4f7cff;
    color: white;
}

.card {
    background: #191b20;
    padding: 15px;
    border-radius: 12px;
    margin-bottom: 12px;
}

.name {
    word-break: break-all;
    margin-bottom: 12px;
}

.buttons {
    display: flex;
    gap: 8px;
}

.watch {
    background: #27ae60;
    color: white;
}

.delete {
    background: #c0392b;
    color: white;
}
</style>
</head>

<body>

<div class="container">

<h1>🎬 WatchSide</h1>

<div class="upload">
    <form action="/upload" method="POST" enctype="multipart/form-data">
        <input
            type="file"
            name="video"
            accept="video/*,.mkv,.avi"
            required
        >

        <button type="submit">
            📤 آپلود
        </button>
    </form>
</div>

${items || "<p style='text-align:center'>هنوز ویدیویی آپلود نشده.</p>"}

</div>

<script>
async function deleteVideo(file) {
    if (!confirm("این فایل حذف شود؟")) return;

    const response = await fetch(
        "/delete/" + encodeURIComponent(file),
        { method: "DELETE" }
    );

    if (response.ok) {
        location.reload();
    } else {
        alert("حذف فایل انجام نشد.");
    }
}
</script>

</body>
</html>
`);
});

// آپلود
app.post("/upload", upload.single("video"), (req, res) => {
    if (!req.file) {
        return res.status(400).send("فایلی انتخاب نشده است.");
    }

    res.redirect("/");
});

// صفحه پخش
app.get("/watch/:filename", (req, res) => {
    const filename = decodeURIComponent(req.params.filename);
    const filePath = safeFilePath(filename);

    if (!filePath || !fs.existsSync(filePath)) {
        return res.status(404).send("فایل پیدا نشد.");
    }

    const encoded = encodeURIComponent(filename);

    res.send(`
<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">

<title>${escapeHtml(filename)}</title>

<style>
body {
    margin: 0;
    background: #000;
    color: white;
    font-family: Arial, sans-serif;
}

.container {
    width: min(1200px, 96%);
    margin: 20px auto;
}

video {
    width: 100%;
    max-height: 80vh;
    background: black;
    border-radius: 12px;
}

a {
    display: inline-block;
    margin-top: 15px;
    padding: 10px 15px;
    background: #222;
    color: white;
    text-decoration: none;
    border-radius: 8px;
}
</style>
</head>

<body>

<div class="container">

<h3>${escapeHtml(filename)}</h3>

<video controls preload="metadata">
    <source src="/stream/${encoded}">
    مرورگر شما از پخش ویدیو پشتیبانی نمی‌کند.
</video>

<br>

<a href="/">← بازگشت</a>

</div>

</body>
</html>
`);
});

// استریم با HTTP Range
app.get("/stream/:filename", (req, res) => {
    const filename = decodeURIComponent(req.params.filename);
    const filePath = safeFilePath(filename);

    if (!filePath || !fs.existsSync(filePath)) {
        return res.status(404).send("فایل پیدا نشد.");
    }

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;

    const range = req.headers.range;

    const contentType = getMimeType(filePath);

    // اگر مرورگر Range نخواست
    if (!range) {
        res.writeHead(200, {
            "Content-Length": fileSize,
            "Content-Type": contentType,
            "Accept-Ranges": "bytes"
        });

        return fs.createReadStream(filePath).pipe(res);
    }

    const parts = range.replace(/bytes=/, "").split("-");

    const start = parseInt(parts[0], 10);

    let end = parts[1]
        ? parseInt(parts[1], 10)
        : fileSize - 1;

    if (isNaN(start) || start >= fileSize) {
        res.status(416).set({
            "Content-Range": `bytes */${fileSize}`
        });

        return res.end();
    }

    if (end >= fileSize) {
        end = fileSize - 1;
    }

    const chunkSize = end - start + 1;

    res.writeHead(206, {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunkSize,
        "Content-Type": contentType
    });

    fs.createReadStream(filePath, {
        start,
        end
    }).pipe(res);
});

// حذف
app.delete("/delete/:filename", (req, res) => {
    const filename = decodeURIComponent(req.params.filename);
    const filePath = safeFilePath(filename);

    if (!filePath || !fs.existsSync(filePath)) {
        return res.status(404).send("فایل پیدا نشد.");
    }

    fs.unlinkSync(filePath);

    res.json({
        success: true
    });
});

// HTML escape
function escapeHtml(text) {
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// خطاهای آپلود
app.use((err, req, res, next) => {
    console.error(err);

    res.status(400).send(
        "خطا: " + (err.message || "خطای ناشناخته")
    );
});

app.listen(PORT, HOST, () => {
    console.log("");
    console.log("====================================");
    console.log("        WatchSide is running");
    console.log("====================================");
    console.log(`Local:  http://127.0.0.1:${PORT}`);
    console.log(`LAN:    http://0.0.0.0:${PORT}`);
    console.log("");
    console.log("Video directory:");
    console.log(VIDEO_DIR);
    console.log("");
});
```

### 2. `install.ps1`

```powershell
$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "===================================="
Write-Host "       WatchSide Node Installer"
Write-Host "===================================="
Write-Host ""

$ProjectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ProjectDir

Write-Host "[1/6] Checking Node.js..."

function Get-NodePath {
    $cmd = Get-Command node -ErrorAction SilentlyContinue

    if ($cmd) {
        return $cmd.Source
    }

    $paths = @(
        "$env:ProgramFiles\nodejs\node.exe",
        "${env:ProgramFiles(x86)}\nodejs\node.exe"
    )

    foreach ($p in $paths) {
        if (Test-Path $p) {
            return $p
        }
    }

    return $null
}

$NodePath = Get-NodePath

if (-not $NodePath) {

    Write-Host "Node.js not found."
    Write-Host "Downloading Node.js..."

    $installer = Join-Path $env:TEMP "nodejs-installer.msi"

    $url = "https://nodejs.org/dist/v22.19.0/node-v22.19.0-x64.msi"

    Invoke-WebRequest `
        -Uri $url `
        -OutFile $installer

    Write-Host "Installing Node.js..."

    Start-Process `
        msiexec.exe `
        -ArgumentList "/i `"$installer`" /qn /norestart" `
        -Wait `
        -NoNewWindow

    Remove-Item $installer -Force -ErrorAction SilentlyContinue

    # Refresh PATH
    $env:Path = [System.Environment]::GetEnvironmentVariable(
        "Path",
        "Machine"
    ) + ";" + [System.Environment]::GetEnvironmentVariable(
        "Path",
        "User"
    )

    $NodePath = Get-NodePath

    if (-not $NodePath) {
        throw "Node.js نصب شد ولی پیدا نشد. PowerShell را ببندید و دوباره اجرا کنید."
    }
}

Write-Host "Node.js: $NodePath"

$NodeVersion = & $NodePath --version

Write-Host "Version: $NodeVersion"
Write-Host ""

Write-Host "[2/6] Checking server.js..."

if (-not (Test-Path ".\server.js")) {
    throw "server.js پیدا نشد."
}

Write-Host "server.js OK"
Write-Host ""

Write-Host "[3/6] Initializing npm..."

if (-not (Test-Path ".\package.json")) {

    & npm init -y

    if ($LASTEXITCODE -ne 0) {
        throw "npm init failed."
    }
}

Write-Host ""

Write-Host "[4/6] Installing Express and Multer..."

& npm install express multer

if ($LASTEXITCODE -ne 0) {
    throw "npm install failed."
}

Write-Host ""

Write-Host "[5/6] Creating video directory..."

if (-not (Test-Path ".\videos")) {
    New-Item -ItemType Directory -Path ".\videos" | Out-Null
}

Write-Host "videos directory OK"
Write-Host ""

Write-Host "[6/6] Starting WatchSide..."

Write-Host ""
Write-Host "===================================="
Write-Host "          WatchSide READY"
Write-Host "===================================="
Write-Host ""

Write-Host "Open on the RDP:"
Write-Host "http://127.0.0.1:5000"
Write-Host ""

Write-Host "For LAN:"
Write-Host "http://10.1.0.112:5000"
Write-Host ""

Write-Host "Press CTRL+C to stop."
Write-Host ""

& $NodePath ".\server.js"
```

### اجرا

بعد از اینکه این دو فایل از GitHub اومدند:

```powershell
cd C:\watchside
Set-ExecutionPolicy -Scope Process Bypass
.\install.ps1
```

بعد روی **خود RDP** برو:

```text
http://127.0.0.1:5000
```

این نسخه فایل ویدیو را داخل:

```text
C:\watchside\videos
```

نگه می‌دارد و پخش ویدیو با **HTTP Range** انجام می‌شود، یعنی برای Seek کردن لازم نیست کل فایل از اول دانلود شود.

فعلاً `10.1.0.112:5000` را برای اینترنت عمومی حساب نکن؛ بعد از اینکه خود WatchSide بالا آمد، مرحله بعدی را روی **دسترسی اینترنتی برای کاربران خارج از RDP** تنظیم می‌کنیم.
