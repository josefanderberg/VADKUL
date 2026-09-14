/**
 * "Först sedd"-exporten till destinations-aggregatet (fältet `fs`).
 *
 * Grunden för webbens "Nytt sedan sist"-banner: webben jämför fältet mot
 * besökarens förra besök (dag-precision, UTC). Bara event som dykt upp i
 * pipelinen de senaste FIRST_SEEN_EXPORT_DAYS dagarna bär fältet — äldre
 * utelämnar det helt (bytes × 40k+ event i aggregatet, samma utelämna-regel
 * som pop/endDate/emoji).
 *
 * Källan är link_events.createdAt: upserten i sqliteHelper sätter den vid
 * första insert och rör den ALDRIG vid ON CONFLICT, så kolumnen är radens
 * "först sedd i spegeln" — inte senaste omskrapningen.
 */
export const FIRST_SEEN_EXPORT_DAYS = 14;

const DAY_MS = 86_400_000;

/**
 * YYYY-MM-DD (UTC-dag) när createdAt ligger inom exportfönstret, annars
 * undefined. Tål saknad kolumn (legacy-rader), oparsbara strängar och
 * framtida stämplar (klockskev tolereras upp till ett dygn — längre fram i
 * tiden är trasig data och ska inte exporteras som "nyhet").
 */
export function firstSeenExport(createdAt: unknown, nowMs: number): string | undefined {
    if (typeof createdAt !== 'string' || !createdAt) return undefined;
    const t = Date.parse(createdAt);
    if (!Number.isFinite(t)) return undefined;
    if (t > nowMs + DAY_MS) return undefined;
    if (nowMs - t > FIRST_SEEN_EXPORT_DAYS * DAY_MS) return undefined;
    return new Date(t).toISOString().slice(0, 10);
}
