import type { Container, ContainerState, Health, Port } from "../model/types.js";

/**
 * Minimal Docker Engine API client over the unix socket, using bun's native
 * `fetch({ unix })`. No external Docker SDK needed for read-only status.
 */
export class DockerEngine {
    constructor(private readonly socket: string) {}

    private api(path: string): Promise<Response> {
        // The host part is ignored when `unix` is set; it just needs to be valid.
        return fetch(`http://localhost${path}`, { unix: this.socket } as RequestInit);
    }

    async ping(): Promise<boolean> {
        try {
            const r = await this.api("/_ping");
            return r.ok;
        } catch {
            return false;
        }
    }

    async version(): Promise<{ version: string; api: string } | null> {
        try {
            const r = await this.api("/version");
            if (!r.ok) return null;
            const j: any = await r.json();
            return { version: j.Version, api: j.ApiVersion };
        } catch {
            return null;
        }
    }

    async listContainers(): Promise<Container[]> {
        const r = await this.api("/containers/json?all=true");
        if (!r.ok) throw new Error(`Engine API returned ${r.status}`);
        const raw = (await r.json()) as any[];
        return raw.map(mapContainer);
    }

    async stats(id: string): Promise<ContainerStats | null> {
        try {
            const r = await this.api(`/containers/${id}/stats?stream=false`);
            if (!r.ok) return null;
            return computeStats(await r.json());
        } catch {
            return null;
        }
    }

    /**
     * Stream container lifecycle events (start/stop/die/health_status/…). Calls
     * `onEvent` for each event and resolves when the stream ends or is aborted.
     * Rejects if the connection can't be established (caller falls back to polling).
     */
    async streamEvents(onEvent: (action: string) => void, signal: AbortSignal): Promise<void> {
        const filters = encodeURIComponent(JSON.stringify({ type: ["container"] }));
        const r = await fetch(`http://localhost/events?filters=${filters}`, {
            unix: this.socket,
            signal,
        } as RequestInit);
        if (!r.ok || !r.body) throw new Error(`events stream ${r.status}`);
        const reader = r.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";
            for (const line of lines) {
                if (!line.trim()) continue;
                try {
                    const evt = JSON.parse(line);
                    onEvent(String(evt.Action ?? evt.status ?? ""));
                } catch {
                    /* ignore partial/non-JSON frames */
                }
            }
        }
    }
}

export interface ContainerStats {
    cpu: number;
    memUsed: number;
    memLimit: number;
}

export function computeStats(s: any): ContainerStats | null {
    if (!s?.cpu_stats || !s?.precpu_stats) return null;
    const cpuDelta = (s.cpu_stats.cpu_usage?.total_usage ?? 0) - (s.precpu_stats.cpu_usage?.total_usage ?? 0);
    const sysDelta = (s.cpu_stats.system_cpu_usage ?? 0) - (s.precpu_stats.system_cpu_usage ?? 0);
    const cores = s.cpu_stats.online_cpus || s.cpu_stats.cpu_usage?.percpu_usage?.length || 1;
    const cpu = sysDelta > 0 && cpuDelta > 0 ? (cpuDelta / sysDelta) * cores * 100 : 0;
    const memUsed = (s.memory_stats?.usage ?? 0) - (s.memory_stats?.stats?.inactive_file ?? 0);
    const memLimit = s.memory_stats?.limit ?? 0;
    return { cpu, memUsed, memLimit };
}

function parseHealth(status: string): Health | undefined {
    if (/\(healthy\)/.test(status)) return "healthy";
    if (/\(unhealthy\)/.test(status)) return "unhealthy";
    if (/health: starting/.test(status)) return "starting";
    return undefined;
}

export function parsePorts(raw: any[]): Port[] {
    const seen = new Set<string>();
    const out: Port[] = [];
    for (const p of raw ?? []) {
        if (p?.PublicPort == null) continue;
        const key = `${p.PublicPort}:${p.PrivatePort}/${p.Type}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ public: p.PublicPort, private: p.PrivatePort, type: p.Type ?? "tcp" });
    }
    return out.sort((a, b) => a.public - b.public);
}

function mapContainer(c: any): Container {
    const labels: Record<string, string> = c.Labels || {};
    return {
        id: c.Id,
        name: (c.Names?.[0] || "").replace(/^\//, ""),
        service: labels["com.docker.compose.service"],
        project: labels["com.docker.compose.project"],
        workingDir: labels["com.docker.compose.project.working_dir"],
        state: c.State as ContainerState,
        status: c.Status || "",
        health: parseHealth(c.Status || ""),
        image: c.Image || "",
        ports: parsePorts(c.Ports),
    };
}
