#!/usr/bin/env python3
# Compare ways to make the komodo small, at the SAME target width, so the
# quality trade-off is visible. Saves scripts/komodo_compare.png.
from PIL import Image, ImageDraw
from komodo_gen import build

BW = 92
TARGET_W = 50                       # banner-ish width in px
th = round(42 * TARGET_W / BW)
VIEW = 10
BG = (43, 47, 56)

full = build(1.0)                                        # 92x42, the detailed one
variants = [
    ("full detail (92px, ~15 lines)", full),
    ("re-rendered from shapes @50px", build(TARGET_W / BW)),
    ("bitmap downscale NEAREST @50px", full.resize((TARGET_W, th), Image.NEAREST)),
    ("bitmap downscale SMOOTH @50px", full.resize((TARGET_W, th), Image.LANCZOS)),
]

pad = 8
label_h = 16
col_w = max(im.size[0] for _, im in variants) * VIEW + pad * 2
row_h = full.size[1] * VIEW + label_h + pad
canvas = Image.new('RGB', (col_w, row_h * len(variants)), BG)
dr = ImageDraw.Draw(canvas)

y = 0
for label, im in variants:
    dr.text((pad, y + 4), label, fill=(220, 220, 220))
    up = im.resize((im.size[0] * VIEW, im.size[1] * VIEW), Image.NEAREST)
    over = Image.new('RGB', up.size, BG)
    over.paste(up, (0, 0), up)
    canvas.paste(over, (pad, y + label_h))
    y += row_h

canvas.save('scripts/komodo_compare.png')
print('saved scripts/komodo_compare.png')
