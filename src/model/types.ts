/** How a project is preferentially started via the Start/Stop keys. */
export type StartMechanism = "compose" | "dockerfile" | "none";

export interface MakeTarget {
    name: string;
    /** Text after `## ` on the target line, if any. */
    help: string;
}

export interface ComposeService {
    name: string;
    image?: string;
}

export interface Project {
    /** Display name (directory basename). */
    name: string;
    /** Absolute path of the project directory. */
    dir: string;
    /** Configured root this project was found under. */
    root: string;
    /** Absolute paths of compose files found at the project top level. */
    composeFiles: string[];
    /** Absolute path of the project's Makefile, if any. */
    makefile?: string;
    makeTargets: MakeTarget[];
    /** Absolute paths of Dockerfiles (fallback when no compose). */
    dockerfiles: string[];
    /** Services parsed from the compose file(s). */
    services: ComposeService[];
    /** Preferred mechanism for the Start/Stop keys. */
    mechanism: StartMechanism;
    /** Default compose project name derived from the directory basename. */
    composeProjectName: string;
}

export type ContainerState =
    | "running"
    | "exited"
    | "created"
    | "restarting"
    | "paused"
    | "dead"
    | "removing";

export type Health = "healthy" | "unhealthy" | "starting";

export interface Container {
    id: string;
    name: string;
    /** com.docker.compose.service */
    service?: string;
    /** com.docker.compose.project */
    project?: string;
    /** com.docker.compose.project.working_dir (absolute path) */
    workingDir?: string;
    state: ContainerState;
    /** Human status string, e.g. "Up 3 hours (healthy)". */
    status: string;
    health?: Health;
    image: string;
}

export type ProjectStatus = "running" | "partial" | "stopped";

export interface ProjectView extends Project {
    containers: Container[];
    status: ProjectStatus;
    runningCount: number;
    serviceCount: number;
}
