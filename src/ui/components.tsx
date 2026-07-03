import React from "react";
import { Box, Text } from "ink";

/** A cyan keycap for footer hints. */
export function Key({ k }: { k: string }) {
    return <Text color="cyan">{k}</Text>;
}

/** Full-width horizontal rule, optionally with a left-aligned label. Always one line. */
export function Divider({ columns, label }: { columns: number; label?: string }) {
    if (!label) {
        return <Text color="gray">{"─".repeat(Math.max(1, columns))}</Text>;
    }
    const prefix = `── ${label} `;
    const rest = Math.max(0, columns - prefix.length);
    return (
        <Text color="gray">
            {prefix}
            {"─".repeat(rest)}
        </Text>
    );
}

/** One-line header with a left node and an optional right-aligned gray hint. */
export function Header({
    columns,
    left,
    right,
}: {
    columns: number;
    left: React.ReactNode;
    right?: React.ReactNode;
}) {
    return (
        <Box width={columns} justifyContent="space-between">
            <Box>
                <Text wrap="truncate-end">{left}</Text>
            </Box>
            {right ? (
                <Box marginLeft={1}>
                    <Text color="gray" wrap="truncate-end">
                        {right}
                    </Text>
                </Box>
            ) : null}
        </Box>
    );
}

/** One-line footer that truncates rather than wrapping (keeps the height budget exact). */
export function Footer({ columns, children }: { columns: number; children: React.ReactNode }) {
    return (
        <Box width={columns}>
            <Text color="gray" wrap="truncate-end">
                {children}
            </Text>
        </Box>
    );
}
