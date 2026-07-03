import { basename } from "path";
import type { ProjectView } from "../model/types.js";

export interface Section {
    title: string;
    favorite: boolean;
    items: ProjectView[];
}

/**
 * Group projects into a `★ Favorites` section (pulled out of their folder) followed
 * by one section per configured root, in root order. Empty sections are omitted.
 * `views` is assumed already sorted (by name) and already filtered if a query is active.
 */
export function buildSections(
    views: ProjectView[],
    favorites: Set<string>,
    roots: string[],
): Section[] {
    const sections: Section[] = [];

    const favs = views.filter((v) => favorites.has(v.dir));
    if (favs.length) sections.push({ title: "★ Favorites", favorite: true, items: favs });

    for (const root of roots) {
        const items = views.filter((v) => v.root === root && !favorites.has(v.dir));
        if (items.length) sections.push({ title: basename(root), favorite: false, items });
    }

    // Projects under a root no longer in config (defensive) land in a catch-all.
    const known = new Set(roots);
    const orphans = views.filter((v) => !known.has(v.root) && !favorites.has(v.dir));
    if (orphans.length) sections.push({ title: "other", favorite: false, items: orphans });

    return sections;
}

/** Flattened navigation order matching the rendered section order. */
export function orderedItems(sections: Section[]): ProjectView[] {
    return sections.flatMap((s) => s.items);
}
