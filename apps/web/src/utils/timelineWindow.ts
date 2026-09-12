/**
 * Tidsfönstret — kartans standardlast är de närmaste TIMELINE_WINDOW_DAYS
 * dagarna, inte hela framtiden (egress-trappan steg "tidsfönster", 12/9).
 *
 * Uppmätt 12/9: fönstret bär 58 % av eventen men bara 1,21 MB mot fulla
 * lagrets 1,66 — och viktigare: tillväxten (säsongsscheman à la hockeyns
 * 7 → 788 matcher) landar nästan helt i svansen bortom fönstret, som bara
 * hämtas när besökaren faktiskt behöver den (sökning, datumbläddring nära
 * kanten, djuplänk/boost bortom fönstret — se linkEventService).
 *
 * KVANTISERINGEN ÄR HELA POÄNGEN: alla besökare i samma tidszon bygger
 * IDENTISKA from/till-strängar (lokal midnatt, samma formel som dagsslicen) →
 * CDN:en cachar EN fönster-slice per dygn. Slica ALDRIG på något
 * besökarunikt (viewport-bbox etc.) — då blir varje besök en cache-miss och
 * en dyr funktionsinvokation (se docs/egress-optimering.md, "Fällan").
 *
 * Bakkanten behöver ingen hantering: destinations-lagret innehåller aldrig
 * passerade dagar (aggregatorn filtrerar time >= dagens midnatt), så fönstrets
 * nedre gräns är identisk med fulla lagrets.
 */

export const TIMELINE_WINDOW_DAYS = 14;

export interface TimelineWindowRange {
    /** UTC-ISO för lokal midnatt idag — samma form som dagsslicens `from`. */
    fromIso: string;
    /** UTC-ISO för sista fönsterdagens 23:59:59.999 lokal tid. */
    toIso: string;
    /** Epoch-ms för fönstrets slut — horisonten UI:t jämför dagval mot. */
    toMs: number;
}

/** Dagens kvantiserade fönster. `now` är injicerbar för tester. */
export function timelineWindowRange(now: Date = new Date()): TimelineWindowRange {
    const from = new Date(now);
    from.setHours(0, 0, 0, 0);
    const to = new Date(from);
    to.setDate(to.getDate() + TIMELINE_WINDOW_DAYS - 1);
    to.setHours(23, 59, 59, 999);
    return { fromIso: from.toISOString(), toIso: to.toISOString(), toMs: to.getTime() };
}
