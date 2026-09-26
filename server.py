from flask import Flask, request, redirect, url_for, render_template_string, send_file, abort
from werkzeug.utils import secure_filename
from pathlib import Path
import mimetypes
import os

app = Flask(__name__)

# =========================
# SETTINGS
# =========================

HOST = "0.0.0.0"
PORT = 5000

BASE_DIR = Path(__file__).resolve().parent
VIDEO_DIR = BASE_DIR / "videos"

VIDEO_DIR.mkdir(exist_ok=True)

ALLOWED_EXTENSIONS = {
    ".mp4",
    ".mkv",
    ".webm",
    ".mov",
    ".avi",
    ".m4v",
}

MAX_UPLOAD_SIZE = 20 * 1024 * 1024 * 1024  # 20 GB

app.config["MAX_CONTENT_LENGTH"] = MAX_UPLOAD_SIZE


# =========================
# HTML
# =========================

HTML = """
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">

<title>RDP Video Server</title>

<style>

* {
    box-sizing: border-box;
}

body {
    margin: 0;
    background: #0f1115;
    color: #ffffff;
    font-family: Arial, sans-serif;
}

.container {
    max-width: 900px;
    margin: auto;
    padding: 25px;
}

h1 {
    margin-bottom: 5px;
}

.subtitle {
    color: #999;
    margin-bottom: 25px;
}

.upload-box {
    background: #181b21;
    border: 1px solid #292d35;
    border-radius: 15px;
    padding: 20px;
    margin-bottom: 25px;
}

input[type=file] {
    width: 100%;
    margin-bottom: 15px;
}

button {
    background: #ffffff;
    color: #000000;
    border: none;
    border-radius: 10px;
    padding: 11px 18px;
    cursor: pointer;
    font-weight: bold;
}

button:hover {
    opacity: 0.85;
}

.file {
    background: #181b21;
    border: 1px solid #292d35;
    border-radius: 15px;
    padding: 15px;
    margin-bottom: 12px;
}

.file-name {
    font-size: 17px;
    font-weight: bold;
    word-break: break-word;
}

.file-size {
    color: #888;
    font-size: 13px;
    margin-top: 5px;
}

.actions {
    margin-top: 12px;
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
}

.delete {
    background: #35191d;
    color: #ffb5bc;
}

video {
    width: 100%;
    max-height: 500px;
    margin-top: 15px;
    border-radius: 10px;
    background: #000;
}

.empty {
    color: #888;
    text-align: center;
    padding: 40px;
}

</style>
</head>

<body>

<div class="container">

<h1>🎬 RDP Video Server</h1>

<div class="subtitle">
Local media server
</div>

<div class="upload-box">

<form action="/upload" method="post" enctype="multipart/form-data">

<input
    type="file"
    name="file"
    accept="video/*"
    required
>

<br>

<button type="submit">
📤 Upload Video
</button>

</form>

</div>


<h2>Videos</h2>

{% if files %}

{% for file in files %}

<div class="file">

<div class="file-name">
{{ file.name }}
</div>

<div class="file-size">
{{ file.size }}
</div>

<div class="actions">

<a href="/watch/{{ file.name }}">
<button type="button">▶ Watch</button>
</a>

<form
    action="/delete/{{ file.name }}"
    method="post"
    onsubmit="return confirm('Delete this file?')"
>

<button class="delete" type="submit">
🗑 Delete
</button>

</form>

</div>

</div>

{% endfor %}

{% else %}

<div class="empty">
No videos uploaded yet.
</div>

{% endif %}

</div>

</body>
</html>
"""


WATCH_HTML = """
<!DOCTYPE html>
<html lang="en">

<head>

<meta charset="UTF-8">

<meta
name="viewport"
content="width=device-width, initial-scale=1.0"
>

<title>{{ filename }}</title>

<style>

body {
    margin: 0;
    background: #000;
    color: white;
    font-family: Arial;
}

.container {
    max-width: 1200px;
    margin: auto;
    padding: 15px;
}

video {
    width: 100%;
    max-height: 85vh;
    background: black;
}

a {
    color: white;
    text-decoration: none;
}

</style>

</head>

<body>

<div class="container">

<p>
<a href="/">← Back</a>
</p>

<h3>{{ filename }}</h3>

<video
    controls
    preload="metadata"
>

<source
    src="/stream/{{ filename }}"
    type="{{ mime }}"
>

Your browser does not support video playback.

</video>

</div>

</body>

</html>
"""


