import type { LinkEvent } from '@/types';

/**
 * Profilens "Mina event": en VECKOSERIE visas som EN rad, inte som varje
 * utvecklat tillfälle (Josef 14/9: "nu blir det en jättelång lista").
 * Representanten är nästa kommande tillfälle, så raden visar när serien
 * händer härnäst; en helt passerad serie representeras av sitt senaste
 * tillfälle. Övriga event passerar orörda. Utlistan är i tidsordning.
 *
 * Serienyckeln är seriesId (expandWeekly sätter den på varje utvecklat
 * tillfälle) med fallback till id-stammen före "__" — samma stam som
 * raderingen redan går på (handleDeleteOwnEvent skalar suffixet), så en
 * grupperad rads soptunna tar korrekt bort HELA serien.
 */
export function collapseWeeklySeries(events: LinkEvent[], nowMs: number): LinkEvent[] {
    const singles: LinkEvent[] = [];
    const bySeries = new Map<string, LinkEvent[]>();
    for (const evt of events) {
        const key = evt.seriesId ?? (evt.repeatWeekly ? evt.id.split('__')[0] : null);
        if (!key) { singles.push(evt); continue; }
        const arr = bySeries.get(key);
        if (arr) arr.push(evt); else bySeries.set(key, [evt]);
    }
    const reps: LinkEvent[] = [];
    for (const occurrences of bySeries.values()) {
        const upcoming = occurrences.filter(e => e.time.getTime() >= nowMs);
        const pickEarliest = upcoming.length > 0;
        const pool = pickEarliest ? upcoming : occurrences;
        reps.push(pool.reduce((best, e) => {
            const better = pickEarliest
                ? e.time.getTime() < best.time.getTime()
                : e.time.getTime() > best.time.getTime();
            return better ? e : best;
        }));
    }
    return [...singles, ...reps].sort((a, b) => a.time.getTime() - b.time.getTime());
}
