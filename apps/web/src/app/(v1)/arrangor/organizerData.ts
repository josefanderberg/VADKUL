import { getIndexedEvents, type ShareEvent } from '../e/[slug]/shareData';
import {
    CITIES, CITY_RADIUS_KM, SMALL_TOWN_RADIUS_KM, dayKey, distKm, type City, type CityEvent,
} from '../evenemang/cityData';
import { emojiForCategory } from '@/utils/categories';
import { usableImageUrl } from '@/lib/deepLinkEventIndex';
import { isAffiliateUrl } from '@/utils/ticketmasterEvent';
import { organizerDomain } from '@vadkul/kontrakt';
import { ORGANIZER_CITY_CHIP_MIN, topOrganizers, type OrganizerChip } from '@/utils/organizerPages';

// Arrangörssidornas data (29/9). Sidorna renderas på begäran och cachas
// (se page.tsx) - 2 000+ sidor går inte att förrendera vid deploy (SSG kostar
// ~0,45 s/sida). Underlaget är /e/-sidornas index (shareData): samma två
// eventlager, inlästa EN gång per instans.

export type Organizer = {
    slug: string;
    name: string;
    /** Källsajterna (utan www), vanligaste först. */
    domains: string[];
    /** Kommande event, tidssorterade, i stadssidornas form. */
    events: CityEvent[];
    /** Städerna där eventen hör hemma (närmaste stadssida), vanligaste först. */
    cities: City[];
    /** Andra arrangörer med event i huvudstaden - interna länkar. */
    neighbours: OrganizerChip[];
};

type Grouped = { bySlug: Map<string, ShareEvent[]>; cityOf: Map<ShareEvent, City | null> };
let groupedPromise: Promise<Grouped> | null = null;

/** Närmaste stadssida inom dess radie - samma regel som stadssidornas
 *  tilldelning (cityData.assignNearestCity). */
function nearestCity(lat: number, lng: number): City | null {
    let best: City | null = null;
    let bestD = Infinity;
    for (const c of CITIES) {
        const d = distKm(c.lat, c.lng, lat, lng);
        const limit = c.small ? SMALL_TOWN_RADIUS_KM : CITY_RADIUS_KM;
        if (d <= limit && d < bestD) { best = c; bestD = d; }
    }
    return best;
}

function grouped(): Promise<Grouped> {
    if (!groupedPromise) {
        groupedPromise = getIndexedEvents().then(all => {
            const bySlug = new Map<string, ShareEvent[]>();
            const cityOf = new Map<ShareEvent, City | null>();
            for (const e of all) {
                // Samma urval som sitemapen (cityData.getOrganizerPageCounts):
                // bara event som syns på kartan, dvs. med koordinat.
                if (!e.hostSlug || !e.lat || !e.lng) continue;
                const list = bySlug.get(e.hostSlug);
                if (list) list.push(e); else bySlug.set(e.hostSlug, [e]);
                cityOf.set(e, nearestCity(e.lat, e.lng));
            }
            return { bySlug, cityOf };
        }).catch(err => {
            groupedPromise = null; // nästa anrop försöker igen
            throw err;
        });
    }
    return groupedPromise;
}

function toCityEvent(e: ShareEvent): CityEvent {
    const category = e.category || 'other';
    const href = e.url ?? e.id;
    return {
        id: e.id,
        title: e.title,
        time: e.time,
        hasSpecificTime: e.hasSpecificTime,
        lat: e.lat!,
        lng: e.lng!,
        locationName: e.locationName,
        category,
        emoji: emojiForCategory(category),
        hostName: e.hostName,
        hostSlug: e.hostSlug,
        coverImage: usableImageUrl(e.coverImage),
        price: e.price,
        attendees: e.attendees,
        repeatCount: 1,
        pop: e.pop,
        bookUrl: isAffiliateUrl(href) ? href : undefined,
        likes: e.likes,
    };
}

const byCount = <T,>(xs: T[]): T[] => {
    const m = new Map<T, number>();
    for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([x]) => x);
};

const isUpcoming = (todayK: string) => (e: ShareEvent) => dayKey(e.time) >= todayK;

export async function getOrganizer(slug: string): Promise<Organizer | null> {
    const { bySlug, cityOf } = await grouped();
    const todayK = dayKey(new Date().toISOString());
    const upcoming = (bySlug.get(slug) ?? [])
        .filter(isUpcoming(todayK))
        .sort((a, b) => Date.parse(a.time) - Date.parse(b.time));
    if (!upcoming.length) return null;

    const name = byCount(upcoming.map(e => e.hostName!.replace(/\s+/g, ' ').trim()))[0];
    const domains = byCount(upcoming.map(e => organizerDomain(e.id)).filter((d): d is string => !!d));
    const cities = byCount(upcoming.map(e => cityOf.get(e)).filter((c): c is City => !!c)).slice(0, 3);

    // "Fler arrangörer i <huvudstaden>": alla kommande event som hör till
    // staden, räknade per arrangör. Loopen går över ~50k event men sidan
    // cachas, så den körs sällan.
    let neighbours: OrganizerChip[] = [];
    const home = cities[0];
    if (home) {
        const inCity: { hostSlug?: string; hostName?: string }[] = [];
        const upcomingOk = isUpcoming(todayK);
        for (const [s, list] of bySlug) {
            if (s === slug) continue;
            for (const e of list) if (cityOf.get(e) === home && upcomingOk(e)) inCity.push(e);
        }
        neighbours = topOrganizers(inCity, ORGANIZER_CITY_CHIP_MIN, 12);
    }

    return { slug, name, domains, events: upcoming.map(toCityEvent), cities, neighbours };
}

/** Kommande event med koordinat i hela landet - toppnavens "Se alla N event".
 *  Räknas ur samma index (cityData.getNationalUpcomingCount parsar alla tre
 *  lagren, för tungt i drift). */
export async function getNationalUpcomingCountRuntime(): Promise<number> {
    const all = await getIndexedEvents();
    const todayK = dayKey(new Date().toISOString());
    let n = 0;
    for (const e of all) if (e.lat && e.lng && dayKey(e.time) >= todayK) n++;
    return n;
}
