#!/usr/bin/env python3
# Generate the komodo from shapes. Because it's vector-ish, we can re-rasterize
# at any size (crisp) instead of downscaling a bitmap (mushy).
# Outputs: komodo.png/.rows (full) and komodo_small.png/.rows (banner).
from PIL import Image, ImageDraw

BW, BH = 92, 42  # base resolution
VIEW = 9         # upscale factor for the .png previews

C = {
    'G': (120, 224, 118),  # highlight (light green)
    'g': (58, 198, 94),    # base mid green
    'd': (36, 150, 66),    # shadow green
    'm': (20, 98, 48),     # deep shadow / far parts
    'K': (18, 20, 18),     # outline
    'w': (250, 250, 250),  # eye
    'p': (16, 16, 16),     # pupil
    'r': (232, 96, 50),    # tongue
}


def build(scale):
    W, H = round(BW * scale), round(BH * scale)
    img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    dr = ImageDraw.Draw(img)
    S = lambda v: round(v * scale)
    P = lambda pts: [(S(x), S(y)) for (x, y) in pts]

    def poly(pts, col):
        dr.polygon(P(pts), fill=C[col] + (255,))

    def ell(box, col):
        dr.ellipse([S(box[0]), S(box[1]), S(box[2]), S(box[3])], fill=C[col] + (255,))

    def line(a, b, col, w=1):
        dr.line(P([a, b]), fill=C[col] + (255,), width=max(1, round(w * scale)))

    def point(x, y, col):
        dr.rectangle([S(x), S(y), S(x) + max(0, round(scale) - 1), S(y) + max(0, round(scale) - 1)],
                     fill=C[col] + (255,))

    def foot(x, y, col):
        poly([(x - 2, y - 3), (x + 3, y - 3), (x + 4, y), (x + 2, y),
              (x + 1, y - 1), (x, y), (x - 2, y), (x - 3, y - 1)], col)

    # far legs (behind)
    for fx in (34, 58):
        poly([(fx, 24), (fx + 5, 24), (fx + 4, 31), (fx + 1, 31)], 'm')
        foot(fx + 2, 33, 'm')

    # main silhouette (thin curled tail tip)
    poly([
        (5, 34), (5, 30), (9, 26), (14, 22), (20, 19), (27, 17),
        (34, 15), (43, 14), (53, 14), (61, 13),
        (67, 12), (73, 12), (79, 14), (84, 18),
        (78, 20), (71, 21), (63, 21),
        (55, 22), (47, 24), (37, 25), (29, 25),
        (22, 24), (16, 26), (11, 29), (7, 32),
    ], 'g')

    # shading
    poly([(21, 23), (55, 23), (61, 21), (63, 24), (47, 26), (31, 26), (19, 25)], 'd')
    poly([(27, 25), (49, 25), (45, 27), (31, 27)], 'm')
    poly([(6, 33), (10, 28), (16, 24), (18, 26), (12, 30), (8, 33)], 'd')  # tail underside
    poly([(26, 15), (52, 14), (58, 14), (44, 16), (30, 17)], 'G')          # back highlight
    poly([(64, 12), (74, 13), (72, 15), (66, 15)], 'G')                    # head highlight

    # near legs (bent, splayed)
    for lx in (26, 50):
        poly([(lx, 22), (lx + 6, 22), (lx + 7, 27), (lx + 5, 31), (lx + 1, 31), (lx - 1, 27)], 'g')
        poly([(lx + 4, 26), (lx + 7, 27), (lx + 5, 31), (lx + 3, 31)], 'd')
        foot(lx + 3, 33, 'g')

    # head + eye + mouth
    poly([(71, 15), (84, 18), (78, 20), (71, 20), (67, 18)], 'd')
    ell((74, 14, 76, 16), 'w')
    line((76, 19), (83, 19), 'm')
    # pupil, tongue, and leg-gap separators are pixel-precise, so they are applied
    # per output size in finish() rather than scaled here.

    # mottling
    for pts in [
        [(30, 17), (34, 16), (35, 19), (31, 20)],
        [(41, 18), (45, 17), (46, 20), (42, 21)],
        [(52, 17), (56, 17), (56, 19), (52, 19)],
        [(24, 20), (27, 20), (27, 22), (24, 22)],
        [(63, 16), (66, 16), (66, 18), (63, 18)],
    ]:
        poly(pts, 'd')

    # 1px outline around the silhouette
    px = img.load()
    op = [[px[x, y][3] > 0 for x in range(W)] for y in range(H)]
    edge = []
    for y in range(H):
        for x in range(W):
            if op[y][x]:
                continue
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    ny, nx = y + dy, x + dx
                    if 0 <= ny < H and 0 <= nx < W and op[ny][nx]:
                        edge.append((x, y))
                        break
                else:
                    continue
                break
    for (x, y) in edge:
        px[x, y] = C['K'] + (255,)
    return img


