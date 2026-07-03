import React from "react";
import { Box, Text } from "ink";

interface Props {
    lines: string[];
    bodyRows: number;
    columns: number;
    /** Scroll offset: lines up from the bottom (0 = tail / follow). Clamped here. */
    scroll: number;
}

export default function LogsScreen({ lines, bodyRows, scroll }: Props) {
    const visible = bodyRows;
    const maxScroll = Math.max(0, lines.length - visible);
    const clamped = Math.min(Math.max(0, scroll), maxScroll);
    const end = lines.length - clamped;
    const start = Math.max(0, end - visible);
    const shown = lines.slice(start, end);
    // Pad the top so logs sit at the bottom and grow upward (terminal-like).
    const pad = Math.max(0, visible - shown.length);
    return (
        <Box flexDirection="column" height={bodyRows}>
            {Array.from({ length: pad }, (_, i) => (
                <Text key={`pad-${i}`}> </Text>
            ))}
            {shown.map((line, i) => (
                <Text key={start + i} wrap="truncate-end">
                    {line}
                </Text>
            ))}
        </Box>
    );
}
