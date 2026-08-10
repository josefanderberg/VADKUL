import type { ReactNode } from 'react';
import { dayKey, dayLabel, shortDayLabel, clockLabel, hourOf, type CityEvent } from './cityData';
import DayFilteredList, { type ListedDay } from './DayFilteredList';
import { normalizePriceLabel } from '@/utils/priceLabel';

// Delade byggstenar för stads- och kategorisidorna: dag-grupperad eventlista
// + schema.org-markup. Sidorna ska se ut och bete sig identiskt — bara
// urvalet av event skiljer.

// Hur många dagar som listas dag-för-dag. Varje listad dag tar med ALLA sina
// event — klienten avtäcker dagarna en i taget vid scroll (DayFilteredList),
// så allt renderas ändå inte på en gång. Event bortom horisonten sammanfattas
// med "…längre fram"-raden; kartan är alltid den fulla vyn.
const DAYS_LISTED = 14;

export const mapHref = (id: string) => `/?event=${encodeURIComponent(id)}`;

const SITE = 'https://vadkul.se';

// Generisk fallback (sajtens OG-kort) för event utan egen bild — Google
// flaggar Event-poster som helt saknar image.
const FALLBACK_EVENT_IMAGE = `${SITE}/opengraph-image`;

/** Prisetikett ("Gratis", "160 kr", "20–50 kr") → schema.org-Offer.
 *  Intervall ger lägsta priset; oigenkännligt format ger inget offer alls
 *  (hellre inget än fel siffra). */
function offerFromPrice(price: string | undefined, url: string) {
    const label = normalizePriceLabel(price);
    if (!label) return null;
    const free = label === 'Gratis';
    const m = label.match(/\d+(?:[.,]\d+)?/);
    if (!free && !m) return null;
    return {
        '@type': 'Offer',
        price: free ? 0 : Number(m![0].replace(',', '.')),
        priceCurrency: 'SEK',
        url,
        availability: 'https://schema.org/InStock',
    };
}

/** Källsajtens origin — event-id:t för scrapade event ÄR källans URL, så
 *  arrangörens webbplats är id:ts origin. null för ett icke-URL-id. */
function organizerUrl(id: string): string | null {
    try { return new URL(id).origin; } catch { return null; }
}

/** schema.org ItemList med Event-poster för de ~25 närmaste eventen.
 *  Fälten utöver minimum (endDate/description/image/offers/organizer.url/
 *  performer) fylls i så långt datat räcker — Search Console flaggar annars
 *  varje post som "kan förbättras". endDate finns inte i källdatat: tidsatta
 *  event antas pågå 2 h, heldagsevent (utan klockslag) dygnet ut. performer
 *  sätts till värden (PerformingGroup) — närmare än så kommer vi inte utan
 *  artistdata. */
export function buildEventsJsonLd(listName: string, events: CityEvent[], cityName: string, pageUrl: string) {
    return {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: listName,
        url: `${SITE}${pageUrl}`,
        numberOfItems: events.length,
        itemListElement: events.slice(0, 25).map((e, i) => {
            const eventUrl = `${SITE}${mapHref(e.id)}`;
            const startMs = Date.parse(e.time);
            const endDate = new Date(startMs + (e.hasSpecificTime ? 2 * 3_600_000 : 24 * 3_600_000 - 1000)).toISOString();
            const offer = offerFromPrice(e.price, eventUrl);
            const orgUrl = organizerUrl(e.id);
            return {
                '@type': 'ListItem',
                position: i + 1,
                item: {
                    '@type': 'Event',
                    name: e.title,
                    startDate: e.time,
                    endDate,
                    eventStatus: 'https://schema.org/EventScheduled',
                    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
                    location: {
                        '@type': 'Place',
                        name: e.locationName || cityName,
                        address: { '@type': 'PostalAddress', addressLocality: cityName, addressCountry: 'SE' },
                    },
                    image: e.coverImage || FALLBACK_EVENT_IMAGE,
                    ...(e.description ? { description: e.description } : {}),
                    ...(e.hostName
                        ? {
                            organizer: { '@type': 'Organization', name: e.hostName, ...(orgUrl ? { url: orgUrl } : {}) },
                            performer: { '@type': 'PerformingGroup', name: e.hostName },
                        }
                        : {}),
                    ...(offer ? { offers: offer } : {}),
                    url: eventUrl,
                },
            };
        }),
    };
}

