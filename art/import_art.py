#!/usr/bin/env python3
"""
Tempered art importer.

Drop a folder of PNGs named per docs/08-art.md (hero.png, enemy_slime.png,
glyph_might.png, item_ring.png ...). This keys out the flat magenta background,
removes model watermarks, trims, scales each family to its target size, and writes
the results to art/dist/.

    python3 art/import_art.py ./incoming

You do not need to match sizes or framing precisely. This handles it.

Notes:
- Generate on flat magenta (#FF00FF); image models rarely return real alpha.
- Small disconnected blobs are dropped, which removes corner watermarks that would
  otherwise expand the bounding box and wreck centring.
- Edge pixels carrying the key colour are despilled rather than left semi-transparent,
  which is what causes magenta halos around thin geometry.
"""
import sys, os, json, base64, io, math
from PIL import Image

TW, TH = 88, 44

# target height in engine pixels, by sprite family
TARGET = {
  'hero':   240,   # battle hero, also used at 2x on the character screen
  'enemy_': 220,   # battle enemies
  'item_':   96,   # loot icons
  'glyph_':  96,   # attribute glyphs, recoloured in CSS
  'icon_':  512,   # app icon
}
def target_h(name):
    for k in sorted(TARGET, key=len, reverse=True):
        if name.startswith(k) or name == k: return TARGET[k]
    return 80


def key_background(im, tol=42):
    """Remove a flat background colour (magenta, white, grey) if the image has no alpha.

    Image models rarely return real transparency. Generate on flat magenta and this
    lifts it cleanly, including the halo of blended pixels around the edges."""
    im = im.convert("RGBA")
    px = im.load(); W, H = im.size
    # already transparent? leave it alone
    corners = [px[0,0], px[W-1,0], px[0,H-1], px[W-1,H-1]]
    if all(c[3] < 16 for c in corners): return im
    # background colour = the most common corner
    from collections import Counter
    bg = Counter([c[:3] for c in corners]).most_common(1)[0][0]
    br, bg_, bb = bg
    def near(c, t):
        return abs(c[0]-br) <= t and abs(c[1]-bg_) <= t and abs(c[2]-bb) <= t
    # flood from the border so background colours *inside* the object survive
    seen = bytearray(W*H)
    stack = [(x,0) for x in range(W)] + [(x,H-1) for x in range(W)] \
          + [(0,y) for y in range(H)] + [(W-1,y) for y in range(H)]
    while stack:
        x, y = stack.pop()
        if x < 0 or y < 0 or x >= W or y >= H: continue
        i = y*W + x
        if seen[i]: continue
        if not near(px[x,y], tol): continue
        seen[i] = 1; px[x,y] = (0,0,0,0)
        stack += [(x+1,y),(x-1,y),(x,y+1),(x,y-1)]
    # despill: strip the key colour's cast from edge pixels instead of keeping them
    # semi-transparent, which is what produced pink halos around thin geometry
    key_hi = [i for i,v in enumerate((br,bg_,bb)) if v > 128]
    key_lo = [i for i,v in enumerate((br,bg_,bb)) if v <= 128]
    for y in range(H):
        for x in range(W):
            c = px[x,y]
            if c[3] == 0: continue
            if near(c, tol):                        # missed by the flood fill
                px[x,y] = (0,0,0,0); continue
            if key_hi and key_lo:
                spill = min(c[i] for i in key_hi) - max(c[i] for i in key_lo)
                if spill > 24:                      # clearly carrying the key colour
                    lo = max(c[i] for i in key_lo)
                    rgb = list(c[:3])
                    for i in key_hi: rgb[i] = min(rgb[i], lo + 12)
                    px[x,y] = (rgb[0], rgb[1], rgb[2], c[3] if spill < 90 else 110)
    return im


def drop_specks(im, min_frac=0.02):
    """Remove small disconnected blobs — model watermarks, stray sparkles, dust.

    These wreck framing: a corner watermark expands the bounding box, so trimming
    centres the sprite on the watermark instead of the character."""
    im = im.convert("RGBA"); px = im.load(); W, H = im.size
    seen = bytearray(W*H); comps = []
    for sy in range(H):
        for sx in range(W):
            i0 = sy*W + sx
            if seen[i0] or px[sx,sy][3] < 24: continue
            stack=[(sx,sy)]; cells=[]
            seen[i0]=1
            while stack:
                x,y = stack.pop(); cells.append((x,y))
                for dx,dy in ((1,0),(-1,0),(0,1),(0,-1),(1,1),(-1,-1),(1,-1),(-1,1)):
                    nx,ny = x+dx, y+dy
                    if 0<=nx<W and 0<=ny<H:
                        j = ny*W+nx
                        if not seen[j] and px[nx,ny][3] >= 24:
                            seen[j]=1; stack.append((nx,ny))
            comps.append(cells)
    if not comps: return im
    biggest = max(len(c) for c in comps)
    removed = 0
    for c in comps:
        if len(c) < biggest * min_frac:
            for x,y in c: px[x,y] = (0,0,0,0)
            removed += 1
    if removed: print(f'    (dropped {removed} stray blob{"s" if removed>1 else ""})')
    return im

