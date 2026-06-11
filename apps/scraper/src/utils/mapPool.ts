/**
 * mapPool — map över items med begränsad samtidighet, ordningsbevarande.
 *
 * Som Promise.all(items.map(fn)) men max `limit` samtidiga fn-anrop.
 * Används av engines med många per-event-hämtningar (Röda Korset,
 * Friluftsfrämjandet) för att inte hamra källans server.
 */
export async function mapPool<T, R>(items: T[], limit: number, fn: (it: T) => Promise<R>): Promise<R[]> {
    const out: R[] = new Array(items.length);
    let next = 0;
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (true) {
            const i = next++;
            if (i >= items.length) break;
            out[i] = await fn(items[i]);
        }
    }));
    return out;
}