# =========================
# HELPERS
# =========================

def format_size(size):

    units = [
        "B",
        "KB",
        "MB",
        "GB",
        "TB"
    ]

    value = float(size)

    for unit in units:

        if value < 1024:
            return f"{value:.1f} {unit}"

        value /= 1024

    return f"{value:.1f} PB"


def safe_file_path(filename):

    filename = os.path.basename(filename)

    path = VIDEO_DIR / filename

    try:
        path.resolve().relative_to(VIDEO_DIR.resolve())
    except ValueError:
        abort(404)

    return path


# =========================
# HOME
# =========================

@app.route("/")
def index():

    files = []

    for path in VIDEO_DIR.iterdir():

        if not path.is_file():
            continue

        if path.suffix.lower() not in ALLOWED_EXTENSIONS:
            continue

        files.append({
            "name": path.name,
            "size": format_size(path.stat().st_size)
        })

    files.sort(
        key=lambda x: x["name"].lower()
    )

    return render_template_string(
        HTML,
        files=files
    )


# =========================
# UPLOAD
# =========================

@app.route("/upload", methods=["POST"])
def upload():

    if "file" not in request.files:
        return "No file selected", 400

    file = request.files["file"]

    if not file.filename:
        return "No file selected", 400

    original_name = file.filename

    safe_name = secure_filename(original_name)

    if not safe_name:
        return "Invalid filename", 400

    extension = Path(safe_name).suffix.lower()

    if extension not in ALLOWED_EXTENSIONS:
        return "Only video files are allowed.", 400

    destination = VIDEO_DIR / safe_name

    # Avoid overwriting existing files
    if destination.exists():

        stem = destination.stem
        suffix = destination.suffix

        counter = 1

        while destination.exists():

            destination = (
                VIDEO_DIR /
                f"{stem}_{counter}{suffix}"
            )

            counter += 1

    file.save(destination)

    return redirect(url_for("index"))


# =========================
# WATCH PAGE
# =========================

@app.route("/watch/<path:filename>")
def watch(filename):

    path = safe_file_path(filename)

    if not path.exists() or not path.is_file():
        abort(404)

    mime, _ = mimetypes.guess_type(path.name)

    if not mime:
        mime = "video/mp4"

    return render_template_string(
        WATCH_HTML,
        filename=path.name,
        mime=mime
    )


# =========================
# VIDEO STREAM
# =========================

@app.route("/stream/<path:filename>")
def stream(filename):

    path = safe_file_path(filename)

    if not path.exists() or not path.is_file():
        abort(404)

    mime, _ = mimetypes.guess_type(path.name)

    if not mime:
        mime = "application/octet-stream"

    return send_file(
        path,
        mimetype=mime,
        conditional=True,
        etag=True,
        max_age=0
    )


# =========================
# DELETE
# =========================

@app.route("/delete/<path:filename>", methods=["POST"])
def delete(filename):

    path = safe_file_path(filename)

    if path.exists() and path.is_file():
        path.unlink()

    return redirect(url_for("index"))


# =========================
# ERROR: FILE TOO LARGE
# =========================

@app.errorhandler(413)
def file_too_large(error):

    return """
    <h2>File is too large.</h2>
    <p>Maximum upload size is 20 GB.</p>
    <a href="/">Back</a>
    """, 413


# =========================
# START SERVER
# =========================

if __name__ == "__main__":

    print()
    print("======================================")
    print("       RDP VIDEO SERVER")
    print("======================================")
    print()
    print(f"Videos folder: {VIDEO_DIR}")
    print(f"Local URL:     http://127.0.0.1:{PORT}")
    print(f"Server URL:    http://0.0.0.0:{PORT}")
    print()
    print("Press CTRL+C to stop.")
    print()

    app.run(
        host=HOST,
        port=PORT,
        threaded=True
    )
