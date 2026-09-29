// Arrangörssidorna (/arrangor/<slug>, 29/9): en sida per arrangör med alla
// deras kommande event. Klientsäker (ingen fs) - eventkortet på kartan,
// stadssidornas rader och själva sidan avgör med SAMMA regel om ett event
// har en arrangörssida, så en länk aldrig pekar på en sida som inte finns.
// Regeln (organizerPageSlug) bor i @vadkul/kontrakt, delad med pipelinen.
export { organizerPageSlug } from '@vadkul/kontrakt';

/** Från så här många kommande event är sidan värd att bjuda ut till Google
 *  (index + sitemap). Färre = sidan finns (länkarna ska inte 404:a) men får
 *  noindex - en sida med två event är tunn. */
export const ORGANIZER_PAGE_INDEX_MIN = 5;

/** Stadssidans "Arrangörer i X"-chips: arrangörer med minst så här många
 *  kommande event i just den staden. */
export const ORGANIZER_CITY_CHIP_MIN = 3;

export const organizerHref = (slug: string) => `/arrangor/${slug}`;

export type OrganizerChip = { slug: string; name: string; count: number };

/**
 * De största arrangörerna bland en lista event: antal per slug, vanligaste
 * stavningen av namnet, minst `min` event, flest först (namn vid lika).
 * Stadssidans "Arrangörer i X" och arrangörssidans "Fler arrangörer i X".
 */
export function topOrganizers(
    events: { hostSlug?: string | null; hostName?: string | null }[],
    min: number,
    n: number,
): OrganizerChip[] {
    const acc = new Map<string, { count: number; names: Map<string, number> }>();
    for (const e of events) {
        if (!e.hostSlug || !e.hostName) continue;
        let a = acc.get(e.hostSlug);
        if (!a) { a = { count: 0, names: new Map() }; acc.set(e.hostSlug, a); }
        a.count++;
        const name = e.hostName.replace(/\s+/g, ' ').trim();
        a.names.set(name, (a.names.get(name) ?? 0) + 1);
    }
    return [...acc.entries()]
        .filter(([, a]) => a.count >= min)
        .map(([slug, a]) => ({
            slug,
            count: a.count,
            name: [...a.names.entries()].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0], 'sv'))[0][0],
        }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'sv'))
        .slice(0, n);
}
