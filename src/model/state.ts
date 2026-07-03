import type { Container, Project, ProjectStatus, ProjectView } from "./types.js";

export interface ServiceRow {
    name: string;
    container?: Container;
}

/**
 * Service rows for a project: one per declared compose service (with its live
 * container if any), or one per container when the compose file wasn't parsed.
 */
export function serviceRows(p: ProjectView): ServiceRow[] {
    const byName = new Map<string, Container>();
    for (const c of p.containers) if (c.service) byName.set(c.service, c);
    if (p.services.length) {
        return p.services.map((s) => ({ name: s.name, container: byName.get(s.name) }));
    }
    return p.containers.map((c) => ({ name: c.service ?? c.name, container: c }));
}

/** Containers belonging to a project, matched by working_dir label then project name. */
function containersFor(p: Project, containers: Container[]): Container[] {
    return containers.filter((c) => {
        if (c.workingDir && c.workingDir === p.dir) return true;
        if (c.project && c.project === p.composeProjectName) return true;
        return false;
    });
}

function computeStatus(serviceCount: number, containers: Container[]): ProjectStatus {
    const running = containers.filter((c) => c.state === "running").length;
    if (running === 0) return "stopped";
    // Known service count and not all up → partial.
    if (serviceCount > 0 && running < serviceCount) return "partial";
    // Some containers exist in a non-running state → partial.
    if (containers.some((c) => c.state !== "running")) return "partial";
    return "running";
}

/**
 * True when two container snapshots are equivalent for display purposes. Ignores
 * the volatile human uptime string (e.g. "Up 3 minutes") so idle polls don't
 * force a repaint; only id/state/health changes count.
 */
export function sameContainers(a: Container[], b: Container[]): boolean {
    if (a.length !== b.length) return false;
    const sig = (c: Container) => `${c.id}:${c.state}:${c.health ?? ""}`;
    const sa = a.map(sig).sort();
    const sb = b.map(sig).sort();
    for (let i = 0; i < sa.length; i++) if (sa[i] !== sb[i]) return false;
    return true;
}

/** Correlate discovered projects with live containers into view models. */
export function reconcile(projects: Project[], containers: Container[]): ProjectView[] {
    return projects.map((p) => {
        const cs = containersFor(p, containers);
        const serviceCount = p.services.length;
        const runningCount = cs.filter((c) => c.state === "running").length;
        return {
            ...p,
            containers: cs,
            runningCount,
            serviceCount,
            status: computeStatus(serviceCount, cs),
        };
    });
}
