import { test, expect, beforeAll, afterAll } from "bun:test";
import { mkdtempSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { parseComposeServices } from "./parseCompose.js";

let dir: string;
beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "komodo-compose-"));
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

function write(file: string, content: string): string {
    const path = join(dir, file);
    writeFileSync(path, content);
    return path;
}

test("parses services and image, picks up top-level name", () => {
    const path = write(
        "base.yml",
        ["name: myproj", "services:", "  web:", "    image: nginx", "  db:", "    image: postgres"].join("\n"),
    );
    const { services, projectName } = parseComposeServices([path]);
    expect(projectName).toBe("myproj");
    expect(services.map((s) => s.name).sort()).toEqual(["db", "web"]);
    expect(services.find((s) => s.name === "web")?.image).toBe("nginx");
});

test("merges services across files and fills missing image", () => {
    const base = write("a.yml", "services:\n  web:\n    build: .\n");
    const override = write("b.yml", "services:\n  web:\n    image: nginx\n  extra:\n    image: redis\n");
    const { services } = parseComposeServices([base, override]);
    expect(services.map((s) => s.name).sort()).toEqual(["extra", "web"]);
    expect(services.find((s) => s.name === "web")?.image).toBe("nginx");
});

test("ignores unparseable files", () => {
    const bad = write("bad.yml", ":\n  - not valid: [yaml");
    const { services } = parseComposeServices([bad]);
    expect(services).toEqual([]);
});
