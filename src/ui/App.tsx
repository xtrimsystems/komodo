import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Box, Text, useApp, useInput, useStdout } from "ink";
import Spinner from "ink-spinner";
import { existsSync } from "fs";
import { dirname } from "path";
import { saveFavorites, updateConfig, type Config } from "../config.js";
import type { Container, MakeTarget, Project, ProjectView } from "../model/types.js";
import { DockerEngine } from "../docker/engine.js";
import { discoverProjects } from "../discovery/scan.js";
import { listSubdirs } from "../discovery/browse.js";
import { reconcile, sameContainers, serviceRows, type ServiceRow } from "../model/state.js";
import {
    composeDown,
    composeExecShell,
    composeLogs,
    composeRestart,
    composeStop,
    composeUp,
    makeRun,
} from "../docker/actions.js";
import { applyUpdate, checkForUpdateCached } from "../update.js";
import { fuzzyFilter } from "./filter.js";
import { buildSections, orderedItems } from "./sections.js";
import { projectColor } from "./theme.js";
import { Divider, Footer, Header, Key } from "./components.js";
import ListScreen from "./ListScreen.js";
import DetailScreen, { detailPanes, outputVisible } from "./DetailScreen.js";
import LogsScreen from "./LogsScreen.js";
import PaletteScreen from "./PaletteScreen.js";
import SettingsScreen, { type RootInfo } from "./SettingsScreen.js";
import BrowseScreen from "./BrowseScreen.js";
import HelpScreen from "./HelpScreen.js";
import WelcomeBanner, { BANNER_ROWS, BANNER_COLS } from "./WelcomeBanner.js";

export interface SuspendRequest {
    cmd: string[];
    cwd: string;
    note: string;
}

interface Props {
    config: Config;
    engine: DockerEngine;
    engineVersion: string | null;
    composeVersion: string | null;
    firstRun: boolean;
    onSuspend: (req: SuspendRequest) => void;
    onRelaunch: () => void;
}

type Screen =
    | { kind: "list" }
    | { kind: "detail"; dir: string }
    | { kind: "logs"; dir: string; service?: string }
    | { kind: "settings" };

const MAX_OUTPUT = 500;
const MAX_LOG_LINES = 2000;

// Survives Ink remount (after an interactive shell) so the cursor returns where it was.
const session: { selectedDir: string | null } = { selectedDir: null };

/** Annotated ("public") make targets first; fall back to all if none are annotated. */
function paletteTargets(p?: { makeTargets: MakeTarget[] }): MakeTarget[] {
    if (!p) return [];
    const annotated = p.makeTargets.filter((t) => t.help);
    return annotated.length ? annotated : p.makeTargets;
}

function isText(input: string, key: { ctrl: boolean; meta: boolean }): boolean {
    if (!input || key.ctrl || key.meta) return false;
    for (let i = 0; i < input.length; i++) if (input.charCodeAt(i) < 32) return false;
    return true;
}

const HOME = process.env.HOME ?? "";
function shortPath(dir: string): string {
    return HOME && dir.startsWith(HOME) ? "~" + dir.slice(HOME.length) : dir;
}

function useTerminalSize() {
    const { stdout } = useStdout();
    const [size, setSize] = useState({ rows: stdout.rows || 24, columns: stdout.columns || 80 });
    useEffect(() => {
        const onResize = () => setSize({ rows: stdout.rows || 24, columns: stdout.columns || 80 });
        stdout.on("resize", onResize);
        return () => {
            stdout.off("resize", onResize);
        };
    }, [stdout]);
    return size;
}

