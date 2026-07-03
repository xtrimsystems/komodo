import { test, expect } from "bun:test";
import { compareVersions, assetName } from "./update.js";

test("compareVersions handles v-prefix and ordering", () => {
    expect(compareVersions("v0.1.1", "0.1.0")).toBeGreaterThan(0);
    expect(compareVersions("0.1.0", "v0.1.1")).toBeLessThan(0);
    expect(compareVersions("v1.2.3", "v1.2.3")).toBe(0);
});

test("compareVersions compares numerically, not lexically", () => {
    expect(compareVersions("0.10.0", "0.9.0")).toBeGreaterThan(0);
    expect(compareVersions("1.0.0", "0.99.99")).toBeGreaterThan(0);
});

test("compareVersions tolerates differing segment counts", () => {
    expect(compareVersions("1.2", "1.2.0")).toBe(0);
    expect(compareVersions("1.2.1", "1.2")).toBeGreaterThan(0);
});

test("assetName maps the current platform or returns null", () => {
    const name = assetName();
    if (name !== null) expect(name).toMatch(/^komodo-(linux|darwin)-(x64|arm64)$/);
});
