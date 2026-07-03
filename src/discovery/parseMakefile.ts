import { readFileSync } from "fs";
import type { MakeTarget } from "../model/types.js";

// `target: deps ## help text`
const HELP_RE = /^([a-zA-Z0-9_][a-zA-Z0-9_.-]*):[^=].*?##\s*(.+?)\s*$/;
// `target:` or `target: deps` (but not `VAR :=` / `VAR ?=` assignments)
const TARGET_RE = /^([a-zA-Z0-9_][a-zA-Z0-9_.-]*):(?![=])/;
const IGNORE = new Set([".PHONY", ".DEFAULT_GOAL", ".SILENT", ".NOTPARALLEL", ".PRECIOUS"]);

/** Extract make targets and their `## help` annotations, help-annotated first. */
export function parseMakefile(path: string): MakeTarget[] {
    let text: string;
    try {
        text = readFileSync(path, "utf8");
    } catch {
        return [];
    }
    const help = new Map<string, string>();
    const bare = new Map<string, string>();
    for (const line of text.split("\n")) {
        const h = line.match(HELP_RE);
        if (h) {
            if (!IGNORE.has(h[1])) help.set(h[1], h[2]);
            continue;
        }
        const t = line.match(TARGET_RE);
        if (t && !IGNORE.has(t[1]) && !bare.has(t[1])) bare.set(t[1], "");
    }
    const out: MakeTarget[] = [];
    for (const [name, helpText] of help) out.push({ name, help: helpText });
    for (const [name] of bare) {
        if (!help.has(name)) out.push({ name, help: "" });
    }
    return out;
}
