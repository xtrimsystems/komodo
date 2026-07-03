import React from "react";
import { Box, Text } from "ink";
import type { DirEntry } from "../discovery/browse.js";
import { glyph } from "./theme.js";

interface Props {
    path: string;
    entries: DirEntry[];
    index: number; // 0 = the ".." row, 1.. = entries
    roots: string[];
    alreadyRoot: boolean;
    bodyRows: number;
    columns: number;
}

export default function BrowseScreen({ path, entries, index, roots, alreadyRoot, bodyRows }: Props) {
    const listRows = Math.max(1, bodyRows - 1);
    const total = entries.length + 1; // ".." + entries

    let offset = 0;
    if (total > listRows) {
        offset = Math.min(Math.max(0, index - Math.floor(listRows / 2)), total - listRows);
    }

    const rows: React.ReactNode[] = [];
    for (let i = offset; i < Math.min(total, offset + listRows); i++) {
        const isSel = i === index;
        if (i === 0) {
            rows.push(
                <Text key=".." color={isSel ? "cyan" : "gray"}>
                    {isSel ? glyph.pointer : " "} ../
                    {isSel ? <Text color="gray">   (a → add current folder)</Text> : null}
                </Text>,
            );
            continue;
        }
        const e = entries[i - 1];
        const added = roots.includes(e.path);
        rows.push(
            <Box key={e.path}>
                <Text color="cyan">{isSel ? glyph.pointer : " "} </Text>
                <Text bold={isSel} color={added ? "yellow" : undefined}>
                    {e.name}/
                </Text>
                {e.isProject ? <Text color="green"> · project</Text> : null}
                {added ? <Text color="yellow"> · added</Text> : null}
            </Box>,
        );
    }

    return (
        <Box flexDirection="column" height={bodyRows}>
            <Text color="gray" wrap="truncate-start">
                {path}
                {alreadyRoot ? <Text color="yellow">  (already a scan folder)</Text> : null}
            </Text>
            {rows}
            {entries.length === 0 ? <Text color="gray">  (no subfolders)</Text> : null}
        </Box>
    );
}
