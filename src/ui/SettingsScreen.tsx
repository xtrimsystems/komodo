import React from "react";
import { Box, Text } from "ink";
import { glyph } from "./theme.js";

export interface RootInfo {
    path: string;
    display: string;
    exists: boolean;
    count: number;
}

interface Props {
    infos: RootInfo[];
    selectedIndex: number; // 0..infos.length; the last index is the "add" row
    firstRun: boolean;
    bodyRows: number;
    columns: number;
}

export default function SettingsScreen({ infos, selectedIndex, firstRun, bodyRows }: Props) {
    const addRowIndex = infos.length;
    const reserved = 1 /* intro line */;
    const listRows = Math.max(1, bodyRows - reserved);

    // Combined selectable rows: each root, then the "add" row.
    const total = infos.length + 1;
    let offset = 0;
    if (total > listRows) {
        offset = Math.min(
            Math.max(0, selectedIndex - Math.floor(listRows / 2)),
            total - listRows,
        );
    }

    const pathWidth = Math.min(
        40,
        Math.max(16, ...infos.map((i) => i.display.length), 16),
    );

    const rows: React.ReactNode[] = [];
    for (let i = offset; i < Math.min(total, offset + listRows); i++) {
        const isSel = i === selectedIndex;
        if (i === addRowIndex) {
            rows.push(
                <Text key="add" color={isSel ? "cyan" : "green"}>
                    {isSel ? glyph.pointer : " "} ＋ add a folder…
                </Text>,
            );
            continue;
        }
        const info = infos[i];
        rows.push(
            <Box key={info.path}>
                <Text color="cyan">{isSel ? glyph.pointer : " "} </Text>
                <Text bold={isSel} color={info.exists ? undefined : "red"}>
                    {info.display.padEnd(pathWidth).slice(0, pathWidth)}{" "}
                </Text>
                <Text color="gray" wrap="truncate-end">
                    {info.exists ? `${info.count} project${info.count === 1 ? "" : "s"}` : "missing"}
                </Text>
            </Box>,
        );
    }

    return (
        <Box flexDirection="column" height={bodyRows}>
            <Text color="gray">
                {firstRun
                    ? "Welcome to Komodo — pick the folders to scan for projects:"
                    : "Folders scanned for projects (basename becomes a group header):"}
            </Text>
            {rows}
        </Box>
    );
}
