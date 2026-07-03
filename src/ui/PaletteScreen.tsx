import React from "react";
import { Box, Text } from "ink";
import type { MakeTarget } from "../model/types.js";
import { glyph } from "./theme.js";

interface Props {
    targets: MakeTarget[];
    index: number;
    query: string;
    bodyRows: number;
    columns: number;
}

export default function PaletteScreen({ targets, index, query, bodyRows }: Props) {
    const listRows = Math.max(1, bodyRows - 1);

    let offset = 0;
    if (targets.length > listRows) {
        offset = Math.min(
            Math.max(0, index - Math.floor(listRows / 2)),
            targets.length - listRows,
        );
    }
    const shown = targets.slice(offset, offset + listRows);

    return (
        <Box flexDirection="column" height={bodyRows}>
            <Text>
                <Text color="magenta">make ❯ </Text>
                {query}
                <Text color="cyan">▌</Text>
                <Text color="gray">
                    {"  "}
                    {targets.length} targets
                </Text>
            </Text>
            {shown.map((t) => {
                const isSel = targets.indexOf(t) === index;
                return (
                    <Box key={t.name}>
                        <Text color={isSel ? "cyan" : undefined}>
                            {isSel ? glyph.pointer : " "}{" "}
                            <Text bold={isSel}>{t.name.padEnd(18).slice(0, 18)}</Text>
                        </Text>
                        <Text color="gray" wrap="truncate-end">
                            {t.help}
                        </Text>
                    </Box>
                );
            })}
            {targets.length === 0 ? <Text color="gray">  no matching targets</Text> : null}
        </Box>
    );
}
