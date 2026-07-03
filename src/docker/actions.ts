import type { Project } from "../model/types.js";
import { runStreaming, type RunResult } from "./run.js";

type Sink = (line: string) => void;

/**
 * Compose commands are run inside the project directory WITHOUT explicit `-f`
 * flags, so `docker compose` applies its default file resolution (base +
 * docker-compose.override.yml) — matching what the project's own `make up` does.
 * Specialized files (.dist, .localstack, .agent) are intentionally not forced in;
 * use the make palette for those bespoke setups.
 */
export function composeUp(p: Project, onLine: Sink, signal?: AbortSignal): Promise<RunResult> {
    return runStreaming(["docker", "compose", "up", "-d"], { cwd: p.dir, onLine, signal });
}

export function composeStop(p: Project, onLine: Sink, signal?: AbortSignal): Promise<RunResult> {
    return runStreaming(["docker", "compose", "stop"], { cwd: p.dir, onLine, signal });
}

export function composeDown(p: Project, onLine: Sink, signal?: AbortSignal): Promise<RunResult> {
    return runStreaming(["docker", "compose", "down"], { cwd: p.dir, onLine, signal });
}

export function composeRestart(p: Project, onLine: Sink, signal?: AbortSignal): Promise<RunResult> {
    return runStreaming(["docker", "compose", "restart"], { cwd: p.dir, onLine, signal });
}

/**
 * Stream `docker compose logs -f` for a whole project or a single service.
 * Long-running; pass a signal to stop it (e.g. when leaving the logs screen).
 */
export function composeLogs(
    p: Project,
    service: string | undefined,
    onLine: Sink,
    signal: AbortSignal,
): Promise<RunResult> {
    const args = ["docker", "compose", "logs", "--no-color", "--tail=200", "-f"];
    if (service) args.push(service);
    return runStreaming(args, { cwd: p.dir, onLine, signal });
}

/** Build the argv for an interactive shell into a running service container. */
export function composeExecShell(service: string): string[] {
    return [
        "docker",
        "compose",
        "exec",
        service,
        "sh",
        "-c",
        "if command -v bash >/dev/null 2>&1; then exec bash; else exec sh; fi",
    ];
}

/**
 * Read the Docker Compose plugin version (e.g. "2.29.0"). Compose is a client-side
 * CLI plugin, so it isn't reported by the Engine's /version socket endpoint — we
 * shell out for it. Returns null when compose isn't installed or the call fails.
 */
export async function composeVersion(): Promise<string | null> {
    try {
        const proc = Bun.spawn(["docker", "compose", "version", "--short"], {
            stdout: "pipe",
            stderr: "ignore",
            env: process.env,
        });
        const out = (await new Response(proc.stdout).text()).trim();
        await proc.exited;
        return out || null;
    } catch {
        return null;
    }
}

/** Run a discovered make target in the project directory. */
export function makeRun(
    p: Project,
    target: string,
    onLine: Sink,
    signal?: AbortSignal,
): Promise<RunResult> {
    return runStreaming(["make", target], { cwd: p.dir, onLine, signal });
}
