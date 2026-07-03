/**
 * Subsequence fuzzy match. Returns a score (higher = better) if every character
 * of `query` appears in `text` in order, else null. Contiguous runs and matches
 * at the start of the string score higher.
 */
export function fuzzyScore(query: string, text: string): number | null {
    if (!query) return 0;
    const q = query.toLowerCase();
    const t = text.toLowerCase();
    let qi = 0;
    let score = 0;
    let lastIdx = -1;
    for (let i = 0; i < t.length && qi < q.length; i++) {
        if (t[i] === q[qi]) {
            const contiguous = lastIdx === i - 1 ? 3 : 0;
            const atStart = i === 0 ? 5 : 0;
            score += 1 + contiguous + atStart;
            lastIdx = i;
            qi++;
        }
    }
    return qi === q.length ? score : null;
}

/**
 * Filter and rank `items` by how well `query` matches the string from `key`.
 * Stable: equal scores keep original order. Empty query returns items unchanged.
 */
export function fuzzyFilter<T>(items: T[], query: string, key: (item: T) => string): T[] {
    if (!query.trim()) return items;
    const scored: { item: T; score: number; index: number }[] = [];
    items.forEach((item, index) => {
        const score = fuzzyScore(query, key(item));
        if (score !== null) scored.push({ item, score, index });
    });
    scored.sort((a, b) => b.score - a.score || a.index - b.index);
    return scored.map((s) => s.item);
}
