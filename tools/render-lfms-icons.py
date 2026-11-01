#!/usr/bin/env python3
"""Render user-approved LFMS SVG into PWA icons; retain previous Tempered icons."""
from pathlib import Path
from shutil import copy2
from PIL import Image
import cairosvg, io
root=Path(__file__).resolve().parents[1]
icons=root/'icons'
original=root/'branding/tempered-legacy'
original.mkdir(parents=True,exist_ok=True)
src=root/'branding/lfms/app-icon.svg'
for size in (180,512,1024):
    dest=icons/f'icon-{size}.png'
    legacy=original/f'icon-{size}.png'
    if not legacy.exists():
        copy2(dest,legacy)
    bitmap=cairosvg.svg2png(url=str(src),output_width=size,output_height=size)
    with Image.open(io.BytesIO(bitmap)) as check:
        assert check.size==(size,size)
        assert check.getpixel((size//2, 1))[:3] == (5,5,5)
    dest.write_bytes(bitmap)
    print(f'{dest.relative_to(root)} {len(bitmap):,} bytes')
print('Preserved original Tempered PWA icons in branding/tempered-legacy/')