export default function App({
    config,
    engine,
    engineVersion,
    composeVersion,
    firstRun,
    onSuspend,
    onRelaunch,
}: Props) {
    const { exit } = useApp();
    const { rows: termRows, columns: termCols } = useTerminalSize();
    // Breathing room around the whole app; the extra -1 avoids the fill-scroll that hides the top.
    const PAD_TOP = 1;
    const PAD_X = 3;
    const columns = Math.max(1, termCols - PAD_X * 2);
    const rows = Math.max(3, termRows - 1 - PAD_TOP);

    const [projects, setProjects] = useState<Project[]>([]);
    const [containers, setContainers] = useState<Container[]>([]);
    const [scanning, setScanning] = useState(true);
    const [engineOk, setEngineOk] = useState(true);

    const [screen, setScreen] = useState<Screen>(firstRun ? { kind: "settings" } : { kind: "list" });
    const [selectedDir, setSelectedDir] = useState<string | null>(session.selectedDir);
    const [serviceIndex, setServiceIndex] = useState(0);

    const [roots, setRoots] = useState<string[]>(config.roots);
    const [firstRunFlag, setFirstRunFlag] = useState(firstRun);
    const [settingsIndex, setSettingsIndex] = useState(0);
    const [browseActive, setBrowseActive] = useState(false);
    const [browsePath, setBrowsePath] = useState(HOME);
    const [browseIndex, setBrowseIndex] = useState(0);
    const [showHidden, setShowHidden] = useState(false);

    const [filterActive, setFilterActive] = useState(false);
    const [filterQuery, setFilterQuery] = useState("");

    const [paletteActive, setPaletteActive] = useState(false);
    const [paletteIndex, setPaletteIndex] = useState(0);
    const [paletteQuery, setPaletteQuery] = useState("");

    const [helpActive, setHelpActive] = useState(false);

    // Output pane scroll on the detail screen: lines up from the bottom (0 = tail).
    const [outputScroll, setOutputScroll] = useState(0);
    // Logs screen scroll: lines up from the bottom (0 = tail / follow).
    const [logsScroll, setLogsScroll] = useState(0);

    // Newer version available (from a throttled once-a-day background check).
    const [updateAvailable, setUpdateAvailable] = useState<string | null>(null);
    // In-app updater overlay state.
    const [updatingActive, setUpdatingActive] = useState(false);
    const [updateLog, setUpdateLog] = useState<string[]>([]);
    const [updateResult, setUpdateResult] = useState<"ok" | "fail" | null>(null);
    const [updatedTo, setUpdatedTo] = useState<string | null>(null);

    const [output, setOutput] = useState<string[]>([]);
    const [logLines, setLogLines] = useState<string[]>([]);
    const [busy, setBusy] = useState<Record<string, string>>({});
    const [favorites, setFavorites] = useState<string[]>(config.favorites);

    const pollingRef = useRef(false);
    const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const logsReturn = useRef<Screen>({ kind: "list" });

    // ---- data -------------------------------------------------------------
    const views = useMemo(() => reconcile(projects, containers), [projects, containers]);
    const filtered = useMemo(
        () => (filterQuery.trim() ? fuzzyFilter(views, filterQuery, (v) => v.name) : views),
        [views, filterQuery],
    );
    const favSet = useMemo(() => new Set(favorites), [favorites]);
    const sections = useMemo(
        () => buildSections(filtered, favSet, roots),
        [filtered, favSet, roots],
    );
    const orderedViews = useMemo(() => orderedItems(sections), [sections]);

    const rootsInfo: RootInfo[] = useMemo(
        () =>
            roots.map((r) => ({
                path: r,
                display: shortPath(r),
                exists: existsSync(r),
                count: projects.filter((p) => p.root === r).length,
            })),
        [roots, projects],
    );

    const browseEntries = useMemo(
        () => (browseActive ? listSubdirs(browsePath, showHidden) : []),
        [browseActive, browsePath, showHidden],
    );

    const current = views.find((v) => v.dir === selectedDir);
    const detailProject =
        screen.kind === "detail" || screen.kind === "logs"
            ? views.find((v) => v.dir === screen.dir)
            : undefined;
    const rowsForDetail: ServiceRow[] = detailProject ? serviceRows(detailProject) : [];
    const selectedService = rowsForDetail[serviceIndex]?.name;

    const paletteProject = screen.kind === "list" ? current : detailProject;
    const paletteList = useMemo(
        () => fuzzyFilter(paletteTargets(paletteProject), paletteQuery, (t) => `${t.name} ${t.help}`),
        [paletteProject, paletteQuery],
    );

    const append = useCallback((line: string) => {
        setOutput((prev) => {
            const next = prev.concat(line);
            return next.length > MAX_OUTPUT ? next.slice(next.length - MAX_OUTPUT) : next;
        });
    }, []);

    const refresh = useCallback(async () => {
        if (pollingRef.current) return;
        pollingRef.current = true;
        try {
            const next = await engine.listContainers();
            setContainers((prev) => (sameContainers(prev, next) ? prev : next));
            setEngineOk(true);
        } catch {
            setEngineOk(false);
        } finally {
            pollingRef.current = false;
        }
    }, [engine]);

    const scheduleRefresh = useCallback(() => {
        if (refreshTimer.current) return;
        refreshTimer.current = setTimeout(() => {
            refreshTimer.current = null;
            void refresh();
        }, 150);
    }, [refresh]);

    const rescan = useCallback(
        (rootsArg?: string[]) => {
            const useRoots = rootsArg ?? roots;
            setScanning(true);
            setTimeout(() => {
                const found = discoverProjects(useRoots, config.scanDepth);
                setProjects(found);
                setSelectedDir((prev) =>
                    prev && found.some((p) => p.dir === prev) ? prev : (found[0]?.dir ?? null),
                );
                setScanning(false);
            }, 0);
        },
        [roots, config.scanDepth],
    );

    // Initial scan + first status read.
    useEffect(() => {
        rescan();
        void refresh();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Non-blocking, throttled check for a newer release (only surfaces a hint).
    useEffect(() => {
        if (process.env.KOMODO_NO_UPDATE) return;
        let alive = true;
        void checkForUpdateCached()
            .then((v) => {
                if (alive && v) setUpdateAvailable(v);
            })
            .catch(() => {});
        return () => {
            alive = false;
        };
    }, []);

    // Events stream (instant status) with a slow safety poll; fall back to polling on error.
    useEffect(() => {
        const controller = new AbortController();
        let alive = true;
        let timer: ReturnType<typeof setInterval> = setInterval(
            () => void refresh(),
            Math.max(5000, config.refreshMs),
        );
        (async () => {
            try {
                await engine.streamEvents(() => alive && scheduleRefresh(), controller.signal);
            } catch {
                if (alive) {
                    clearInterval(timer);
                    timer = setInterval(() => void refresh(), config.refreshMs);
                }
            }
        })();
        return () => {
            alive = false;
            controller.abort();
            clearInterval(timer);
        };
    }, [engine, refresh, scheduleRefresh, config.refreshMs]);

    // Stream logs while on the logs screen.
    useEffect(() => {
        if (screen.kind !== "logs") return;
        const project = projects.find((p) => p.dir === screen.dir);
        if (!project) return;
        const controller = new AbortController();
        setLogLines([]);
        setLogsScroll(0);
        void composeLogs(
            project,
            screen.service,
            (l) => {
                setLogLines((prev) => {
                    const next = prev.concat(l);
                    return next.length > MAX_LOG_LINES ? next.slice(next.length - MAX_LOG_LINES) : next;
                });
                // Keep the viewport anchored on the content being read while scrolled up.
                setLogsScroll((s) => (s > 0 ? s + 1 : 0));
            },
            controller.signal,
        ).catch(() => {});
        return () => controller.abort();
    }, [screen, projects]);

    // Keep the logs scroll offset within range as the buffer grows / the window resizes.
    useEffect(() => {
        if (screen.kind !== "logs") return;
        const visible = Math.max(3, rows - 3);
        const maxScroll = Math.max(0, logLines.length - visible);
        setLogsScroll((s) => Math.min(s, maxScroll));
    }, [logLines.length, rows, screen.kind]);

    // Mouse-wheel scrolling on the logs screen. Enable SGR mouse reporting only
    // while logs are open (so normal text selection works everywhere else), and
    // translate wheel events into scroll. Upper bound is clamped by the effect above.
    useEffect(() => {
        if (screen.kind !== "logs") return;
        const stdin = process.stdin;
        process.stdout.write("\x1b[?1000h\x1b[?1006h"); // button + SGR mouse reporting
        const onData = (chunk: Buffer | string) => {
            const s = typeof chunk === "string" ? chunk : chunk.toString("utf8");
            const re = /\x1b\[<(\d+);\d+;\d+[Mm]/g;
            let m: RegExpExecArray | null;
            let delta = 0;
            while ((m = re.exec(s)) !== null) {
                const btn = Number(m[1]);
                if (btn & 64) delta += btn & 1 ? -3 : 3; // wheel: down = newer, up = older
            }
            if (delta) setLogsScroll((v) => Math.max(0, v + delta));
        };
        stdin.on("data", onData);
        return () => {
            stdin.off("data", onData);
            process.stdout.write("\x1b[?1000l\x1b[?1006l"); // disable mouse reporting
        };
    }, [screen.kind]);

    // Keep selection + persisted session valid as the ordered set changes.
    useEffect(() => {
        if (orderedViews.length && (!selectedDir || !orderedViews.some((v) => v.dir === selectedDir))) {
            setSelectedDir(orderedViews[0].dir);
        }
        session.selectedDir = selectedDir;
    }, [orderedViews, selectedDir]);

    // Clamp service selection when the service set changes.
    useEffect(() => {
        setServiceIndex((i) => Math.min(i, Math.max(0, rowsForDetail.length - 1)));
    }, [rowsForDetail.length]);

    // Reset palette cursor as its filtered set changes.
    useEffect(() => {
        setPaletteIndex((i) => Math.min(i, Math.max(0, paletteList.length - 1)));
    }, [paletteList.length]);

    // Clamp the browser cursor to the current directory listing (".." + entries).
    useEffect(() => {
        setBrowseIndex((i) => Math.min(i, browseEntries.length));
    }, [browseEntries.length]);

    // ---- actions ----------------------------------------------------------
    const runAction = useCallback(
        (p: ProjectView, label: string, fn: (onLine: (l: string) => void) => Promise<{ ok: boolean }>) => {
            if (busy[p.dir]) return;
            setBusy((b) => ({ ...b, [p.dir]: label }));
            setOutputScroll(0); // snap to the tail so the new run is visible
            append(`❯ ${p.name}: ${label}…`);
            void (async () => {
                try {
                    const res = await fn((l) => append(`  [${p.name}] ${l}`));
                    append(`${res.ok ? "✓" : "✗"} ${p.name}: ${label} ${res.ok ? "done" : "failed"}`);
                } catch (err) {
                    append(`✗ ${p.name}: ${label} — ${(err as Error).message}`);
                } finally {
                    setBusy((b) => {
                        const next = { ...b };
                        delete next[p.dir];
                        return next;
                    });
                    void refresh();
                }
            })();
        },
        [busy, append, refresh],
    );

    const shellInto = useCallback(
        (p: ProjectView, service?: string) => {
            const rowsList = serviceRows(p);
            const running = rowsList.filter((r) => r.container?.state === "running");
            const target = service ? rowsList.find((r) => r.name === service) : running[0];
            if (!target || target.container?.state !== "running") {
                append(`! ${p.name}: no running container to shell into — start it first (s)`);
                return;
            }
            onSuspend({
                cmd: composeExecShell(target.name),
                cwd: p.dir,
                note: `${p.name} → ${target.name}`,
            });
        },
        [append, onSuspend],
    );

    const openLogs = useCallback(
        (dir: string, service?: string) => {
            logsReturn.current = screen;
            setScreen({ kind: "logs", dir, service });
        },
        [screen],
    );

    const move = useCallback(
        (delta: number) => {
            if (!orderedViews.length) return;
            const i = Math.max(
                0,
                orderedViews.findIndex((v) => v.dir === selectedDir),
            );
            const ni = Math.min(orderedViews.length - 1, Math.max(0, i + delta));
            setSelectedDir(orderedViews[ni].dir);
        },
        [orderedViews, selectedDir],
    );

    const toggleFavorite = useCallback((dir: string) => {
        setFavorites((prev) => {
            const next = prev.includes(dir) ? prev.filter((d) => d !== dir) : [...prev, dir];
            saveFavorites(next);
            return next;
        });
    }, []);

    const addRootPath = useCallback(
        (abs: string) => {
            if (roots.includes(abs)) {
                setSettingsIndex(roots.indexOf(abs));
                return;
            }
            const next = [...roots, abs];
            setRoots(next);
            updateConfig({ roots: next });
            setSettingsIndex(next.length - 1);
            rescan(next);
        },
        [roots, rescan],
    );

    const openBrowse = useCallback(() => {
        // Start from an existing root's parent when possible, else HOME.
        const start = roots[settingsIndex] ? dirname(roots[settingsIndex]) : HOME;
        setBrowsePath(existsSync(start) ? start : HOME);
        setBrowseIndex(0);
        setShowHidden(false);
        setBrowseActive(true);
    }, [roots, settingsIndex]);

    const removeRoot = useCallback(
        (i: number) => {
            if (i < 0 || i >= roots.length) return;
            const next = roots.filter((_, idx) => idx !== i);
            setRoots(next);
            updateConfig({ roots: next });
            setSettingsIndex(Math.min(i, next.length));
            rescan(next);
        },
        [roots, rescan],
    );

    const finishSettings = useCallback(() => {
        updateConfig({ roots }); // ensure the file exists after first-run setup
        setFirstRunFlag(false);
        setScreen({ kind: "list" });
        rescan(roots);
    }, [roots, rescan]);

    const startUpdate = useCallback(() => {
        setUpdatingActive(true);
        setUpdateLog([]);
        setUpdateResult(null);
        void applyUpdate((line) => setUpdateLog((prev) => [...prev, line]))
            .then((ok) => {
                setUpdateResult(ok ? "ok" : "fail");
                if (ok) setUpdatedTo((v) => updateAvailable ?? v);
            })
            .catch(() => setUpdateResult("fail"));
    }, [updateAvailable]);

    // ---- input ------------------------------------------------------------
    useInput((input, key) => {
        // Global quit.
        if (key.ctrl && input === "c") {
            exit();
            return;
        }

        // Help overlay: any key dismisses it; "?" opens it from any non-text context.
        if (helpActive) {
            setHelpActive(false);
            return;
        }
        if (input === "?" && !filterActive && !paletteActive) {
            setHelpActive(true);
            return;
        }

        // In-app updater overlay.
        if (updatingActive) {
            if (updateResult === null) return; // download in progress — ignore keys
            if (updateResult === "ok" && key.return) {
                onRelaunch();
                return;
            }
            setUpdatingActive(false); // any other key dismisses once finished
            return;
        }
        if (input === "U" && updateAvailable && !updatedTo && !filterActive && !paletteActive) {
            startUpdate();
            return;
        }

        // Palette overlay.
        if (paletteActive) {
            if (key.escape) setPaletteActive(false);
            else if (key.upArrow) setPaletteIndex((i) => Math.max(0, i - 1));
            else if (key.downArrow) setPaletteIndex((i) => Math.min(paletteList.length - 1, i + 1));
            else if (key.backspace || key.delete) setPaletteQuery((q) => q.slice(0, -1));
            else if (key.return) {
                const t = paletteList[paletteIndex];
                if (paletteProject && t) {
                    const p = paletteProject;
                    setPaletteActive(false);
                    // Launched from the list: drop into the project so its output is visible.
                    if (screen.kind === "list") {
                        setSelectedDir(p.dir);
                        setServiceIndex(0);
                        setOutputScroll(0);
                        setScreen({ kind: "detail", dir: p.dir });
                    }
                    runAction(p, `make ${t.name}`, (onLine) => makeRun(p, t.name, onLine));
                }
            } else if (isText(input, key)) setPaletteQuery((q) => q + input);
            return;
        }

        // Settings screen.
        if (screen.kind === "settings") {
            // Directory browser overlay.
            if (browseActive) {
                const maxIndex = browseEntries.length; // 0 = "..", 1.. = entries
                if (key.escape) setBrowseActive(false);
                else if (key.upArrow || input === "k") setBrowseIndex((i) => Math.max(0, i - 1));
                else if (key.downArrow || input === "j")
                    setBrowseIndex((i) => Math.min(maxIndex, i + 1));
                else if (input === ".") {
                    setShowHidden((h) => !h);
                    setBrowseIndex(0);
                } else if (input === "a" || input === " ") {
                    // Add the highlighted folder (or the current dir when on the ".." row).
                    const target =
                        browseIndex === 0 ? browsePath : browseEntries[browseIndex - 1]?.path;
                    if (target) addRootPath(target);
                    // Stay in the browser so several folders can be added in a row.
                } else if (key.leftArrow || input === "h") {
                    setBrowsePath((p) => dirname(p));
                    setBrowseIndex(0);
                } else if (key.return || key.rightArrow || input === "l") {
                    if (browseIndex === 0) setBrowsePath((p) => dirname(p));
                    else {
                        const e = browseEntries[browseIndex - 1];
                        if (e) setBrowsePath(e.path);
                    }
                    setBrowseIndex(0);
                }
                return;
            }
            const addRowIndex = roots.length;
            if (key.escape) finishSettings();
            else if (input === "q") {
                updateConfig({ roots });
                exit();
            } else if (key.upArrow || input === "k") setSettingsIndex((i) => Math.max(0, i - 1));
            else if (key.downArrow || input === "j")
                setSettingsIndex((i) => Math.min(addRowIndex, i + 1));
            else if (input === "a") openBrowse();
            else if (input === "d") {
                if (settingsIndex < addRowIndex) removeRoot(settingsIndex);
            } else if (key.return) {
                if (settingsIndex === addRowIndex) openBrowse();
                else finishSettings();
            }
            return;
        }

        // Logs screen.
        if (screen.kind === "logs") {
            const visible = Math.max(3, rows - 3);
            const maxScroll = Math.max(0, logLines.length - visible);
            const page = Math.max(1, visible - 1);
            if (key.escape || key.leftArrow) setScreen(logsReturn.current);
            else if (input === "c") {
                setLogLines([]);
                setLogsScroll(0);
            } else if (input === "q") exit();
            else if (key.upArrow || input === "k") setLogsScroll((s) => Math.min(maxScroll, s + 1));
            else if (key.downArrow || input === "j") setLogsScroll((s) => Math.max(0, s - 1));
            else if (key.pageUp || (key.ctrl && input === "u"))
                setLogsScroll((s) => Math.min(maxScroll, s + page));
            else if (key.pageDown || (key.ctrl && input === "d"))
                setLogsScroll((s) => Math.max(0, s - page));
            else if (input === "g") setLogsScroll(maxScroll); // oldest
            else if (input === "G") setLogsScroll(0); // newest / follow
            return;
        }

        // Detail screen.
        if (screen.kind === "detail") {
            const p = detailProject;
            if (key.escape || key.leftArrow) setScreen({ kind: "list" });
            else if (input === "q") exit();
            else if (key.upArrow || input === "k") setServiceIndex((i) => Math.max(0, i - 1));
            else if (key.downArrow || input === "j")
                setServiceIndex((i) => Math.min(rowsForDetail.length - 1, i + 1));
            else if (key.pageUp || key.pageDown || (key.ctrl && (input === "u" || input === "d"))) {
                const { outputArea } = detailPanes(Math.max(3, rows - 3), rowsForDetail.length);
                const visible = outputVisible(outputArea, !!(p && busy[p.dir]));
                const maxScroll = Math.max(0, output.length - visible);
                const up = key.pageUp || (key.ctrl && input === "u");
                const page = key.ctrl ? Math.max(1, Math.floor(visible / 2)) : Math.max(1, visible - 1);
                setOutputScroll((s) => (up ? Math.min(maxScroll, s + page) : Math.max(0, s - page)));
            } else if (!p) return;
            else if (input === "u" && p.mechanism === "compose")
                runAction(p, "up", (o) => composeUp(p, o));
            else if (input === "s" && p.mechanism === "compose")
                runAction(p, "stop", (o) => composeStop(p, o));
            else if (input === "d" && p.mechanism === "compose")
                runAction(p, "down", (o) => composeDown(p, o));
            else if (input === "e" && p.mechanism === "compose")
                runAction(p, "restart", (o) => composeRestart(p, o));
            else if (input === "l" || key.return) openLogs(p.dir, selectedService);
            else if (input === "S") shellInto(p, selectedService);
            else if (input === "f") toggleFavorite(p.dir);
            else if (input === "m" && paletteTargets(p).length) {
                setPaletteQuery("");
                setPaletteIndex(0);
                setPaletteActive(true);
            }
            return;
        }

        // List screen — filter mode.
        if (filterActive) {
            if (key.escape) {
                setFilterActive(false);
                setFilterQuery("");
            } else if (key.return) setFilterActive(false);
            else if (key.upArrow) move(-1);
            else if (key.downArrow) move(1);
            else if (key.backspace || key.delete) setFilterQuery((q) => q.slice(0, -1));
            else if (isText(input, key)) setFilterQuery((q) => q + input);
            return;
        }

        // List screen — navigation.
        if (key.escape) setFilterQuery("");
        else if (input === "q") exit();
        else if (input.startsWith("/")) {
            setFilterActive(true);
            setFilterQuery(input.slice(1));
        } else if (key.upArrow || input === "k") move(-1);
        else if (key.downArrow || input === "j") move(1);
        else if (input === "g") setSelectedDir(orderedViews[0]?.dir ?? null);
        else if (input === "G") setSelectedDir(orderedViews[orderedViews.length - 1]?.dir ?? null);
        else if (input === "r") void refresh();
        else if (input === "R") rescan();
        else if (input === ",") {
            setSettingsIndex(0);
            setBrowseActive(false);
            setScreen({ kind: "settings" });
        } else if (!current) return;
        else if (input === "f") toggleFavorite(current.dir);
        else if (key.return) {
            setScreen({ kind: "detail", dir: current.dir });
            setServiceIndex(0);
            setOutputScroll(0);
        } else if (input === "u" && current.mechanism === "compose")
            runAction(current, "up", (o) => composeUp(current, o));
        else if (input === "s" && current.mechanism === "compose")
            runAction(current, "stop", (o) => composeStop(current, o));
        else if (input === "d" && current.mechanism === "compose")
            runAction(current, "down", (o) => composeDown(current, o));
        else if (input === "e" && current.mechanism === "compose")
            runAction(current, "restart", (o) => composeRestart(current, o));
        else if (input === "l") openLogs(current.dir);
        else if (input === "S") shellInto(current);
        else if (input === "m" && paletteTargets(current).length) {
            setPaletteQuery("");
            setPaletteIndex(0);
            setPaletteActive(true);
        }
    });

    // ---- render -----------------------------------------------------------
    const runningContainers = views.reduce((n, v) => n + v.runningCount, 0);
    const totalContainers = views.reduce((n, v) => n + v.containers.length, 0);
    // Show the welcome banner atop the plain list (home) when there's vertical room;
    // otherwise a compact one-line header. Chrome: banner+footer OR header+divider+footer.
    const showBanner =
        (screen.kind === "list" || screen.kind === "settings") &&
        !paletteActive &&
        !helpActive &&
        !updatingActive &&
        rows >= BANNER_ROWS + 6 &&
        columns >= BANNER_COLS;
    // A one-line "update available" hint on the home screen (height-accounted).
    const showUpdateNotice =
        screen.kind === "list" &&
        !!updateAvailable &&
        !paletteActive &&
        !helpActive &&
        !updatingActive;
    const bodyRows = Math.max(
        3,
        rows - (showBanner ? BANNER_ROWS + 2 : 3) - (showUpdateNotice ? 1 : 0),
    );

    let header: React.ReactNode;
    let footer: React.ReactNode;
    let body: React.ReactNode;

    if (updatingActive) {
        header = (
            <Header
                columns={columns}
                left={
                    <Text>
                        <Text color="cyan">↑ </Text>
                        <Text bold>Updating komodo</Text>
                        {updateAvailable ? <Text color="gray"> → {updateAvailable}</Text> : null}
                    </Text>
                }
            />
        );
        body = (
            <Box flexDirection="column" height={bodyRows}>
                {updateLog.map((l, i) => (
                    <Text key={i} color="gray" wrap="truncate-end">
                        {l}
                    </Text>
                ))}
                {updateResult === null ? (
                    <Text color="yellow">
                        {"  "}
                        <Spinner type="dots" /> working…
                    </Text>
                ) : null}
                {updateResult === "ok" ? (
                    <Text color="green">{"  "}✓ done — restart to run the new version</Text>
                ) : null}
                {updateResult === "fail" ? (
                    <Text color="red">{"  "}✗ update failed</Text>
                ) : null}
            </Box>
        );
        footer = (
            <Footer columns={columns}>
                {updateResult === null ? (
                    "downloading — please wait"
                ) : updateResult === "ok" ? (
                    <>
                        <Key k="⏎" /> restart now · <Key k="esc" /> restart later
                    </>
                ) : (
                    <>
                        <Key k="esc" /> dismiss
                    </>
                )}
            </Footer>
        );
    } else if (helpActive) {
        header = (
            <Header
                columns={columns}
                left={
                    <Text>
                        <Text color="cyan">? </Text>
                        <Text bold>Keyboard shortcuts</Text>
                    </Text>
                }
            />
        );
        body = <HelpScreen bodyRows={bodyRows} columns={columns} />;
        footer = (
            <Footer columns={columns}>
                press any key to close
            </Footer>
        );
    } else if (paletteActive) {
        header = (
            <Header
                columns={columns}
                left={
                    <Text>
                        <Text color="cyan">← </Text>
                        <Text color="yellow">⚙ </Text>
                        <Text bold>Makefile</Text>
                        <Text color="gray"> · {paletteProject?.name ?? ""}</Text>
                    </Text>
                }
            />
        );
        body = (
            <PaletteScreen
                targets={paletteList}
                index={paletteIndex}
                query={paletteQuery}
                bodyRows={bodyRows}
                columns={columns}
            />
        );
        footer = (
            <Footer columns={columns}>
                <Key k="↑↓" /> select · <Key k="⏎" /> run · type to filter · <Key k="esc" /> cancel
            </Footer>
        );
    } else if (screen.kind === "logs" && detailProject) {
        header = (
            <Header
                columns={columns}
                left={
                    <Text>
                        <Text color="cyan">← </Text>logs · <Text bold>{detailProject.name}</Text>
                        {screen.service ? <Text color="gray"> / {screen.service}</Text> : null}
                    </Text>
                }
                right={<Text color="green">streaming ●</Text>}
            />
        );
        body = <LogsScreen lines={logLines} bodyRows={bodyRows} columns={columns} scroll={logsScroll} />;
        footer = (
            <Footer columns={columns}>
                <Key k="↑↓/wheel" /> scroll · <Key k="g/G" /> top/bottom · <Key k="c" /> clear ·{" "}
                <Key k="esc" /> back · <Key k="q" /> quit
            </Footer>
        );
    } else if (screen.kind === "detail" && detailProject) {
        header = (
            <Header
                columns={columns}
                left={
                    <Text>
                        <Text color="cyan">← </Text>
                        <Text bold>{detailProject.name}</Text> ·{" "}
                        <Text color={projectColor(detailProject.status)}>{detailProject.status}</Text>
                        <Text color="gray"> · {shortPath(detailProject.dir)}</Text>
                    </Text>
                }
            />
        );
        body = (
            <DetailScreen
                project={detailProject}
                rows={rowsForDetail}
                serviceIndex={serviceIndex}
                bodyRows={bodyRows}
                columns={columns}
                output={output}
                scroll={outputScroll}
                busyLabel={busy[detailProject.dir]}
            />
        );
        const canCompose = detailProject.mechanism === "compose";
        footer = (
            <Footer columns={columns}>
                <Key k="esc" /> back · <Key k="↑↓" /> service ·{" "}
                <Text color={canCompose ? "cyan" : "gray"}>u/s/d/e</Text> up/stop/down/restart ·{" "}
                <Key k="l" /> logs · <Key k="S" /> shell · <Key k="f" /> fav · <Key k="m" /> make ·{" "}
                <Key k="PgUp/Dn" /> scroll
            </Footer>
        );
    } else if (screen.kind === "settings" && browseActive) {
        header = (
            <Header
                columns={columns}
                left={
                    <Text>
                        <Text color="cyan">⚙ </Text>add folder · browse
                    </Text>
                }
            />
        );
        body = (
            <BrowseScreen
                path={browsePath}
                entries={browseEntries}
                index={browseIndex}
                roots={roots}
                alreadyRoot={roots.includes(browsePath)}
                bodyRows={bodyRows}
                columns={columns}
            />
        );
        footer = (
            <Footer columns={columns}>
                <Key k="↑↓" /> move · <Key k="⏎/→" /> open · <Key k="←" /> up · <Key k="a" /> add
                highlighted · <Key k="." /> hidden · <Key k="esc" /> done
            </Footer>
        );
    } else if (screen.kind === "settings") {
        header = (
            <Header
                columns={columns}
                left={
                    <Text>
                        <Text color="cyan">⚙ </Text>
                        {firstRunFlag ? "Setup" : "Settings"} · project folders
                    </Text>
                }
            />
        );
        body = (
            <SettingsScreen
                infos={rootsInfo}
                selectedIndex={settingsIndex}
                firstRun={firstRunFlag}
                bodyRows={bodyRows}
                columns={columns}
            />
        );
        footer = (
            <Footer columns={columns}>
                <Key k="↑↓" /> move · <Key k="a" /> add · <Key k="d" /> remove · <Key k="esc" /> done ·{" "}
                <Key k="q" /> quit
            </Footer>
        );
    } else {
        header = (
            <Header
                columns={columns}
                left={
                    <Text>
                        <Text bold color="cyan">
                            Komodo
                        </Text>{" "}
                        <Text color="gray">
                            {engineOk && engineVersion ? `docker ${engineVersion}` : "docker ✗"} ·{" "}
                            {views.length} projects ·{" "}
                            <Text color="green">
                                {runningContainers}/{totalContainers} containers up
                            </Text>
                            {scanning ? " · scanning…" : ""}
                        </Text>
                    </Text>
                }
                right={!filterActive ? <Text color="gray">/ filter</Text> : undefined}
            />
        );
        body = (
            <ListScreen
                sections={sections}
                selectedDir={selectedDir}
                bodyRows={bodyRows}
                columns={columns}
                busy={busy}
                favorites={favSet}
                filterActive={filterActive}
                filterQuery={filterQuery}
                projectCount={filtered.length}
                totalCount={views.length}
            />
        );
        footer = filterActive ? (
            <Footer columns={columns}>
                type to filter · <Key k="↑↓" /> move · <Key k="⏎" /> apply · <Key k="esc" /> clear
            </Footer>
        ) : (
            <Footer columns={columns}>
                <Key k="⏎" /> details · <Key k="u" /> up · <Key k="s" /> stop · <Key k="l" /> logs ·{" "}
                <Key k="f" /> fav · <Key k="m" /> make · <Key k="/" /> filter · <Key k="," /> folders ·{" "}
                <Key k="?" /> help · <Key k="q" /> quit
            </Footer>
        );
    }

    return (
        <Box
            flexDirection="column"
            width={termCols}
            height={termRows - 1}
            paddingTop={PAD_TOP}
            paddingX={PAD_X}
            overflow="hidden"
        >
            {showBanner ? (
                <>
                    <WelcomeBanner
                        engineVersion={engineVersion}
                        engineOk={engineOk}
                        composeVersion={composeVersion}
                        projectCount={views.length}
                        runningContainers={runningContainers}
                        totalContainers={totalContainers}
                        folderCount={roots.length}
                        columns={columns}
                    />
                    <Box height={1} />
                </>
            ) : (
                <>
                    {header}
                    <Divider columns={columns} />
                </>
            )}
            <Box height={bodyRows} overflow="hidden" flexDirection="column">
                {body}
            </Box>
            {showUpdateNotice ? (
                <Box width={columns}>
                    {updatedTo ? (
                        <Text color="green" wrap="truncate-end">
                            ✓ updated to {updatedTo} — restart komodo to apply
                        </Text>
                    ) : (
                        <Text color="yellow" wrap="truncate-end">
                            ↑ komodo {updateAvailable} available — press <Text color="cyan">U</Text> to
                            update
                        </Text>
                    )}
                </Box>
            ) : null}
            {footer}
        </Box>
    );
}
