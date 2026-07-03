import { test, expect, beforeAll, afterAll } from "bun:test";
import { mkdtempSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { parseMakefile } from "./parseMakefile.js";

let dir: string;
beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "komodo-mk-"));
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

function write(content: string): string {
    const path = join(dir, "Makefile");
    writeFileSync(path, content);
    return path;
}

test("extracts help-annotated and bare targets, help first", () => {
    const path = write(
        [
            ".PHONY: up",
            "up: ## Start the stack",
            "\tdocker compose up -d",
            "clean:",
            "\trm -rf tmp",
            "VERSION := 1.0",
            "PORT ?= 3000",
        ].join("\n"),
    );
    const targets = parseMakefile(path);
    const names = targets.map((t) => t.name);
    expect(names).toContain("up");
    expect(names).toContain("clean");
    expect(names).not.toContain("VERSION");
    expect(names).not.toContain("PORT");
    expect(targets.find((t) => t.name === "up")?.help).toBe("Start the stack");
    expect(targets[0].name).toBe("up");
});

test("ignores special targets and missing files", () => {
    const path = write(".PHONY: a\n.DEFAULT_GOAL := help\na:\n\techo hi\n");
    expect(parseMakefile(path).map((t) => t.name)).toEqual(["a"]);
    expect(parseMakefile(join(dir, "nope"))).toEqual([]);
});
