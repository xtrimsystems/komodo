import type { ProjectStatus, ContainerState, Health } from "../model/types.js";

export const glyph = {
    running: "●",
    partial: "◐",
    stopped: "○",
    pointer: "❯",
    collapsed: "▸",
    expanded: "▾",
} as const;

// Badge icons. The docker glyph is a Nerd Font icon (needs a Nerd Font installed);
// swap ICON_DOCKER for plain text if it doesn't render in your terminal.
export const ICON_DOCKER = ""; // nf-dev-docker (compose projects)
export const ICON_MAKE = "⚙"; // ⚙ has Makefile targets
export const ICON_FAV = "★"; // ★ favorite

export function projectColor(status: ProjectStatus): string {
    switch (status) {
        case "running":
            return "green";
        case "partial":
            return "yellow";
        case "stopped":
            return "gray";
    }
}

export function projectGlyph(status: ProjectStatus): string {
    return glyph[status];
}

export function containerColor(state: ContainerState, health?: Health): string {
    if (health === "unhealthy") return "red";
    if (health === "starting") return "yellow";
    if (state === "running") return "green";
    if (state === "restarting") return "yellow";
    if (state === "dead") return "red";
    return "gray";
}

export function containerGlyph(state: ContainerState): string {
    if (state === "running") return glyph.running;
    if (state === "restarting" || state === "paused") return glyph.partial;
    return glyph.stopped;
}
