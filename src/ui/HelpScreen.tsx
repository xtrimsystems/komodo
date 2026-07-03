import React from "react";
import { Box, Text } from "ink";

interface Props {
    bodyRows: number;
    columns: number;
}

interface Group {
    title: string;
    keys: { k: string; desc: string }[];
}

const GROUPS: Group[] = [
    {
        title: "Navigate",
        keys: [
            { k: "↑ ↓ / j k", desc: "move up / down" },
            { k: "g / G", desc: "jump to top / bottom" },
            { k: "⏎", desc: "open the selected project" },
            { k: "esc / ←", desc: "back / clear filter" },
            { k: "q", desc: "quit komodo" },
        ],
    },
    {
        title: "Compose",
        keys: [
            { k: "u", desc: "start (up -d)" },
            { k: "s", desc: "stop" },
            { k: "d", desc: "down (remove)" },
            { k: "e", desc: "restart" },
        ],
    },
    {
        title: "Inspect",
        keys: [
            { k: "l", desc: "stream logs" },
            { k: "S", desc: "shell into a service" },
            { k: "m", desc: "run a make target" },
            { k: "PgUp/PgDn ^U/^D", desc: "scroll output" },
        ],
    },
    {
        title: "Logs",
        keys: [
            { k: "↑ ↓ / wheel", desc: "scroll logs" },
            { k: "PgUp/PgDn ^U/^D", desc: "scroll by a page" },
            { k: "g / G", desc: "oldest / newest (follow)" },
            { k: "c", desc: "clear the buffer" },
        ],
    },
    {
        title: "Manage",
        keys: [
            { k: "f", desc: "toggle favorite" },
            { k: "/", desc: "filter projects by name" },
            { k: ",", desc: "add / remove project folders" },
            { k: "r", desc: "refresh container status" },
            { k: "R", desc: "rescan folders for projects" },
        ],
    },
    {
        title: "Anywhere",
        keys: [
            { k: "?", desc: "show this help" },
            { k: "ctrl-c", desc: "quit immediately" },
        ],
    },
];

/** Full-screen keyboard-shortcut reference; any key closes it (handled in App). */
export default function HelpScreen({ bodyRows, columns }: Props) {
    // Two columns side by side when there's room, otherwise a single stack.
    const twoCol = columns >= 72;
    const mid = Math.ceil(GROUPS.length / 2);
    const cols = twoCol ? [GROUPS.slice(0, mid), GROUPS.slice(mid)] : [GROUPS];
    const keyW = Math.max(...GROUPS.flatMap((g) => g.keys.map((x) => x.k.length)));

    const renderGroup = (g: Group) => (
        <Box key={g.title} flexDirection="column" marginBottom={1}>
            <Text bold color="green">
                {g.title}
            </Text>
            {g.keys.map((x) => (
                <Text key={x.k}>
                    <Text color="cyan">{"  " + x.k.padEnd(keyW)}</Text>
                    <Text color="gray">{"  " + x.desc}</Text>
                </Text>
            ))}
        </Box>
    );

    return (
        <Box flexDirection="column" height={bodyRows}>
            <Box flexDirection="row" gap={4}>
                {cols.map((groups, i) => (
                    <Box key={i} flexDirection="column">
                        {groups.map(renderGroup)}
                    </Box>
                ))}
            </Box>
        </Box>
    );
}
