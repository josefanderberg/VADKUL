import type { ReactNode } from 'react';
import { dayKey, dayLabel, shortDayLabel, clockLabel, hourOf, type CityEvent } from './cityData';
import DayFilteredList, { type ListedDay, type ListedRec } from './DayFilteredList';
import { normalizePriceLabel } from '@/utils/priceLabel';

// Delade byggstenar för stads- och kategorisidorna: dag-grupperad eventlista
// + schema.org-markup. Sidorna ska se ut och bete sig identiskt — bara
// urvalet av event skiljer.

// Hur många dagar som listas dag-för-dag, och max antal listade event totalt.
// Resten sammanfattas med en "se kartan"-rad — sidan ska vara snabb och läsbar,
// kartan är alltid den fulla vyn.
const DAYS_LISTED = 14;
const MAX_LISTED = 150;

export const mapHref = (id: string) => `/?event=${encodeURIComponent(id)}`;

/** schema.org ItemList med Event-poster för de ~25 närmaste eventen. */
export function buildEventsJsonLd(listName: string, events: CityEvent[], cityName: string, pageUrl: string) {
    return {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: listName,
        url: `https://vadkul.se${pageUrl}`,
        numberOfItems: events.length,
        itemListElement: events.slice(0, 25).map((e, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            item: {
                '@type': 'Event',
                name: e.title,
                startDate: e.time,
                eventStatus: 'https://schema.org/EventScheduled',
                eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
                location: {
                    '@type': 'Place',
                    name: e.locationName || cityName,
                    address: { '@type': 'PostalAddress', addressLocality: cityName, addressCountry: 'SE' },
                },
                ...(e.coverImage ? { image: e.coverImage } : {}),
                ...(e.hostName ? { organizer: { '@type': 'Organization', name: e.hostName } } : {}),
                url: `https://vadkul.se${mapHref(e.id)}`,
            },
        })),
    };
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Förbygg Rekommenderat-korten till rena strängar för klientkomponenten
 *  (cityData är server-only). Tidssorteras närmast-först — defaulten ska
 *  visa idag/det nästkommande. Färre än 3 kandidater = ingen sektion alls
 *  (hellre ingen lista än en utfylld). Själva karusellen renderas i
 *  DayFilteredList så att filterraden överst styr även den. */
function buildRecRows(recommended: CityEvent[], cityName: string): ListedRec[] {
    if (recommended.length < 3) return [];
    return [...recommended]
        .sort((a, b) => Date.parse(a.time) - Date.parse(b.time))
        .map(e => ({
            id: e.id,
            href: mapHref(e.id),
            title: e.title,
            coverImage: e.coverImage,
            emoji: e.emoji || '📍',
            when: cap(dayLabel(e.time)) + (e.hasSpecificTime ? ` · kl ${clockLabel(e.time)}` : ''),
            place: e.locationName || cityName,
            dayKey: dayKey(e.time),
            hour: e.hasSpecificTime ? hourOf(e.time) : null,
            t: Date.parse(e.time),
        }));
}

/** Sprid dagens urval över starttimmarna (round-robin per timme) i stället
 *  för "första N" — annars representeras bara morgonen i stora städer och
 *  timfiltrets staplar pekar på rader som inte finns i listan. Visningen
 *  tidssorteras efteråt; event utan klockslag är en egen hink (-1). */
function pickSpread(list: CityEvent[], n: number): CityEvent[] {
    if (list.length <= n) return list;
    const buckets = new Map<number, CityEvent[]>();
    for (const e of list) {
        const h = e.hasSpecificTime ? hourOf(e.time) : -1;
        const b = buckets.get(h);
        if (b) b.push(e); else buckets.set(h, [e]);
    }
    const order = [...buckets.keys()].sort((a, b) => a - b);
    const picked: CityEvent[] = [];
    for (let round = 0; picked.length < n; round++) {
        let any = false;
        for (const h of order) {
            const b = buckets.get(h)!;
            if (round < b.length) {
                picked.push(b[round]);
                any = true;
                if (picked.length >= n) break;
            }
        }
        if (!any) break;
    }
    return picked.sort((a, b) => Date.parse(a.time) - Date.parse(b.time));
}

