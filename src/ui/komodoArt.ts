// Turn the generated komodo sprite into truecolor half-block terminal lines.
import { KOMODO_SMALL, KOMODO_WORD } from "./komodoSprite.js";

type RGB = [number, number, number] | null;
const R = "\x1b[0m";

function parse(rows: string[]): RGB[][] {
    return rows.map((line) =>
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

function build(rows: string[]): string[] {
    const g = parse(rows);
    const has = (r: RGB[]) => r.some((p) => p !== null);
    while (g.length && !has(g[0])) g.shift();
    while (g.length && !has(g[g.length - 1])) g.pop();
    const w = Math.max(0, ...g.map((r) => r.length));
    const out: string[] = [];
    for (let y = 0; y < g.length; y += 2) {
        const top = g[y] ?? [];
        const bot = g[y + 1] ?? [];
        let s = "";
        for (let x = 0; x < w; x++) s += cell(top[x] ?? null, bot[x] ?? null);
        out.push(s);
    }
    return out;
}

export const KOMODO_LINES = build(KOMODO_SMALL);
export const KOMODO_HEIGHT = KOMODO_LINES.length;
export const KOMODO_WIDTH = Math.max(0, ...KOMODO_SMALL.map((r) => r.length / 6));

export const WORD_LINES = build(KOMODO_WORD);
export const WORD_WIDTH = Math.max(0, ...KOMODO_WORD.map((r) => r.length / 6));

// ---- boxed banner (komodo | wordmark + tips), version in the top border -----
const BORDER = "\x1b[38;5;71m"; // green (overall schema colour)
const DIM = "\x1b[38;5;244m"; // gray
const BOLD = "\x1b[1m";
const SEP_W = 3; // " │ " — vertical rule between the logo and the title
const TIPS_TITLE = "Tips for getting started";

/** Getting-started tips shown on the right; the key is highlighted in the schema colour. */
const TIPS: { key: string; rest: string }[] = [
    { key: "?", rest: "to see all keyboard shortcuts" },
    { key: ",", rest: "to choose which folders to manage" },
    { key: "/", rest: "to filter projects by name" },
];

const tipWidth = (t: { key: string; rest: string }) => "press ".length + t.key.length + 1 + t.rest.length;

/** Right column width: the title, its rule, the tips heading and the tip lines. */
const RIGHT_W = Math.max(WORD_WIDTH, TIPS_TITLE.length, ...TIPS.map(tipWidth));

/** Interior rows the banner occupies (max of the two columns). */
export const BANNER_INTERIOR_ROWS = Math.max(
    KOMODO_LINES.length + 2, // sprite + two grey status lines beneath it
    WORD_LINES.length + 2 + TIPS.length, // title + rule + tips heading + tips
);

/** Terminal columns the boxed banner needs (upper bound). */
export const BANNER_COLS = KOMODO_WIDTH + SEP_W + RIGHT_W + 4;

/**
 * @param statusLines grey lines rendered under the logo (versions, counts, …).
 */
export function bannerLines(statusLines: string[], version: string): string[] {
    const rightW = RIGHT_W;
    const leftW = Math.max(KOMODO_WIDTH, ...statusLines.map((s) => s.length));

    // Right column: the "Komodo" wordmark, a rule, then the getting-started tips.
    const right: { s: string; w: number }[] = [
        ...WORD_LINES.map((l) => ({ s: l, w: WORD_WIDTH })),
        { s: BORDER + "─".repeat(rightW) + R, w: rightW }, // horizontal line under the title
        { s: BOLD + BORDER + TIPS_TITLE + R, w: TIPS_TITLE.length },
        ...TIPS.map((t) => ({
            s: DIM + "press " + R + BORDER + t.key + R + DIM + " " + t.rest + R,
            w: tipWidth(t),
        })),
    ];

    // Left column: the logo, with the docker/status lines moved underneath it.
    const left: { s: string; w: number }[] = [
        ...KOMODO_LINES.map((l) => ({ s: l, w: KOMODO_WIDTH })),
        ...statusLines.map((s) => ({ s: DIM + s + R, w: s.length })),
    ];

    const H = Math.max(left.length, right.length);
    const innerW = leftW + SEP_W + rightW;
    const total = innerW + 2;
    const sep = " " + BORDER + "│" + R + " "; // vertical rule, display width SEP_W
    const out: string[] = [];
    // top border with the version centered in it
    const vseg = " " + version + " ";
    const lPad = Math.max(0, Math.floor((total - vseg.length) / 2));
    const rPad = Math.max(0, total - vseg.length - lPad);
    out.push(
        BORDER + "╭" + "─".repeat(lPad) + R + DIM + vseg + R + BORDER + "─".repeat(rPad) + "╮" + R,
    );
    out.push(BORDER + "│" + R + " ".repeat(total) + BORDER + "│" + R); // top padding
    for (let i = 0; i < H; i++) {
        const l = left[i];
        const r = right[i];
        const lpad = (l ? l.s : "") + " ".repeat(leftW - (l ? l.w : 0));
        const rpad = (r ? r.s : "") + " ".repeat(rightW - (r ? r.w : 0));
        out.push(BORDER + "│ " + R + lpad + sep + rpad + BORDER + " │" + R);
    }
    out.push(BORDER + "╰" + "─".repeat(total) + "╯" + R);
    return out;
}

