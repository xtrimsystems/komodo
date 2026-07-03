import React from "react";
import { Box, Text } from "ink";
import { BANNER_INTERIOR_ROWS, bannerLines, BANNER_COLS } from "./komodoArt.js";
import { VERSION } from "../version.js";

/** Rows the banner occupies: top border + top padding + interior + bottom border. */
export const BANNER_ROWS = BANNER_INTERIOR_ROWS + 3;
export { BANNER_COLS };

interface Props {
    engineVersion: string | null;
    engineOk: boolean;
    composeVersion: string | null;
    projectCount: number;
    runningContainers: number;
    totalContainers: number;
    folderCount: number;
    columns: number;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export default function WelcomeBanner({
    engineVersion,
    engineOk,
    composeVersion,
    projectCount,
    runningContainers,
    totalContainers,
    folderCount,
}: Props) {
    // Line 1: engine + compose versions. Line 2: what komodo currently sees.
    const versions =
        `${engineOk && engineVersion ? `docker ${engineVersion}` : "docker ✗"}` +
        ` · ${composeVersion ? `compose ${composeVersion}` : "compose ✗"}`;
    const counts =
        `${plural(projectCount, "project")} · ${runningContainers}/${totalContainers} containers up` +
        ` · ${plural(folderCount, "folder")}`;
    const lines = bannerLines([versions, counts], `v${VERSION}`);
    return (
        <Box flexDirection="column">
            {lines.map((line, i) => (
                <Text key={i}>{line}</Text>
            ))}
        </Box>
    );
}
