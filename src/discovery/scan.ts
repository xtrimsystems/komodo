import { readdirSync } from "fs";
import { basename, join } from "path";
import type { Project, StartMechanism } from "../model/types.js";
import { parseComposeServices } from "./parseCompose.js";
import { parseMakefile } from "./parseMakefile.js";

const SKIP_DIRS = new Set([
    "node_modules",
    "vendor",
    ".git",
    ".idea",
    ".vscode",
    "dist",
    "build",
    "target",
    ".cache",
    "coverage",
]);

const COMPOSE_RE = /^(docker-compose|compose)(\.[\w.-]+)?\.ya?ml$/i;
const DOCKERFILE_RE = /^Dockerfile(\..+)?$/;

interface TopFiles {
    composeFiles: string[];
    makefile?: string;
    dockerfiles: string[];
}

/** Read files directly inside a directory (non-recursive). */
function readTopFiles(dir: string): TopFiles {
    const out: TopFiles = { composeFiles: [], dockerfiles: [] };
    let entries;
    try {
        entries = readdirSync(dir, { withFileTypes: true });
    } catch {
        return out;
    }
    for (const e of entries) {
        if (!e.isFile()) continue;
        if (COMPOSE_RE.test(e.name)) out.composeFiles.push(join(dir, e.name));
        else if (e.name === "Makefile") out.makefile = join(dir, e.name);
        else if (DOCKERFILE_RE.test(e.name)) out.dockerfiles.push(join(dir, e.name));
    }
    return out;
}

/** Dockerfiles at the top level plus one level of subdirectories (e.g. docker/Dockerfile). */
function gatherDockerfiles(dir: string, top: string[]): string[] {
    const found = [...top];
    let entries;
    try {
        entries = readdirSync(dir, { withFileTypes: true });
    } catch {
        return found;
    }
    for (const e of entries) {
        if (!e.isDirectory() || SKIP_DIRS.has(e.name) || e.name.startsWith(".")) continue;
        const sub = join(dir, e.name);
        let subEntries;
        try {
            subEntries = readdirSync(sub, { withFileTypes: true });
        } catch {
            continue;
        }
        for (const se of subEntries) {
            if (se.isFile() && DOCKERFILE_RE.test(se.name)) found.push(join(sub, se.name));
        }
    }
    return found;
}

/** Compose's default project name: basename lowercased, invalid chars stripped. */
function computeComposeProjectName(dir: string): string {
    return basename(dir)
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, "")
        .replace(/^[^a-z0-9]+/, "");
}

function toProject(dir: string, root: string, top: TopFiles): Project {
    const { services, projectName } = parseComposeServices(top.composeFiles);
    const dockerfiles = gatherDockerfiles(dir, top.dockerfiles);
    const mechanism: StartMechanism = top.composeFiles.length
        ? "compose"
        : dockerfiles.length
          ? "dockerfile"
          : "none";
    return {
        name: basename(dir),
        dir,
        root,
        composeFiles: top.composeFiles,
        makefile: top.makefile,
        makeTargets: top.makefile ? parseMakefile(top.makefile) : [],
        dockerfiles,
        services,
        mechanism,
        composeProjectName: projectName ?? computeComposeProjectName(dir),
    };
}

/** True if this directory is itself a project (has compose or a Dockerfile at its top). */
function isProjectDir(top: TopFiles): boolean {
    return top.composeFiles.length > 0 || top.dockerfiles.length > 0;
}

/**
 * Walk a root looking for project directories. A directory is a project when it
 * contains a compose file or a Dockerfile at its top level; once identified we do
 * not descend into it (its subdirs belong to that project).
 */
function scanRoot(root: string, maxDepth: number): Project[] {
    const projects: Project[] = [];
    const recurse = (dir: string, depth: number) => {
        const top = readTopFiles(dir);
        if (isProjectDir(top)) {
            projects.push(toProject(dir, root, top));
            return; // don't treat subdirectories as separate projects
        }
        if (depth >= maxDepth) return;
        let entries;
        try {
            entries = readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }
        for (const e of entries) {
            if (e.isDirectory() && !SKIP_DIRS.has(e.name) && !e.name.startsWith(".")) {
                recurse(join(dir, e.name), depth + 1);
            }
        }
    };
    recurse(root, 0);
    return projects;
}

/** Discover all projects across the configured roots, de-duplicated and sorted. */
export function discoverProjects(roots: string[], scanDepth: number): Project[] {
    const byDir = new Map<string, Project>();
    for (const root of roots) {
        for (const p of scanRoot(root, scanDepth)) {
            if (!byDir.has(p.dir)) byDir.set(p.dir, p);
        }
    }
    return [...byDir.values()].sort((a, b) => a.name.localeCompare(b.name));
}
