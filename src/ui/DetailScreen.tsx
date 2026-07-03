import React from "react";
import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import type { ProjectView } from "../model/types.js";
import type { ServiceRow } from "../model/state.js";
import { containerColor, containerGlyph } from "./theme.js";
import { Divider } from "./components.js";

interface Props {
    project: ProjectView;
    rows: ServiceRow[];
    serviceIndex: number;
    bodyRows: number;
    columns: number;
    output: string[];
    /** Output scroll: lines up from the bottom (0 = tail). Clamped here for display. */
    scroll: number;
    busyLabel?: string;
}

/**
 * Split the detail body (minus the two section dividers) between the services
 * list and the output pane. Services take only what they need — all of them
 * when they fit — capped so a long list still leaves a usable output pane;
 * output gets the rest.
 */
export function detailPanes(bodyRows: number, serviceCount: number) {
    const usable = Math.max(2, bodyRows - 2); // two section dividers
    const minOutput = Math.max(3, Math.floor(usable * 0.35));
    const servicesArea = Math.min(Math.max(1, serviceCount), Math.max(1, usable - minOutput));
    const outputArea = Math.max(1, usable - servicesArea);
    return { servicesArea, outputArea };
}

/** Blank rows above the output text, so it doesn't hug the "output" divider. */
export const OUTPUT_TOP_MARGIN = 1;

/** How many output lines actually fit, after the top margin and the busy spinner. */
export function outputVisible(outputArea: number, busy: boolean): number {
    return Math.max(1, outputArea - OUTPUT_TOP_MARGIN - (busy ? 1 : 0));
}

export default function DetailScreen({
    project,
    rows,
    serviceIndex,
    bodyRows,
    columns,
    output,
    scroll,
    busyLabel,
}: Props) {
    const { servicesArea, outputArea } = detailPanes(bodyRows, rows.length);

    let sOffset = 0;
    if (rows.length > servicesArea) {
        sOffset = Math.min(
            Math.max(0, serviceIndex - Math.floor(servicesArea / 2)),
            rows.length - servicesArea,
        );
    }
    const shownServices = rows.slice(sOffset, sOffset + servicesArea);

    // Output pane: `scroll` counts lines up from the bottom. Clamp to the buffer.
    const visible = outputVisible(outputArea, !!busyLabel);
    const maxScroll = Math.max(0, output.length - visible);
    const clamped = Math.min(Math.max(0, scroll), maxScroll);
    const end = output.length - clamped;
    const start = Math.max(0, end - visible);
    const shownOutput = output.slice(start, end);
    const hiddenAbove = start;
    const hiddenBelow = output.length - end;
    const outLabel =
        output.length > visible ? `output   ↑ ${hiddenAbove}  ↓ ${hiddenBelow}` : "output";

    return (
        <Box flexDirection="column" height={bodyRows}>
            <Divider columns={columns} label={`services (${project.runningCount}/${project.serviceCount || rows.length})`} />
            <Box flexDirection="column" height={servicesArea}>
                {rows.length === 0 ? (
                    <Text color="gray">  {project.mechanism === "none" ? "no compose / Dockerfile" : "no services"}</Text>
                ) : (
                    shownServices.map((r) => {
                        const isSel = rows.indexOf(r) === serviceIndex;
                        const state = r.container?.state ?? "exited";
                        return (
                            <Box key={r.name}>
                                <Text color="cyan">{isSel ? "❯" : " "} </Text>
                                <Text color={containerColor(state, r.container?.health)}>
                                    {containerGlyph(state)}{" "}
                                </Text>
                                <Text bold={isSel}>{r.name.padEnd(20).slice(0, 20)} </Text>
                                <Text color="gray" wrap="truncate-end">
                                    {r.container ? r.container.status : "not created"}
                                </Text>
                            </Box>
                        );
                    })
                )}
            </Box>

            <Divider columns={columns} label={outLabel} />
            <Box flexDirection="column" height={outputArea}>
                <Text> </Text>{/* small top margin so output doesn't hug the divider */}
                {busyLabel ? (
                    <Text color="yellow">
                        {"  "}
                        <Spinner type="dots" /> {busyLabel}
                    </Text>
                ) : null}
                {shownOutput.map((line, i) => (
                    <Text key={start + i} color="gray" wrap="truncate-end">
                        {line}
                    </Text>
                ))}
            </Box>
        </Box>
    );
}