def trim(im):
    bb = im.getbbox()
    return im.crop(bb) if bb else im

def prep_floor(im):
    """Fit art into the 88x44 diamond and clear anything outside it."""
    im = trim(im).convert("RGBA")
    im = im.resize((TW, TH), Image.LANCZOS)
    px = im.load()
    for y in range(TH):
        for x in range(TW):
            if abs(x-TW/2)/(TW/2) + abs(y-TH/2)/(TH/2) > 1.0:
                px[x, y] = (0, 0, 0, 0)
    return im

def prep_object(im, name):
    """Scale to the family's target height. Anchoring happens at draw time."""
    im = trim(im).convert("RGBA")
    h = target_h(name)
    w = max(1, round(im.width * h / im.height))
    if w > TW * 2.2:                      # never wider than about two tiles
        w = int(TW * 2.2); h = max(1, round(im.height * w / im.width))
    return im.resize((w, h), Image.LANCZOS)

def load_incoming(folder):
    out = {}
    for fn in sorted(os.listdir(folder)):
        if not fn.lower().endswith(('.png', '.webp')): continue
        name = os.path.splitext(fn)[0]
        im = drop_specks(key_background(Image.open(os.path.join(folder, fn))))
        if im.getbbox() is None:
            print(f'  ! {name}: image is entirely transparent, skipped'); continue
        out[name] = prep_floor(im) if (name.startswith('land_') or name.startswith('hfloor_')) \
                    else prep_object(im, name)
        print(f'  + {name}  ->  {out[name].width}x{out[name].height}')
    return out

def pack(sprites, out_png, out_json, width=1024):
    pad = 2
    order = sorted(sprites.items(), key=lambda kv: -kv[1].height)
    x = y = rowh = 0; man = {}
    for name, im in order:
        if x + im.width + pad > width:
            x = 0; y += rowh + pad; rowh = 0
        man[name] = [x, y, im.width, im.height]
        x += im.width + pad; rowh = max(rowh, im.height)
    atlas = Image.new("RGBA", (width, y + rowh + pad), (0, 0, 0, 0))
    for name, im in order:
        px_, py_, w, h = man[name]; atlas.paste(im, (px_, py_))
    atlas.save(out_png)
    json.dump(man, open(out_json, 'w'), separators=(',', ':'))
    return atlas, man

def embed(html_path, png_path, man):
    import re
    s = open(html_path).read()
    b64 = base64.b64encode(open(png_path, 'rb').read()).decode()
    s = re.sub(r'const ATLAS_MAP=\{.*?\};',
               'const ATLAS_MAP=' + json.dumps(man, separators=(',', ':')) + ';',
               s, count=1, flags=re.S)
    s = re.sub(r"const ATLAS_SRC='data:image/png;base64,[^']*';",
               "const ATLAS_SRC='data:image/png;base64," + b64 + "';", s, count=1)
    open(html_path, 'w').write(s)
    return len(s)

if __name__ == '__main__':
    folder = sys.argv[1]
    print('reading new art from', folder)
    new = load_incoming(folder)

    existing = {}
    if os.path.exists('atlas.png') and os.path.exists('atlas.json'):
        old_img = Image.open('atlas.png'); old_man = json.load(open('atlas.json'))
        for n, (x, y, w, h) in old_man.items():
            existing[n] = old_img.crop((x, y, x + w, y + h))

    kept = [n for n in existing if n not in new]
    merged = {**existing, **new}
    atlas, man = pack(merged, 'atlas.png', 'atlas.json')

    print(f'\nreplaced {len(new)} sprites, kept {len(kept)} procedural')
    if kept: print('still procedural:', ', '.join(sorted(kept)[:14]) + ('…' if len(kept) > 14 else ''))
    print(f'atlas {atlas.size}, {os.path.getsize("atlas.png")} bytes, {len(man)} sprites')

    if '--embed' in sys.argv:
        html = sys.argv[sys.argv.index('--embed') + 1]
        n = embed(html, 'atlas.png', man)
        print(f'patched {html} -> {n} bytes')
