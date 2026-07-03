import { test, expect } from "bun:test";
import { parsePorts, computeStats } from "./engine.js";

test("parsePorts keeps published ports, drops unpublished, dedupes, sorts", () => {
    const ports = parsePorts([
        { PrivatePort: 80, Type: "tcp" },
        { PrivatePort: 5432, PublicPort: 5432, Type: "tcp" },
        { IP: "0.0.0.0", PrivatePort: 80, PublicPort: 8080, Type: "tcp" },
        { IP: "::", PrivatePort: 80, PublicPort: 8080, Type: "tcp" },
    ]);
    expect(ports).toEqual([
        { public: 5432, private: 5432, type: "tcp" },
        { public: 8080, private: 80, type: "tcp" },
    ]);
});

test("parsePorts handles missing input", () => {
    expect(parsePorts(undefined as unknown as any[])).toEqual([]);
    expect(parsePorts([])).toEqual([]);
});

test("computeStats derives cpu% and memory from a stats sample", () => {
    const s = computeStats({
        cpu_stats: {
            cpu_usage: { total_usage: 200 },
            system_cpu_usage: 2000,
            online_cpus: 2,
        },
        precpu_stats: {
            cpu_usage: { total_usage: 100 },
            system_cpu_usage: 1000,
        },
        memory_stats: { usage: 200, limit: 1000, stats: { inactive_file: 50 } },
    });
    expect(s).not.toBeNull();
    expect(s!.cpu).toBeCloseTo(20, 5);
    expect(s!.memUsed).toBe(150);
    expect(s!.memLimit).toBe(1000);
});

test("computeStats returns null without cpu samples", () => {
    expect(computeStats({})).toBeNull();
});
