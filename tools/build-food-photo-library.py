#!/usr/bin/env python3
"""Import explicitly whitelisted, Commons-verified CC0 food photos to offline assets.

No automated media search, no opaque food model and no nutrition values. The exact
Commons File: title for each image is reviewed in SOURCES.json. For EVERY photo,
obtain live per-file LicenseShortName from the Wikimedia API and fail closed
unless it reports CC0 or a public-domain dedication.

Usage:
  python -m pip install Pillow
  python tools/build-food-photo-library.py

All downloaded files are resized into 192px square, quality-78 JPEG thumbnails;
a manifest with authors, source pages, full license URLs and hashes is generated.
"""
from __future__ import annotations

from datetime import datetime, timezone
from html.parser import HTMLParser
from io import BytesIO
from pathlib import Path
import hashlib
import json
import ssl
import time
import urllib.parse
import urllib.request

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
SOURCES = ROOT / "art/food/SOURCES.json"
DEST = ROOT / "art/food"
API = "https://commons.wikimedia.org/w/api.php"
UA = "Tempered-Photo-Provenance/0.1 (https://github.com/cperry0360-create/tempered; CC0-only local photo library)"
ALLOWED_LICENSES = {"cc0", "cc0 1.0", "public domain", "public domain mark 1.0"}
MAX_DOWNLOAD_BYTES = 6_000_000
THUMB = (192, 192)

class PlainText(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts = []
    def handle_data(self, d):
        self.parts.append(d)

def clean_html(value):
    parser = PlainText()
    parser.feed(value or "")
    return " ".join(" ".join(parser.parts).split())[:400]

def request(url, max_size):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "*/*"})
    with urllib.request.urlopen(req, timeout=23, context=ssl.create_default_context()) as response:
        data = response.read(max_size + 1)
        if len(data) > max_size:
            raise RuntimeError(f"Source exceeds {max_size} bytes")
        return data

def commons_info(filename):
    args = {
        "action": "query", "format": "json", "formatversion": "2",
        "prop": "imageinfo", "titles": filename,
        "iiprop": "url|extmetadata|mime", "iiurlwidth": "512",
    }
    data = json.loads(request(API + "?" + urllib.parse.urlencode(args), 1_000_000))
    pages = data.get("query", {}).get("pages", [])
    if len(pages) != 1 or "missing" in pages[0]:
        raise RuntimeError(f"Commons file not found: {filename}")
    images = pages[0].get("imageinfo", [])
    if not images: raise RuntimeError(f"Commons has no image info: {filename}")
    image = images[0]
    metadata = image.get("extmetadata", {})
    short = clean_html(metadata.get("LicenseShortName", {}).get("value", "")).strip().lower()
    if short not in ALLOWED_LICENSES:
        raise RuntimeError(f"REJECTED license {short!r} for {filename!r}. CC0 or public domain only.")
    license_url = metadata.get("LicenseUrl", {}).get("value", "https://creativecommons.org/publicdomain/zero/1.0/")
    if not (license_url.startswith("https://") or license_url.startswith("http://")):
        raise RuntimeError(f"Bad license URL for {filename}: {license_url}")
    source_url = image.get("descriptionurl")
    if not source_url or not source_url.startswith("https://commons.wikimedia.org/"):
        raise RuntimeError(f"Missing Commons source URL: {filename}")
    thumbnail = image.get("thumburl") or image.get("url")
    if not thumbnail or not thumbnail.startswith("https://upload.wikimedia.org/"):
        raise RuntimeError(f"Unexpected thumbnail host: {filename}: {thumbnail}")
    mime = image.get("thumbmime") or image.get("mime", "")
    if mime and mime not in ("image/jpeg","image/png","image/webp","image/tiff"):
        raise RuntimeError(f"Unsupported image type {mime}: {filename}")
    return {
        "download": thumbnail, "page": source_url,
        "license": short.upper(), "licenseUrl": license_url,
        "author": clean_html(metadata.get("Artist", {}).get("value", "Wikimedia Commons contributor")),
        "originalMime": image.get("mime", ""),
    }

def prepare(data):
    with Image.open(BytesIO(data)) as original:
        original = ImageOps.exif_transpose(original)
        thumb = ImageOps.fit(original.convert("RGB"), THUMB, method=Image.Resampling.LANCZOS, centering=(0.5,0.5))
        output = BytesIO()
        thumb.save(output, format="JPEG", quality=78, optimize=True, progressive=True)
        return output.getvalue()

def main():
    sources = json.loads(SOURCES.read_text(encoding="utf-8"))
    seen = set()
    manifest = {
        "purpose": "Optional illustrations for saved foods. Does NOT contain nutrition facts.",
        "source": "Wikimedia Commons; licenses checked per file on import.",
        "licensePolicy": "CC0 / public domain only",
        "transformation": "Resized, center cropped to 192x192 JPEG thumbnail, quality 78.",
        "images": [],
    }
    for index, candidate in enumerate(sources["entries"], 1):
        image_id = candidate["id"]
        if not image_id.replace("-", "").isalnum() or image_id in seen:
            raise RuntimeError(f"Invalid or duplicated image identifier: {image_id}")
        seen.add(image_id)
        print(f"[{index:02d}/{len(sources['entries'])}] checking {image_id}: {candidate['file']}", flush=True)
        meta = commons_info(candidate["file"])
        blob = prepare(request(meta["download"], MAX_DOWNLOAD_BYTES))
        filename = image_id + ".jpg"
        (DEST / filename).write_bytes(blob)
        manifest["images"].append({
            "id": image_id, "file": "./" + filename, "label": candidate["label"],
            "keywords": candidate["keywords"], "sourceFile": candidate["file"],
            "sourcePage": meta["page"], "license": meta["license"],
            "licenseUrl": meta["licenseUrl"], "author": meta["author"],
            "modifications": manifest["transformation"],
            "sha256": hashlib.sha256(blob).hexdigest(),
            "bytes": len(blob),
        })
        print(f"       {meta['license']} | {len(blob):,} bytes | {meta['author'][:50]}", flush=True)
        time.sleep(.3)
    if len(manifest["images"]) < 12:
        raise RuntimeError("Fewer than 12 licensed image assets downloaded")
    (DEST / "catalog.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"COMPLETE: {len(manifest['images'])} CC0/public-domain thumbnails, "
          f"{sum(i['bytes'] for i in manifest['images']):,} bytes", flush=True)

if __name__ == "__main__":
    main()
