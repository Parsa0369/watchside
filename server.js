const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = 5000;
const HOST = "0.0.0.0";

const VIDEO_DIR = path.join(__dirname, "videos");

if (!fs.existsSync(VIDEO_DIR)) {
    fs.mkdirSync(VIDEO_DIR);
}

const allowed = [".mp4", ".webm", ".mkv", ".mov", ".avi", ".m4v"];

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, VIDEO_DIR);
    },

    filename: function (req, file, cb) {
        var ext = path.extname(file.originalname).toLowerCase();

        if (allowed.indexOf(ext) === -1) {
            return cb(new Error("Unsupported file type"));
        }

        var name = path.basename(file.originalname, ext);
        name = name.replace(/[<>:"/\\|?*]/g, "_");

        var filename = name + ext;
        var counter = 1;

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

function mime(file) {
    var ext = path.extname(file).toLowerCase();

    if (ext === ".mp4" || ext === ".m4v") return "video/mp4";
    if (ext === ".webm") return "video/webm";
    if (ext === ".mkv") return "video/x-matroska";
    if (ext === ".mov") return "video/quicktime";
    if (ext === ".avi") return "video/x-msvideo";

    return "application/octet-stream";
}

function safePath(filename) {
    return path.join(VIDEO_DIR, path.basename(filename));
}

app.get("/", function (req, res) {

    var files = fs.readdirSync(VIDEO_DIR);

    var html = "";
    html += "<!DOCTYPE html>";
    html += "<html>";
    html += "<head>";
    html += "<meta charset='UTF-8'>";
    html += "<meta name='viewport' content='width=device-width,initial-scale=1'>";
    html += "<title>WatchSide</title>";

    html += "<style>";
    html += "body{background:#101114;color:white;font-family:Arial;margin:0;padding:30px;}";
    html += ".box{max-width:900px;margin:auto;}";
    html += ".card{background:#191b20;padding:15px;margin:10px 0;border-radius:10px;}";
    html += "a,button{padding:10px 15px;border:0;border-radius:7px;text-decoration:none;cursor:pointer;}";
    html += ".play{background:#27ae60;color:white;}";
    html += ".delete{background:#c0392b;color:white;}";
    html += "input{margin:10px 0;}";
    html += "</style>";

    html += "</head>";
    html += "<body>";
    html += "<div class='box'>";

    html += "<h1>WatchSide</h1>";

    html += "<form action='/upload' method='POST' enctype='multipart/form-data'>";
    html += "<input type='file' name='video' required>";
    html += "<button type='submit'>Upload</button>";
    html += "</form>";

    for (var i = 0; i < files.length; i++) {

        var file = files[i];
        var ext = path.extname(file).toLowerCase();

        if (allowed.indexOf(ext) === -1) {
            continue;
        }

        var encoded = encodeURIComponent(file);

        html += "<div class='card'>";
        html += "<div>" + escapeHtml(file) + "</div>";
        html += "<br>";
        html += "<a class='play' href='/watch/" + encoded + "'>Play</a> ";
        html += "<button class='delete' onclick='removeFile(" + JSON.stringify(file) + ")'>Delete</button>";
        html += "</div>";
    }

    html += "<script>";
    html += "function removeFile(file){";
    html += "if(!confirm('Delete this file?')) return;";
    html += "fetch('/delete/'+encodeURIComponent(file),{method:'DELETE'})";
    html += ".then(function(){location.reload();});";
    html += "}";
    html += "</script>";

    html += "</div>";
    html += "</body>";
    html += "</html>";

    res.send(html);
});

app.post("/upload", upload.single("video"), function (req, res) {

    if (!req.file) {
        return res.status(400).send("No file selected.");
    }

    res.redirect("/");
});

app.get("/watch/:filename", function (req, res) {

    var filename = decodeURIComponent(req.params.filename);
    var filePath = safePath(filename);

    if (!fs.existsSync(filePath)) {
        return res.status(404).send("File not found.");
    }

    var html = "";

    html += "<!DOCTYPE html>";
    html += "<html>";
    html += "<head>";
    html += "<meta charset='UTF-8'>";
    html += "<meta name='viewport' content='width=device-width,initial-scale=1'>";
    html += "<title>WatchSide</title>";

    html += "<style>";
    html += "body{background:#000;color:white;font-family:Arial;margin:0;padding:20px;}";
    html += "video{width:100%;max-width:1200px;display:block;margin:auto;}";
    html += "a{color:white;display:block;margin:20px;text-align:center;}";
    html += "</style>";

    html += "</head>";
    html += "<body>";

    html += "<h3>" + escapeHtml(filename) + "</h3>";

    html += "<video controls preload='metadata'>";
    html += "<source src='/stream/" + encodeURIComponent(filename) + "' type='" + mime(filePath) + "'>";
    html += "</video>";

    html += "<a href='/'>Back</a>";

    html += "</body>";
    html += "</html>";

    res.send(html);
});

app.get("/stream/:filename", function (req, res) {

    var filename = decodeURIComponent(req.params.filename);
    var filePath = safePath(filename);

    if (!fs.existsSync(filePath)) {
        return res.status(404).send("File not found.");
    }

    var stat = fs.statSync(filePath);
    var size = stat.size;
    var type = mime(filePath);
    var range = req.headers.range;

    if (!range) {

        res.writeHead(200, {
            "Content-Length": size,
            "Content-Type": type,
            "Accept-Ranges": "bytes"
        });

        return fs.createReadStream(filePath).pipe(res);
    }

    var parts = range.replace("bytes=", "").split("-");
    var start = parseInt(parts[0], 10);
    var end = parts[1] ? parseInt(parts[1], 10) : size - 1;

    if (isNaN(start) || start >= size) {

        res.writeHead(416, {
            "Content-Range": "bytes */" + size
        });

        return res.end();
    }

    if (end >= size) {
        end = size - 1;
    }

    var length = end - start + 1;

    res.writeHead(206, {
        "Content-Range": "bytes " + start + "-" + end + "/" + size,
        "Accept-Ranges": "bytes",
        "Content-Length": length,
        "Content-Type": type
    });

    fs.createReadStream(filePath, {
        start: start,
        end: end
    }).pipe(res);
});

app.delete("/delete/:filename", function (req, res) {

    var filename = decodeURIComponent(req.params.filename);
    var filePath = safePath(filename);

    if (!fs.existsSync(filePath)) {
        return res.status(404).send("File not found.");
    }

    fs.unlinkSync(filePath);

    res.json({
        success: true
    });
});

function escapeHtml(text) {

    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

app.listen(PORT, HOST, function () {

    console.log("");
    console.log("================================");
    console.log("       WatchSide is running");
    console.log("================================");
    console.log("");
    console.log("Open:");
    console.log("http://127.0.0.1:" + PORT);
    console.log("");
});
