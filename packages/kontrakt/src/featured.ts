/**
 * BOOSTADE ("featured") EVENT - den rena regeln som webben och appen delar
 * (Josef 4/11 2026, andra betalande kunden: boostade event ska synas med
 * stjärna och högst upp i listan under eventkortet, på webb OCH mobil).
 *
 *  - isFeaturedAt: är boosten aktiv just nu? `featuredUntil` kommer som Date
 *    (webbens LinkEvent), ISO-sträng (appens event) eller ms-tal (appens
 *    eventBoosts-overlay) - alla räknas lika. Saknas/ogiltig = inte boostad,
 *    och en passerad boost slutar gälla av sig själv (ingen städning).
 *  - featuredFirst: STABIL lyftning - de boostade först i sin inbördes
 *    ordning, resten orörda efter. Används inom en dag i listan (eventen är
 *    redan i tids-/närhetsordning) så boosten hamnar överst i sin dag.
 *
 * Själva utseendet (guldbricka + ⭐) bor i klienterna; kartans varianter
 * (isEventFeatured/isBoostShownEveryDay i webbens linkEventService) ändras
 * inte av det här - de kan byta till isFeaturedAt när det passar.
 */

export type FeaturedUntil = Date | string | number | null | undefined;

/** Ms-tidpunkten för ett featuredUntil-värde, eller null när det inte går att tolka. */
export function featuredUntilMs(until: FeaturedUntil): number | null {
    if (until == null) return null;
    const ms = until instanceof Date ? until.getTime() : typeof until === 'number' ? until : Date.parse(until);
    return Number.isFinite(ms) ? ms : null;
}

/** Aktiv boost vid `nowMs`? */
export function isFeaturedAt(until: FeaturedUntil, nowMs: number): boolean {
    const ms = featuredUntilMs(until);
    return ms !== null && ms > nowMs;
}

/** Boostade först (stabilt), resten efter i oförändrad ordning. */
export function featuredFirst<T>(items: readonly T[], isFeatured: (item: T) => boolean): T[] {
    const lifted: T[] = [];
    const rest: T[] = [];
    for (const it of items) (isFeatured(it) ? lifted : rest).push(it);
    return lifted.length === 0 ? [...items] : [...lifted, ...rest];
}
