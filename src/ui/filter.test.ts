import { test, expect } from "bun:test";
import { fuzzyScore, fuzzyFilter } from "./filter.js";

test("empty query scores 0 and keeps items", () => {
    expect(fuzzyScore("", "anything")).toBe(0);
    expect(fuzzyFilter(["a", "b"], "", (x) => x)).toEqual(["a", "b"]);
});

test("subsequence matches, non-subsequence rejected", () => {
    expect(fuzzyScore("abc", "aXbXc")).not.toBeNull();
    expect(fuzzyScore("abc", "acb")).toBeNull();
    expect(fuzzyScore("xyz", "abc")).toBeNull();
});

test("case insensitive", () => {
    expect(fuzzyScore("API", "my-api-service")).not.toBeNull();
});

test("contiguous and start matches rank higher", () => {
    const contiguous = fuzzyScore("shop", "shop-frontend")!;
    const scattered = fuzzyScore("shop", "s-h-o-p-x")!;
    expect(contiguous).toBeGreaterThan(scattered);
});

test("fuzzyFilter ranks best match first and is stable on ties", () => {
    const items = ["order-flow", "shop", "shop-frontend"];
    const out = fuzzyFilter(items, "shop", (x) => x);
    expect(out[0]).toBe("shop");
    expect(out).not.toContain("order-flow");
});