def finish(img, pupil, gaps, tongue, greenify=()):
    """Apply pixel-precise details in the image's own coordinates.
    pupil:    (x, y)            black pupil pixel
    gaps:     [(x, y), ...]     black leg-separator pixels
    tongue:   [(x, y), ...]     red tongue pixels (auto black-outlined here)
    greenify: [(x, y), ...]     pixels to repaint light green (fix stray blacks)
    """
    px = img.load()
    W, H = img.size
    for (x, y) in greenify:
        px[x, y] = C['G'] + (255,)
    px[pupil[0], pupil[1]] = C['p'] + (255,)
    for (x, y) in gaps:
        px[x, y] = C['K'] + (255,)
    for (x, y) in tongue:
        px[x, y] = C['r'] + (255,)
    tongue_set = set(tongue)
    for (x, y) in tongue:                       # 1px black outline around the tongue
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                nx, ny = x + dx, y + dy
                if 0 <= nx < W and 0 <= ny < H and (nx, ny) not in tongue_set \
                        and px[nx, ny][3] == 0:
                    px[nx, ny] = C['K'] + (255,)
    return img


def export(img, png, rows_path):
    W, H = img.size
    px = img.load()
    lines = [''.join('------' if px[x, y][3] == 0 else '%02x%02x%02x' % px[x, y][:3]
                     for x in range(W)) for y in range(H)]
    with open(rows_path, 'w') as f:
        f.write('\n'.join(lines) + '\n')
    bg = Image.new('RGB', (W, H), (43, 47, 56))
    bg.paste(img, (0, 0), img)
    bg.resize((W * VIEW, H * VIEW), Image.NEAREST).save(png)
    return lines


# 5x7 pixel font for the wordmark
FONT = {
    'K': ["#...#", "#..#.", "#.#..", "##...", "#.#..", "#..#.", "#...#"],
    'O': [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
    'M': ["#...#", "##.##", "#.#.#", "#.#.#", "#...#", "#...#", "#...#"],
    'D': ["###..", "#..#.", "#...#", "#...#", "#...#", "#..#.", "###.."],
}


def render_word(text, gap=1):
    """Render TEXT as pixel rows (RRGGBB / ------), coloured with a diagonal
    green gradient matching the komodo (light top-left -> dark bottom-right)."""
    H = 7
    grid = []
    for r in range(H):
        cells = []
        for i, ch in enumerate(text):
            cells.append(FONT[ch.upper()][r])
            if i < len(text) - 1:
                cells.append('.' * gap)
        grid.append(''.join(cells))
    W = len(grid[0])
    light, dark = (160, 244, 160), (28, 140, 66)
    out = []
    for y in range(H):
        row = []
        for x in range(W):
            if grid[y][x] == '#':
                t = ((x / (W - 1)) + (y / (H - 1))) / 2
                col = tuple(round(light[k] + (dark[k] - light[k]) * t) for k in range(3))
                row.append('%02x%02x%02x' % col)
            else:
                row.append('------')
        out.append(''.join(row))
    return out


if __name__ == '__main__':
    import json
    full = build(1.0)
    finish(full,
           pupil=(76, 15),
           gaps=[],  # legs are already separated at full resolution
           # symmetric bifid fork
           tongue=[(86, 18), (87, 18), (88, 18), (89, 17), (90, 17), (89, 19), (90, 19)],
           greenify=[(26, 16), (27, 16)])
    small = build(0.55)
    # pad the right edge so the tongue tip can get a black outline on its right too
    padded = Image.new('RGBA', (small.width + 2, small.height), (0, 0, 0, 0))
    padded.paste(small, (0, 0))
    small = padded
    finish(small,
           pupil=(42, 9),
           gaps=[(18, 16), (18, 17), (31, 16), (31, 17)],
           # 2px stem, then a 1px bifid fork
           tongue=[(48, 10), (49, 10), (50, 9), (50, 11)],
           greenify=[(14, 9)])
    full_lines = export(full, 'scripts/komodo.png', 'scripts/komodo.rows')
    small_lines = export(small, 'scripts/komodo_small.png', 'scripts/komodo_small.rows')
    with open('src/ui/komodoSprite.ts', 'w') as f:
        f.write('// Auto-generated by scripts/komodo_gen.py — do not edit by hand.\n')
        for name, lines in [('KOMODO_FULL', full_lines), ('KOMODO_SMALL', small_lines),
                            ('KOMODO_WORD', render_word('KOMODO'))]:
            f.write(f'export const {name}: string[] = [\n')
            for l in lines:
                f.write('    ' + json.dumps(l) + ',\n')
            f.write('];\n')
    print(f'full {full.size}  small {small.size}  -> src/ui/komodoSprite.ts')
