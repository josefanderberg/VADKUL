import Link from 'next/link';
import { dayKey, dayLabel, clockLabel, type CityEvent } from './cityData';

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

/** Dag-grupperad lista över kommande event, med "se kartan"-rader för resten. */
export function EventDayList({ events, cityName }: { events: CityEvent[]; cityName: string }) {
    const byDay = new Map<string, CityEvent[]>();
    for (const e of events) {
        const k = dayKey(e.time);
        const list = byDay.get(k);
        if (list) list.push(e); else byDay.set(k, [e]);
    }
    const days = [...byDay.entries()].slice(0, DAYS_LISTED);
    let listed = 0;
    const shownDays = days
        .map(([k, list]) => {
            const room = Math.max(0, MAX_LISTED - listed);
            const shown = list.slice(0, room);
            listed += shown.length;
            return { key: k, label: dayLabel(list[0].time), events: shown, more: list.length - shown.length };
        })
        .filter(d => d.events.length > 0);
    const restCount = events.length - listed;

    return (
        <>
            <div className="mt-9 flex flex-col gap-8">
                {shownDays.map(day => (
                    <section key={day.key}>
                        <h2 className="text-base font-black text-slate-900 mb-2 capitalize">{day.label}</h2>
                        <ul className="flex flex-col gap-1.5">
                            {day.events.map(e => (
                                <li key={e.id}>
                                    <Link
                                        href={mapHref(e.id)}
                                        className="flex items-start gap-3 rounded-xl bg-white border border-slate-200 px-4 py-3 hover:border-[#006AA7]/40 hover:shadow-sm transition-all"
                                    >
                                        <span className="text-xl leading-none mt-0.5" aria-hidden>{e.emoji}</span>
                                        <span className="min-w-0">
                                            <span className="block text-sm font-bold text-slate-900 leading-snug">{e.title}</span>
                                            <span className="block text-xs text-slate-500 font-medium mt-0.5">
                                                {e.hasSpecificTime ? `kl ${clockLabel(e.time)} · ` : ''}
                                                {e.locationName || cityName}
                                                {e.hostName && e.hostName !== e.locationName ? ` · ${e.hostName}` : ''}
                                            </span>
                                        </span>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                        {day.more > 0 && (
                            <p className="mt-2 text-xs font-bold text-slate-400">
                                + {day.more} till denna dag — <Link href="/" className="text-[#006AA7]">se dem på kartan</Link>
                            </p>
                        )}
                    </section>
                ))}
            </div>

            {restCount > 0 && (
                <p className="mt-8 text-sm font-bold text-slate-500">
                    …och {restCount} evenemang längre fram.{' '}
                    <Link href="/" className="text-[#006AA7]">Utforska hela utbudet på kartan</Link>
                </p>
            )}
        </>
    );
}