/** Hela eventsektionen: filterrad överst (Idag/Imorgon/I helgen + timstaplar),
 *  därefter Rekommenderat (om `recommended` skickas med), `children` (t.ex.
 *  kategorichips) och den dag-grupperade listan med "se kartan"-rader för
 *  resten. Servern trimmar urvalet och förbygger raderna till rena strängar
 *  här — cityData (fs) kan inte importeras från klientkomponenter. */
export function EventDayList({ events, cityName, recommended = [], children }: {
    events: CityEvent[];
    cityName: string;
    recommended?: CityEvent[];
    children?: ReactNode;
}) {
    const byDay = new Map<string, CityEvent[]>();
    for (const e of events) {
        const k = dayKey(e.time);
        const list = byDay.get(k);
        if (list) list.push(e); else byDay.set(k, [e]);
    }
    const days = [...byDay.entries()].slice(0, DAYS_LISTED);
    // Fördela MAX_LISTED rättvist över dagarna: basranson per dag först, sen
    // resterande platser i tidsordning. Utan detta äter dag 1–2 hela budgeten
    // i stora städer och Idag/Imorgon/I helgen-filtret får tomma senare dagar.
    const base = Math.max(1, Math.floor(MAX_LISTED / Math.max(1, days.length)));
    const takes = days.map(([, list]) => Math.min(list.length, base));
    let left = MAX_LISTED - takes.reduce((a, b) => a + b, 0);
    for (let i = 0; i < days.length && left > 0; i++) {
        const extra = Math.min(days[i][1].length - takes[i], left);
        takes[i] += extra;
        left -= extra;
    }
    let listed = 0;
    const shownDays: ListedDay[] = days
        .map(([k, list], i) => {
            // Bild först inom dagen: rader med omslagsbild överst, bildlösa
            // under — tidsordningen (från pickSpread) bevaras inbördes.
            const spread = pickSpread(list, takes[i]);
            const shown = [...spread.filter(e => !!e.coverImage), ...spread.filter(e => !e.coverImage)];
            listed += shown.length;
            // Sann timfördelning för HELA dagen (inte bara de listade raderna)
            // — klientens stapeldiagram ska visa dagens verkliga utbud.
            const hourCounts = Array(24).fill(0) as number[];
            for (const e of list) if (e.hasSpecificTime) hourCounts[hourOf(e.time)]++;
            return {
                key: k,
                label: dayLabel(list[0].time),
                short: shortDayLabel(list[0].time),
                more: list.length - shown.length,
                hourCounts,
                events: shown.map(e => ({
                    id: e.id,
                    href: mapHref(e.id),
                    emoji: e.emoji || '📍',
                    title: e.title,
                    meta: (e.hasSpecificTime ? `kl ${clockLabel(e.time)} · ` : '')
                        + (e.locationName || cityName)
                        + (e.hostName && e.hostName !== e.locationName ? ` · ${e.hostName}` : ''),
                    // Fält för bildkorts-raden (samma stil som eventkortets
                    // närhetslista): omslagsbild + inforad (plats · tid · pris · antal).
                    coverImage: e.coverImage,
                    place: e.locationName || cityName,
                    clock: e.hasSpecificTime ? clockLabel(e.time) : null,
                    price: normalizePriceLabel(e.price),
                    attendees: e.attendees ?? 0,
                    hour: e.hasSpecificTime ? hourOf(e.time) : null,
                    t: Date.parse(e.time),
                })),
            };
        })
        .filter(d => d.events.length > 0);
    const restCount = events.length - listed;

    return (
        <DayFilteredList days={shownDays} recs={buildRecRows(recommended, cityName)} restCount={restCount} cityName={cityName}>
            {children}
        </DayFilteredList>
    );
}