/** schema.org BreadcrumbList (Hem → Evenemang → Stad → ev. kategori) — ger
 *  Google sökvägen och snyggare brödsmulor i träfflistan. */
export function buildBreadcrumbJsonLd(crumbs: { name: string; path: string }[]) {
    return {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: crumbs.map((c, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            name: c.name,
            item: `${SITE}${c.path}`,
        })),
    };
}

export type Faq = { q: string; a: string };

export function buildFaqJsonLd(faqs: Faq[]) {
    return {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faqs.map(f => ({
            '@type': 'Question',
            name: f.q,
            acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
    };
}

/** Synlig FAQ ("Vad händer i X idag?" …) — svaren bakas ur eventdatat i
 *  sidorna, så texten är unik per sida och färsk per deploy. FAQPage-schemat
 *  kräver att frågorna faktiskt SYNS på sidan — den här sektionen är den
 *  synliga halvan, buildFaqJsonLd den maskinläsbara. */
export function FaqSection({ faqs }: { faqs: Faq[] }) {
    if (!faqs.length) return null;
    return (
        <section className="mt-10 pt-6 border-t border-slate-200">
            <h2 className="text-sm font-black text-slate-900 mb-3">Vanliga frågor</h2>
            <dl className="space-y-4">
                {faqs.map(f => (
                    <div key={f.q}>
                        <dt className="text-sm font-black text-slate-800">{f.q}</dt>
                        <dd className="mt-1 text-sm leading-relaxed text-slate-600 font-medium">{f.a}</dd>
                    </div>
                ))}
            </dl>
        </section>
    );
}

/** Hela eventsektionen: filterrad överst (Idag/Imorgon/I helgen + timstaplar),
 *  därefter `children` (t.ex. kategorichips) och den dag-grupperade listan.
 *  Servern förbygger raderna till rena strängar här — cityData (fs) kan inte
 *  importeras från klientkomponenter.
 *  (Rekommenderat-karusellen låg här tidigare — borttagen 9/8 på ägarbeslut:
 *  urvalet höll inte måttet. Lägg inte tillbaka den utan ett bättre urval.) */
export function EventDayList({ events, cityName, children }: {
    events: CityEvent[];
    cityName: string;
    children?: ReactNode;
}) {
    const byDay = new Map<string, CityEvent[]>();
    for (const e of events) {
        const k = dayKey(e.time);
        const list = byDay.get(k);
        if (list) list.push(e); else byDay.set(k, [e]);
    }
    const days = [...byDay.entries()].slice(0, DAYS_LISTED);
    let listed = 0;
    const shownDays: ListedDay[] = days
        .map(([k, list]) => {
            // ALLA dagens event listas (ingen budget) — bild först inom dagen:
            // rader med omslagsbild överst, bildlösa under; tidsordningen
            // (listan kommer tidssorterad) bevaras inbördes.
            const shown = [...list.filter(e => !!e.coverImage), ...list.filter(e => !e.coverImage)];
            listed += shown.length;
            // Timfördelning för dagen — klientens stapeldiagram.
            const hourCounts = Array(24).fill(0) as number[];
            for (const e of list) if (e.hasSpecificTime) hourCounts[hourOf(e.time)]++;
            return {
                key: k,
                label: dayLabel(list[0].time),
                short: shortDayLabel(list[0].time),
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
        <DayFilteredList days={shownDays} restCount={restCount} cityName={cityName}>
            {children}
        </DayFilteredList>
    );
}
