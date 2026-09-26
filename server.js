```javascript
const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const app = express();

const HOST = "0.0.0.0";
const PORT = 5000;

const VIDEO_DIR = path.join(__dirname, "videos");

if (!fs.existsSync(VIDEO_DIR)) {
    fs.mkdirSync(VIDEO_DIR, { recursive: true });
}

const allowedExtensions = [
    ".mp4",
    ".webm",
    ".mkv",
    ".mov",
    ".avi",
    ".m4v"
];

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, VIDEO_DIR);
    },

    filename: function (req, file, cb) {
        const original = path.basename(file.originalname);
        const ext = path.extname(original).toLowerCase();

        if (!allowedExtensions.includes(ext)) {
            return cb(new Error("Unsupported file type"));
        }

        let name = path.basename(original, ext);

        name = name.replace(/[<>:"/\\|?*\x00-\x1F]/g, "_");

        let filename = name + ext;
        let counter = 1;

        while (fs.existsSync(path.join(VIDEO_DIR, filename))) {
            filename = name + "_" + counter + ext;
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

function getSafePath(filename) {
    const cleanName = path.basename(filename);
    return path.join(VIDEO_DIR, cleanName);
}

function escapeHtml(text) {
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

app.get("/", function (req, res) {

    const files = fs.readdirSync(VIDEO_DIR).filter(function (file) {
        return allowedExtensions.includes(
            path.extname(file).toLowerCase()
        );
    });

    let cards = "";

    for (const file of files) {

        const encoded = encodeURIComponent(file);

        cards += `
        <div class="card">
            <div class="name">${escapeHtml(file)}</div>

            <div class="buttons">
                <a class="watch" href="/watch/${encoded}">
                    Play
                </a>

                <button class="delete"
                    onclick="deleteVideo(${JSON.stringify(file)})">
                    Delete
                </button>
            </div>
        </div>
        `;
    }

    if (!cards) {
        cards = "<p>No videos uploaded.</p>";
    }

    res.send(`
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">

<title>WatchSide</title>

<style>

body {
    margin: 0;
    background: #101114;
    color: white;
    font-family: Arial, sans-serif;
}

.container {
    width: 94%;
    max-width: 1000px;
    margin: 30px auto;
}

h1 {
    text-align: center;
}

.upload {
    background: #191b20;
    padding: 20px;
    border-radius: 15px;
    margin-bottom: 20px;
}

input {
    width: 100%;
    margin-bottom: 15px;
}

button,
a {
    padding: 10px 15px;
    border: 0;
    border-radius: 8px;
    cursor: pointer;
    text-decoration: none;
}

.upload button {
    background: #4f7cff;
    color: white;
}

.card {
    background: #191b20;
    padding: 15px;
    border-radius: 12px;
    margin-bottom: 10px;
}

.name {
    word-break: break-all;
    margin-bottom: 10px;
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

<h1>WatchSide</h1>

<div class="upload">

<form action="/upload" method="POST" enctype="multipart/form-data">

<input
    type="file"
    name="video"
    accept="video/*,.mkv,.avi"
    required
>

<button type="submit">
Upload
</button>

</form>

</div>

${cards}

</div>

<script>

async function deleteVideo(file) {

    if (!confirm("Delete this file?")) {
        return;
    }

    const response = await fetch(
        "/delete/" + encodeURIComponent(file),
        {
            method: "DELETE"
        }
    );

    if (response.ok) {
        location.reload();
    } else {
        alert("Delete failed.");
    }
}

</script>

</body>
</html>
`);
});

app.post("/upload", upload.single("video"), function (req, res) {

    if (!req.file) {
        return res.status(400).send("No file selected.");
    }

    res.redirect("/");
});

app.get("/watch/:
```
