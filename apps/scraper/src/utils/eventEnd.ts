/**
 * Giltighetsregel för eventets SLUTDATUM (endDate) — infört 26/8 efter
 * FB-kommentaren om Live at Heart ("håller ändå på ons–lör"): källorna
 * levererar ofta endDate men pipelinen slängde det före databasen.
 *
 * Reglerna skyddar mot källornas kända skräpvärden:
 *   • slut FÖRE eller SAMTIDIGT som start → ingen information (vanligt att
 *     API:er ekar startDate i endDate).
 *   • längre än MAX_EVENT_SPAN_MS (30 dygn) → det är en utställning/säsong/
 *     "alltid öppet"-sida (jfr museiproberna i registry: bogus startDate +
 *     årslånga spann), inte ett pågående event. Hellre inget slutdatum än
 *     ett som får kartan att påstå att något "pågår" i ett halvår.
 */
export const MAX_EVENT_SPAN_MS = 30 * 86_400_000;

/** Validerat slutdatum, eller null när värdet saknas/är orimligt. */
export function validEventEnd(start: Date | undefined, end: Date | undefined | null): Date | null {
    if (!end || !(end instanceof Date) || isNaN(end.getTime())) return null;
    if (!start || !(start instanceof Date) || isNaN(start.getTime())) return null;
    const diff = end.getTime() - start.getTime();
    if (diff <= 0) return null;
    if (diff > MAX_EVENT_SPAN_MS) return null;
    return end;
}
