import { readdirSync } from "fs";
import { join } from "path";

export interface DirEntry {
    name: string;
    path: string;
    /** True if the directory directly contains a compose file or Dockerfile. */
    isProject: boolean;
}

const COMPOSE_RE = /^(docker-compose|compose)(\.[\w.-]+)?\.ya?ml$/i;
const DOCKERFILE_RE = /^Dockerfile(\..+)?$/;

function topHasProjectMarker(dir: string): boolean {
    try {
        for (const e of readdirSync(dir, { withFileTypes: true })) {
            if (e.isFile() && (COMPOSE_RE.test(e.name) || DOCKERFILE_RE.test(e.name))) return true;
        }
    } catch {
        // unreadable dir → not a project marker
    }
    return false;
}

/** List immediate subdirectories of `dir`, alphabetically, flagging project dirs. */
export function listSubdirs(dir: string, showHidden = false): DirEntry[] {
    let entries;
    try {
        entries = readdirSync(dir, { withFileTypes: true });
    } catch {
        return [];
    }
    const dirs = entries
        .filter((e) => e.isDirectory() && (showHidden || !e.name.startsWith(".")))
        .map((e) => ({ name: e.name, path: join(dir, e.name), isProject: false }))
        .sort((a, b) => a.name.localeCompare(b.name));
    for (const d of dirs) d.isProject = topHasProjectMarker(d.path);
    return dirs;
}
