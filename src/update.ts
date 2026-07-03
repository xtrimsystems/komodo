import { join, dirname } from "path";
import {
    existsSync,
    readFileSync,
    writeFileSync,
    mkdirSync,
    chmodSync,
    renameSync,
    unlinkSync,
    realpathSync,
} from "fs";
import { createHash } from "crypto";
import { CONFIG_DIR } from "./config.js";
import { VERSION } from "./version.js";

/** GitHub repo that hosts the releases (override with KOMODO_REPO). */
export const REPO = process.env.KOMODO_REPO || "xtrimsystems/komodo";

const CACHE_PATH = join(CONFIG_DIR, "update.json");
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // once a day

/** Compare two versions ("v1.2.3" or "1.2.3"); >0 if a is newer than b. */
export function compareVersions(a: string, b: string): number {
    const pa = a.replace(/^v/, "").split(".").map((n) => parseInt(n, 10) || 0);
    const pb = b.replace(/^v/, "").split(".").map((n) => parseInt(n, 10) || 0);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        const d = (pa[i] ?? 0) - (pb[i] ?? 0);
        if (d !== 0) return d;
    }
    return 0;
}

/** Release asset name for the current platform, or null if unsupported. */
export function assetName(): string | null {
    const os = process.platform === "linux" ? "linux" : process.platform === "darwin" ? "darwin" : null;
    const arch = process.arch === "x64" ? "x64" : process.arch === "arm64" ? "arm64" : null;
    return os && arch ? `komodo-${os}-${arch}` : null;
}

/** Latest published release tag (e.g. "v0.2.0"), or null if unreachable / none. */
async function fetchLatestTag(): Promise<string | null> {
    try {
        const r = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
            headers: { "User-Agent": "komodo-updater", Accept: "application/vnd.github+json" },
        });
        if (!r.ok) return null;
        const j = (await r.json()) as { tag_name?: unknown };
        return typeof j.tag_name === "string" ? j.tag_name : null;
    } catch {
        return null;
    }
}

/**
 * Throttled check used for the in-app "update available" hint. Uses a cached
 * result for up to a day; hits the network otherwise. Returns the newer version
 * string if one exists, else null. Never throws.
 */
export async function checkForUpdateCached(force = false): Promise<string | null> {
    let cache: { lastCheck?: number; latest?: string } = {};
    try {
        if (existsSync(CACHE_PATH)) cache = JSON.parse(readFileSync(CACHE_PATH, "utf8"));
    } catch {
        /* ignore a corrupt cache */
    }

    const fresh = typeof cache.lastCheck === "number" && Date.now() - cache.lastCheck < CHECK_INTERVAL_MS;
    let latest = cache.latest ?? null;

    if (force || !fresh) {
        const tag = await fetchLatestTag();
        if (tag) {
            latest = tag;
            try {
                mkdirSync(CONFIG_DIR, { recursive: true });
                writeFileSync(CACHE_PATH, JSON.stringify({ lastCheck: Date.now(), latest }) + "\n");
            } catch {
                /* a cache we can't write just means we re-check next time */
            }
        }
    }

    return latest && compareVersions(latest, VERSION) > 0 ? latest : null;
}

/**
 * Download the latest release binary for this platform and atomically replace
 * the running executable. Returns true on success. Logs progress via `onLog`.
 */
export async function applyUpdate(onLog: (line: string) => void): Promise<boolean> {
    const asset = assetName();
    if (!asset) {
        onLog(`unsupported platform: ${process.platform}/${process.arch}`);
        return false;
    }

    const tag = await fetchLatestTag();
    if (!tag) {
        onLog(`could not reach GitHub releases for ${REPO}`);
        return false;
    }
    if (compareVersions(tag, VERSION) <= 0) {
        onLog(`already up to date (${VERSION})`);
        return true;
    }

    let target: string;
    try {
        target = realpathSync(process.execPath);
    } catch {
        target = process.execPath;
    }
    if (/(^|\/)bun$/.test(target)) {
        onLog("update only works on the installed binary — you're running via bun (use `make install`)");
        return false;
    }

    const base = `https://github.com/${REPO}/releases/download/${tag}`;
    onLog(`downloading ${asset} ${tag}…`);
    let buf: Buffer;
    try {
        const res = await fetch(`${base}/${asset}`);
        if (!res.ok) {
            onLog(`download failed: HTTP ${res.status}`);
            return false;
        }
        buf = Buffer.from(await res.arrayBuffer());
    } catch (err) {
        onLog(`download failed: ${(err as Error).message}`);
        return false;
    }

    try {
        const sres = await fetch(`${base}/${asset}.sha256`);
        if (sres.ok) {
            const expected = (await sres.text()).trim().split(/\s+/)[0];
            const actual = createHash("sha256").update(buf).digest("hex");
            if (expected && expected !== actual) {
                onLog("checksum mismatch — refusing to install");
                return false;
            }
        }
    } catch {
        /* no checksum available — proceed */
    }

    // Write beside the target (same filesystem) then rename over it atomically.
    const tmp = join(dirname(target), `.komodo.update.${process.pid}`);
    try {
        writeFileSync(tmp, buf, { mode: 0o755 });
        chmodSync(tmp, 0o755);
        renameSync(tmp, target);
    } catch (err) {
        try {
            if (existsSync(tmp)) unlinkSync(tmp);
        } catch {
            /* best effort */
        }
        onLog(`could not replace ${target}: ${(err as Error).message}`);
        return false;
    }

    onLog(`updated ${VERSION} → ${tag}  (${target})`);
    onLog("restart komodo to run the new version");
    return true;
}
