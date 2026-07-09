import Link from 'next/link';
import { dayKey, dayLabel, shortDayLabel, clockLabel, hourOf, type CityEvent } from './cityData';
import DayFilteredList, { type ListedDay } from './DayFilteredList';

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

/** Rekommenderade event — handplockade av rankingen i cityData (unika,
 *  påkostade händelser i stället för rutinverksamhet). Bildkarusell (ren
 *  CSS-scroll med snap, ingen klient-JS): titel + tid överst PÅ bilden,
 *  platsen längst ner. Gul kant = samma accent som dagväljaren på kartan.
 *  Döljer sig själv när staden inte har nog många starka kandidater. */
export function RecommendedList({ events, cityName }: { events: CityEvent[]; cityName: string }) {
    if (events.length < 3) return null;
    return (
        <section className="mt-8">
            <h2 className="text-base font-black text-slate-900 flex items-center gap-1.5">
                <span aria-hidden>⭐</span> Rekommenderat i {cityName}
            </h2>
            <p className="mt-1 text-xs font-medium text-slate-500">
                Utvalda händelser du inte vill missa — unika event, inte det som återkommer varje vecka.
            </p>
            <ul className="mt-3 flex gap-3 overflow-x-auto no-scrollbar snap-x snap-mandatory -mx-4 px-4 pb-1">
                {events.map(e => (
                    <li key={e.id} className="shrink-0 snap-start">
                        <Link
                            href={mapHref(e.id)}
                            className="relative block w-56 h-48 rounded-2xl overflow-hidden border-2 border-[#FECC02]/70 hover:border-[#FECC02] transition-colors"
                        >
                            {/* Bakgrund: omslagsbild, annars emoji på mörk platta
                                (texten är vit — behöver mörk botten). */}
                            {e.coverImage ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                    src={e.coverImage}
                                    alt=""
                                    loading="lazy"
                                    referrerPolicy="no-referrer"
                                    className="absolute inset-0 w-full h-full object-cover bg-slate-200"
                                />
                            ) : (
                                <span className="absolute inset-0 bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center text-5xl" aria-hidden>
                                    {e.emoji || '📍'}
                                </span>
                            )}
                            {/* Läsbarhets-scrim upptill + nedtill. */}
                            <span aria-hidden className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-black/70 via-black/30 to-transparent" />
                            <span aria-hidden className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/70 to-transparent" />
                            {/* Titel + tid på bilden. */}
                            <span className="absolute inset-x-0 top-0 p-3">
                                <span className="block text-sm font-black text-white leading-snug line-clamp-2 [text-shadow:0_1px_3px_rgba(0,0,0,0.5)]">
                                    {e.title}
                                </span>
                                <span className="block mt-1 text-[11px] font-bold text-white/90 [text-shadow:0_1px_2px_rgba(0,0,0,0.5)]">
                                    {cap(dayLabel(e.time))}{e.hasSpecificTime ? ` · kl ${clockLabel(e.time)}` : ''}
                                </span>
                            </span>
                            {/* Platsen längst ner. */}
                            <span className="absolute inset-x-0 bottom-0 p-3 flex items-center gap-1 text-[11px] font-bold text-white/90">
                                <span aria-hidden>📍</span>
                                <span className="truncate">{e.locationName || cityName}</span>
                            </span>
                        </Link>
                    </li>
                ))}
            </ul>
        </section>
    );
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

/** Dag-grupperad lista över kommande event, med "se kartan"-rader för resten
 *  och Idag/Imorgon/I helgen-chips (klientfiltret i DayFilteredList). Servern
 *  trimmar urvalet och förbygger raderna till rena strängar här — cityData
 *  (fs) kan inte importeras från klientkomponenter. */
export function EventDayList({ events, cityName }: { events: CityEvent[]; cityName: string }) {
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
            const shown = pickSpread(list, takes[i]);
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
                    hour: e.hasSpecificTime ? hourOf(e.time) : null,
                    t: Date.parse(e.time),
                })),
            };
        })
        .filter(d => d.events.length > 0);
    const restCount = events.length - listed;

    return <DayFilteredList days={shownDays} restCount={restCount} cityName={cityName} />;
}
