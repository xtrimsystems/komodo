import React from "react";
import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import type { ProjectView } from "../model/types.js";
import type { Section } from "./sections.js";
import { projectColor, projectGlyph, glyph, ICON_DOCKER, ICON_MAKE } from "./theme.js";

interface Props {
    sections: Section[];
    selectedDir: string | null;
    bodyRows: number;
    columns: number;
    busy: Record<string, string>;
    favorites: Set<string>;
    filterActive: boolean;
    filterQuery: string;
    projectCount: number;
    totalCount: number;
}

type Row =
    | { kind: "header"; title: string; favorite: boolean }
    | { kind: "spacer" }
    | { kind: "project"; view: ProjectView };

export default function ListScreen({
    sections,
    selectedDir,
    bodyRows,
    columns,
    busy,
    favorites,
    filterActive,
    filterQuery,
    projectCount,
    totalCount,
}: Props) {
    const filterLine = filterActive ? 1 : 0;
    const listRows = Math.max(1, bodyRows - filterLine);

    const rows: Row[] = [];
    sections.forEach((s, i) => {
        if (i > 0) rows.push({ kind: "spacer" });
        rows.push({ kind: "header", title: s.title, favorite: s.favorite });
        for (const v of s.items) rows.push({ kind: "project", view: v });
    });

    const allItems = sections.flatMap((s) => s.items);
    const nameWidth = Math.min(22, Math.max(8, ...allItems.map((v) => v.name.length), 8));
    // Right-align the count in a fixed-width column so the icons after it line up.
    const countWidth = Math.max(
        3,
        ...allItems.map((v) => (v.serviceCount ? `${v.runningCount}/${v.serviceCount}`.length : 0)),
    );

    const selectedRow = rows.findIndex((r) => r.kind === "project" && r.view.dir === selectedDir);
    let offset = 0;
    if (rows.length > listRows && selectedRow >= 0) {
        offset = Math.min(Math.max(0, selectedRow - Math.floor(listRows / 2)), rows.length - listRows);
    }
    const visible = rows.slice(offset, offset + listRows);

    return (
        <Box flexDirection="column" height={bodyRows}>
            {filterActive ? (
                <Text>
                    <Text color="cyan">/ </Text>
                    {filterQuery}
                    <Text color="cyan">▌</Text>
                    <Text color="gray">
                        {"  "}
                        {projectCount}/{totalCount} match
                    </Text>
                </Text>
            ) : null}

            {visible.map((row, i) => {
                if (row.kind === "spacer") return <Text key={`sp-${offset + i}`}> </Text>;
                if (row.kind === "header") {
                    return (
                        <Text key={`h-${row.title}`} bold underline color={row.favorite ? "yellow" : "cyan"}>
                            {row.title}
                        </Text>
                    );
                }
                const v = row.view;
                const isSel = v.dir === selectedDir;
                const label = busy[v.dir];
                // Fixed-width columns so the badges line up across every row.
                const count = (v.serviceCount ? `${v.runningCount}/${v.serviceCount}` : "").padStart(
                    countWidth,
                );
                return (
                    <Box key={v.dir}>
                        <Text color="cyan">{isSel ? glyph.pointer : " "} </Text>
                        <Text color={projectColor(v.status)}>{projectGlyph(v.status)} </Text>
                        <Text bold={isSel} color={isSel ? "white" : undefined}>
                            {v.name.padEnd(nameWidth).slice(0, nameWidth)}{" "}
                        </Text>
                        <Text color={projectColor(v.status)}>{v.status.padEnd(8)}</Text>
                        <Text color={projectColor(v.status)}>{" " + count}</Text>
                        <Text color={v.mechanism === "compose" ? "#4aa8ff" : "gray"}>
                            {"  " + ICON_DOCKER}
                        </Text>
                        <Text color="gray">{"  " + (v.makeTargets.length ? ICON_MAKE : " ")}</Text>
                        {label ? (
                            <Text color="yellow">
                                {"  "}
                                <Spinner type="dots" /> {label}
                            </Text>
                        ) : null}
                    </Box>
                );
            })}

            {allItems.length === 0 ? (
                <Text color="gray">
                    {filterActive
                        ? "  no matches"
                        : "  no projects — check roots in ~/.config/komodo/config.json"}
                </Text>
            ) : null}
        </Box>
    );
}
