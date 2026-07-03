import React from "react";
import { render } from "ink";
import { CONFIG_PATH, configExists, loadConfig } from "./config.js";
import { DockerEngine } from "./docker/engine.js";
import { discoverProjects } from "./discovery/scan.js";
import { reconcile } from "./model/state.js";
import { runInteractive } from "./docker/interactive.js";
import { composeVersion } from "./docker/actions.js";
import { applyUpdate, checkForUpdateCached } from "./update.js";
import { projectGlyph } from "./ui/theme.js";
import App, { type SuspendRequest } from "./ui/App.js";
import { VERSION } from "./version.js";

function printTable(views: ReturnType<typeof reconcile>) {
    const nameW = Math.max(4, ...views.map((v) => v.name.length));
    for (const v of views) {
        const svc = v.serviceCount ? `${v.runningCount}/${v.serviceCount}` : "";
        const extras: string[] = [];
        if (v.mechanism === "dockerfile") extras.push("dockerfile");
        const annotated = v.makeTargets.filter((t) => t.help).length;
        if (annotated || v.makeTargets.length) extras.push(`make:${annotated || v.makeTargets.length}`);
        console.log(
            `  ${projectGlyph(v.status)} ${v.name.padEnd(nameW)}  ${v.status.padEnd(8)} ${svc.padStart(5)}  ${extras.join(" ")}`,
        );
    }
}

async function main() {
    const args = new Set(process.argv.slice(2));

    if (args.has("--version") || args.has("-v")) {
        const engine = new DockerEngine(loadConfig().dockerSocket);
        const ver = await engine.version();
        console.log(`komodo ${VERSION}`);
        console.log(`docker engine ${ver ? ver.version + " (api " + ver.api + ")" : "unreachable"}`);
        return;
    }

    if (args.has("--config")) {
        console.log(CONFIG_PATH);
        console.log(JSON.stringify(loadConfig(), null, 4));
        return;
    }

    if (args.has("--update")) {
        const ok = await applyUpdate((l) => console.log(l));
        process.exit(ok ? 0 : 1);
    }

    if (args.has("--check-update")) {
        const latest = await checkForUpdateCached(true);
        console.log(latest ? `update available: ${latest} (current ${VERSION})` : `up to date (${VERSION})`);
        return;
    }

    if (args.has("--list") || args.has("--json")) {
        const json = args.has("--json");
        const config = loadConfig();
        const engine = new DockerEngine(config.dockerSocket);
        const projects = discoverProjects(config.roots, config.scanDepth);
        let containers: Awaited<ReturnType<DockerEngine["listContainers"]>> = [];
        let engineOk = true;
        try {
            containers = await engine.listContainers();
        } catch {
            engineOk = false;
        }
        const views = reconcile(projects, containers);
        if (json) {
            process.stdout.write(
                JSON.stringify(
                    views.map((v) => ({
                        name: v.name,
                        dir: v.dir,
                        status: v.status,
                        running: v.runningCount,
                        services: v.serviceCount,
                        mechanism: v.mechanism,
                        makeTargets: v.makeTargets.map((t) => t.name),
                    })),
                    null,
                    2,
                ) + "\n",
            );
            return;
        }
        const running = views.filter((v) => v.status === "running").length;
        console.log(
            `komodo — ${views.length} projects, ${running} running${engineOk ? "" : " (engine unreachable)"}\n`,
        );
        printTable(views);
        return;
    }

    // Interactive TUI
    const config = loadConfig();
    const engine = new DockerEngine(config.dockerSocket);
    const [ver, compose] = await Promise.all([engine.version(), composeVersion()]);
    if (!process.stdin.isTTY) {
        console.error("komodo: not a TTY. Use --list or --json for non-interactive output.");
        process.exit(1);
    }

    // Take over the terminal (alternate screen buffer) like vim/claude, so the
    // TUI doesn't leave a scrollback trail and the previous terminal is restored on exit.
    // Restore the terminal: leave alt-screen, show cursor, and make sure mouse
    // reporting (enabled on the logs screen) is off even on an abrupt exit.
    const leaveAltScreen = () =>
        process.stdout.write("\x1b[?1000l\x1b[?1006l\x1b[?1049l\x1b[?25h");
    process.stdout.write("\x1b[?1049h\x1b[H");
    process.on("exit", leaveAltScreen);

    // Loop so we can suspend Ink, drop into an interactive shell, and resume.
    try {
    for (;;) {
        // Recomputed each iteration: once setup writes the config, later remounts skip it.
        const firstRun = !configExists();
        let pending: SuspendRequest | null = null;
        let relaunch = false;
        let instance!: ReturnType<typeof render>;
        instance = render(
            <App
                config={config}
                engine={engine}
                engineVersion={ver?.version ?? null}
                composeVersion={compose}
                firstRun={firstRun}
                onSuspend={(req) => {
                    pending = req;
                    instance.unmount();
                }}
                onRelaunch={() => {
                    relaunch = true;
                    instance.unmount();
                }}
            />,
        );
        await instance.waitUntilExit();

        // The app self-updated its own binary and asked to restart into it.
        if (relaunch) {
            leaveAltScreen();
            const child = Bun.spawn([process.execPath], {
                stdin: "inherit",
                stdout: "inherit",
                stderr: "inherit",
            });
            process.exit(await child.exited);
        }

        if (!pending) break;

        const req: SuspendRequest = pending;
        process.stdout.write("\x1b[2J\x1b[3J\x1b[H");
        process.stdout.write(`↳ ${req.note}   (exit the shell to return to komodo)\n\n`);
        try {
            await runInteractive(req.cmd, req.cwd);
        } catch (err) {
            process.stdout.write(`\nshell error: ${(err as Error).message}\n`);
        }
        process.stdout.write("\x1b[2J\x1b[3J\x1b[H");
    }
    } finally {
        leaveAltScreen();
    }
}

void main();
