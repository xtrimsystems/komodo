import { readFileSync } from "fs";
import { parse } from "yaml";
import type { ComposeService } from "../model/types.js";

/**
 * Parse services from one or more compose files, merging by service name.
 * A `name:` top-level key (compose spec) overrides the derived project name.
 */
export function parseComposeServices(files: string[]): {
    services: ComposeService[];
    projectName?: string;
} {
    const merged = new Map<string, ComposeService>();
    let projectName: string | undefined;
    for (const f of files) {
        let doc: any;
        try {
            doc = parse(readFileSync(f, "utf8"));
        } catch {
            continue; // ignore unparseable / templated files
        }
        if (doc?.name && !projectName) projectName = String(doc.name);
        const services = doc?.services;
        if (!services || typeof services !== "object") continue;
        for (const [name, def] of Object.entries<any>(services)) {
            const existing = merged.get(name);
            if (!existing) {
                merged.set(name, { name, image: def?.image });
            } else if (def?.image && !existing.image) {
                existing.image = def.image;
            }
        }
    }
    return { services: [...merged.values()], projectName };
}
