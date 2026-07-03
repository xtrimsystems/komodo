import { homedir } from "os";
import { join } from "path";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";

export interface Config {
    /** Directories to scan for projects. */
    roots: string[];
    /** How many directory levels below each root to search for project dirs. */
    scanDepth: number;
    /** Path to the docker daemon unix socket. */
    dockerSocket: string;
    /** Container status poll interval in milliseconds. */
    refreshMs: number;
    /** Absolute dirs of projects pinned to the Favorites section. */
    favorites: string[];
}

export const CONFIG_DIR = join(homedir(), ".config", "komodo");
export const CONFIG_PATH = join(CONFIG_DIR, "config.json");

/** Whether a config file has been written yet (used to trigger first-run setup). */
export function configExists(): boolean {
    return existsSync(CONFIG_PATH);
}

function defaultSocket(): string {
    const host = process.env.DOCKER_HOST;
    if (host?.startsWith("unix://")) return host.slice("unix://".length);
    return "/var/run/docker.sock";
}

function defaults(): Config {
    return {
        // Empty by design: first run opens the setup screen so the user adds
        // their own folders via the directory browser (nothing is assumed).
        roots: [],
        scanDepth: 2,
        dockerSocket: defaultSocket(),
        refreshMs: 2000,
        favorites: [],
    };
}

/**
 * Load config. Returns defaults WITHOUT writing when no file exists yet — the
 * absence of the file is what triggers first-run setup (see `configExists`).
 */
export function loadConfig(): Config {
    const d = defaults();
    if (!existsSync(CONFIG_PATH)) {
        return d;
    }
    try {
        const parsed = JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
        return {
            roots: Array.isArray(parsed.roots) && parsed.roots.length ? parsed.roots : d.roots,
            scanDepth: typeof parsed.scanDepth === "number" ? parsed.scanDepth : d.scanDepth,
            dockerSocket: typeof parsed.dockerSocket === "string" ? parsed.dockerSocket : d.dockerSocket,
            refreshMs: typeof parsed.refreshMs === "number" ? parsed.refreshMs : d.refreshMs,
            favorites: Array.isArray(parsed.favorites) ? parsed.favorites : d.favorites,
        };
    } catch {
        return d;
    }
}

/** Merge a partial config into the file (creating it), preserving other fields. */
export function updateConfig(patch: Partial<Config>): Config {
    const merged = { ...loadConfig(), ...patch };
    mkdirSync(CONFIG_DIR, { recursive: true });
    writeFileSync(CONFIG_PATH, JSON.stringify(merged, null, 4) + "\n");
    return merged;
}

/** Persist the favorites list, preserving all other fields. */
export function saveFavorites(favorites: string[]): void {
    updateConfig({ favorites });
}

/** Persist the scan roots, preserving all other fields. */
export function saveRoots(roots: string[]): void {
    updateConfig({ roots });
}
