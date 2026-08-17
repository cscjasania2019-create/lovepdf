"""Image tools: compression and background removal."""
import io
import os

import httpx
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import Response

router = APIRouter(prefix="/api/image", tags=["image-tools"])

ALLOWED = {"image/jpeg", "image/png", "image/webp"}
MAX_BYTES = 20 * 1024 * 1024
REMOVE_BG_URL = "https://api.remove.bg/v1.0/removebg"


async def _read_image(file: UploadFile) -> bytes:
    data = await file.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise HTTPException(413, "Image exceeds the 20 MB upload limit.")
    if not data:
        raise HTTPException(400, "Empty file.")
    from PIL import Image
    try:
        with Image.open(io.BytesIO(data)) as im:
            im.verify()
    except Exception:
        raise HTTPException(415, "Invalid or corrupt image.")
    return data


@router.post("/compress")
async def compress_image(file: UploadFile = File(...), quality: int = Form(75), max_width: int = Form(0)):
    from PIL import Image
    data = await _read_image(file)
    quality = max(5, min(95, quality))
    im = Image.open(io.BytesIO(data))
    fmt = (im.format or "JPEG").upper()
    if max_width and im.width > max_width:
        im = im.resize((max_width, int(im.height * max_width / im.width)), Image.LANCZOS)
    buf = io.BytesIO()
    if fmt == "PNG":
        has_alpha = im.mode in ("RGBA", "LA") or (im.mode == "P" and "transparency" in im.info)
        if has_alpha:
            im.convert("RGBA").quantize(colors=max(16, int(256 * quality / 95)), method=Image.FASTOCTREE).save(buf, "PNG", optimize=True)
            media, ext = "image/png", "png"
        else:
            im.convert("RGB").save(buf, "JPEG", quality=quality, optimize=True)
            media, ext = "image/jpeg", "jpg"
    elif fmt == "WEBP":
        im.save(buf, "WEBP", quality=quality)
        media, ext = "image/webp", "webp"
    else:
        if im.mode != "RGB":
            im = im.convert("RGB")
        im.save(buf, "JPEG", quality=quality, optimize=True)
        media, ext = "image/jpeg", "jpg"
    out = buf.getvalue()
    if len(out) >= len(data):
        out, media = data, file.content_type or "application/octet-stream"
        ext = (file.filename or "img.jpg").rsplit(".", 1)[-1]
    stem = (file.filename or "image").rsplit(".", 1)[0]
    return Response(content=out, media_type=media, headers={
        "Content-Disposition": f'attachment; filename="{stem}_compressed.{ext}"',
    })


@router.post("/remove-bg")
async def remove_background(file: UploadFile = File(...)):
    if file.content_type not in ALLOWED:
        raise HTTPException(415, "Upload a JPEG, PNG or WebP image.")
    api_key = os.environ.get("REMOVEBG_API_KEY")
    if not api_key:
        raise HTTPException(500, "Background removal is not configured.")
    data = await _read_image(file)
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(90.0, connect=10.0)) as client:
            upstream = await client.post(
                REMOVE_BG_URL,
                headers={"X-Api-Key": api_key},
                files={"image_file": (file.filename or "upload", data, file.content_type)},
                data={"size": "auto", "format": "png"},
            )
    except httpx.TimeoutException:
        raise HTTPException(504, "Background removal timed out. Try a smaller image.")
    except httpx.RequestError:
        raise HTTPException(502, "Could not reach the background removal service.")
    if upstream.status_code == 429:
        raise HTTPException(429, "Monthly background-removal quota reached. Try again later.")
    if upstream.status_code in (401, 403):
        raise HTTPException(502, "Background removal API key was rejected.")
    if upstream.status_code != 200:
        detail = "Could not process this image."
        try:
            detail = upstream.json()["errors"][0]["title"]
        except Exception:
            pass
        raise HTTPException(502, f"Background removal failed: {detail}")
    stem = (file.filename or "image").rsplit(".", 1)[0]
    return Response(content=upstream.content, media_type="image/png", headers={
        "Content-Disposition": f'attachment; filename="{stem}_no_bg.png"',
    })
