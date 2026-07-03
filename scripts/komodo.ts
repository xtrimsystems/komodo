// Render the komodo sprite (scripts/komodo.rows, produced by komodo_gen.py) as
// truecolor half-block terminal art — each cell shows two vertical pixels.
// Run: make komodo   (regenerate the sprite first with: make komodo-gen)
import { readFileSync } from "fs";

const R = "\x1b[0m";
type RGB = [number, number, number] | null;

function loadRows(path: string): RGB[][] {
    return readFileSync(path, "utf8")
        .replace(/\n+$/, "")
        .split("\n")
        .map((line) =>
            (line.match(/.{6}/g) ?? []).map((c) =>
                c === "------"
                    ? null
                    : ([
                          parseInt(c.slice(0, 2), 16),
                          parseInt(c.slice(2, 4), 16),
                          parseInt(c.slice(4, 6), 16),
                      ] as RGB),
            ),
        );
}

function cell(t: RGB, b: RGB): string {
    if (!t && !b) return " ";
    if (t && !b) return `\x1b[38;2;${t[0]};${t[1]};${t[2]}m▀${R}`;
    if (!t && b) return `\x1b[38;2;${b[0]};${b[1]};${b[2]}m▄${R}`;
    return `\x1b[38;2;${t![0]};${t![1]};${t![2]}m\x1b[48;2;${b![0]};${b![1]};${b![2]}m▀${R}`;
}

const rows = loadRows(process.argv[2] ?? "scripts/komodo.rows");
// trim fully-transparent border rows so the preview is tight
const hasPixel = (r: RGB[]) => r.some((p) => p !== null);
while (rows.length && !hasPixel(rows[0])) rows.shift();
while (rows.length && !hasPixel(rows[rows.length - 1])) rows.pop();
const width = Math.max(...rows.map((r) => r.length));
console.log();
for (let y = 0; y < rows.length; y += 2) {
    const top = rows[y] ?? [];
    const bot = rows[y + 1] ?? [];
    let line = " ";
    for (let x = 0; x < width; x++) line += cell(top[x] ?? null, bot[x] ?? null);
    console.log(line);
}
console.log();
