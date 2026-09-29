// Arrangörssidorna (/arrangor/<slug>, 29/9): en sida per arrangör med alla
// deras kommande event. Klientsäker (ingen fs) - eventkortet på kartan,
// stadssidornas rader och själva sidan avgör med SAMMA regel om ett event
// har en arrangörssida, så en länk aldrig pekar på en sida som inte finns.
// Regeln (organizerPageSlug) bor i @vadkul/kontrakt, delad med pipelinen.
import { organizerPageSlug, organizerSlug } from '@vadkul/kontrakt';
export { organizerPageSlug };

/** Från så här många kommande event är sidan värd att bjuda ut till Google
 *  (index + sitemap). Färre = sidan finns (länkarna ska inte 404:a) men får
 *  noindex. 20 (Josef 29/9): Google indexerade redan bara ~hälften av sajten
 *  (317 av 593), så vi börjar med de ~260 arrangörerna med mest innehåll i
 *  stället för ~800 vid gränsen 5. Sänk när Search Console visar att de
 *  indexeras. */
export const ORGANIZER_PAGE_INDEX_MIN = 20;

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

// Namn -> slug, cachat per hostName. Kartans arrangörsfilter prövar ~50k
// event vid varje ny databatch; utan cachen normaliseras varje namn om och
// om igen (tusentals unika namn, så minnet är ingen fråga).
const slugByName = new Map<string, string>();

/**
 * Hör eventet till arrangörssidan `slug`? Kartans arrangörsfilter (29/9).
 * Snabb väg: namnets slug (cachad) jämförs först; hela regeln
 * (organizerPageSlug - plattformar, opt-in-källor, URL-id) körs bara vid
 * träff, så svaret blir alltid detsamma som sidans eget urval.
 */
export function isFromOrganizer(hostName: string | null | undefined, eventId: string | null | undefined, slug: string): boolean {
    if (!hostName) return false;
    let s = slugByName.get(hostName);
    if (s === undefined) {
        s = organizerSlug(hostName.replace(/\s+/g, ' ').trim());
        slugByName.set(hostName, s);
    }
    if (s !== slug) return false;
    return organizerPageSlug(hostName, eventId) === slug;
}

/** Läsbart namn ur en slug ("visit-linkoping" -> "Visit linkoping") - bara
 *  reserv på kartans filterbricka tills arrangörens riktiga namn laddats. */
export function organizerNameFromSlug(slug: string): string {
    const t = slug.replace(/-+/g, ' ').trim();
    return t.charAt(0).toUpperCase() + t.slice(1);
}
