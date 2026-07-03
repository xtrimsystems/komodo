import { test, expect } from "bun:test";
import { reconcile, serviceRows, sameContainers } from "./state.js";
import type { Container, Project, ContainerState } from "./types.js";

function project(over: Partial<Project> = {}): Project {
    return {
        name: "app",
        dir: "/p/app",
        root: "/p",
        composeFiles: ["/p/app/docker-compose.yml"],
        makeTargets: [],
        dockerfiles: [],
        services: [{ name: "web" }, { name: "db" }],
        mechanism: "compose",
        composeProjectName: "app",
        ...over,
    };
}

function container(over: Partial<Container> = {}): Container {
    return {
        id: "id",
        name: "app-web-1",
        state: "running" as ContainerState,
        status: "Up",
        image: "img",
        ...over,
    };
}

test("reconcile matches containers by working_dir label", () => {
    const c = container({ workingDir: "/p/app", service: "web" });
    const [v] = reconcile([project()], [c]);
    expect(v.containers).toHaveLength(1);
    expect(v.runningCount).toBe(1);
});

test("reconcile matches by compose project name when no working_dir", () => {
    const c = container({ project: "app", service: "web" });
    const [v] = reconcile([project()], [c]);
    expect(v.containers).toHaveLength(1);
});

test("status: stopped / partial / running", () => {
    const base = project();
    const stopped = reconcile([base], [])[0];
    expect(stopped.status).toBe("stopped");

    const oneUp = reconcile([base], [container({ workingDir: "/p/app", service: "web" })])[0];
    expect(oneUp.status).toBe("partial");

    const allUp = reconcile(
        [base],
        [
            container({ id: "1", workingDir: "/p/app", service: "web" }),
            container({ id: "2", workingDir: "/p/app", service: "db" }),
        ],
    )[0];
    expect(allUp.status).toBe("running");
});

test("sameContainers ignores uptime-string churn but catches real changes", () => {
    const a = [container({ id: "1", status: "Up 3 minutes" })];
    const uptimeOnly = [container({ id: "1", status: "Up 4 minutes" })];
    const stateChanged = [container({ id: "1", status: "Exited (0)", state: "exited" })];
    const healthChanged = [container({ id: "1", status: "Up 3 minutes (healthy)", health: "healthy" })];
    expect(sameContainers(a, uptimeOnly)).toBe(true);
    expect(sameContainers(a, stateChanged)).toBe(false);
    expect(sameContainers(a, healthChanged)).toBe(false);
    expect(sameContainers(a, [])).toBe(false);
});

test("sameContainers is order-insensitive", () => {
    const a = [container({ id: "1" }), container({ id: "2" })];
    const b = [container({ id: "2" }), container({ id: "1" })];
    expect(sameContainers(a, b)).toBe(true);
});

test("serviceRows pairs declared services with their containers", () => {
    const v = reconcile([project()], [container({ workingDir: "/p/app", service: "web" })])[0];
    const rows = serviceRows(v);
    expect(rows.map((r) => r.name)).toEqual(["web", "db"]);
    expect(rows.find((r) => r.name === "web")?.container).toBeDefined();
    expect(rows.find((r) => r.name === "db")?.container).toBeUndefined();
});
