#!/usr/bin/env python3
# Preview the komodo sprite as a PNG so it can be eyeballed at true colour.
# Draw only the fill in scripts/komodo.map; the outline is added automatically.
from PIL import Image

PAL = {
    'K': (20, 20, 20),     # outline (auto)
    'm': (22, 92, 40),     # mouth / deep shadow (very dark green)
    'd': (30, 145, 58),    # dark green (belly / far legs)
    'g': (54, 200, 84),    # mid green (body) — bright & saturated
    'G': (108, 226, 110),  # bright green
    'l': (182, 242, 168),  # light green (top highlight)
    'w': (250, 250, 250),  # eye white
    'p': (16, 16, 16),     # pupil
    'r': (235, 96, 50),    # tongue
}
BG = (43, 47, 56)
FILL = set(PAL) - {'K'}


def load(path):
    with open(path) as f:
        lines = [l.rstrip('\n') for l in f]
    while lines and lines[-1].strip() == '':
        lines.pop()
    w = max(len(l) for l in lines)
    return [list(l.ljust(w)) for l in lines], w, len(lines)


def outline(grid, w, h):
    out = [row[:] for row in grid]
    for y in range(h):
        for x in range(w):
            if grid[y][x] in ' .':
                for dy in (-1, 0, 1):
                    for dx in (-1, 0, 1):
                        ny, nx = y + dy, x + dx
                        if 0 <= ny < h and 0 <= nx < w and grid[ny][nx] in FILL:
                            out[y][x] = 'K'
                            break
                    else:
                        continue
                    break
    return out


def main():
    grid, w, h = load('scripts/komodo.map')
    grid = outline(grid, w, h)
    scale = 12
    img = Image.new('RGB', (w * scale, h * scale), BG)
    px = img.load()
    for y in range(h):
        for x in range(w):
            c = grid[y][x]
            if c in ' .':
                continue
            col = PAL.get(c, (255, 0, 255))
            for yy in range(scale):
                for xx in range(scale):
                    px[x * scale + xx, y * scale + yy] = col
    img.save('scripts/komodo.png')
    print(f'saved scripts/komodo.png ({w}x{h} px)')


if __name__ == '__main__':
    main()
