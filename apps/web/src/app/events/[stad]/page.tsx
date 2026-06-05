/**
 * /events/[stad] — server-renderad lista över veckans events i en stad.
 *
 * SEO-magnet för "vad händer i [stad] denna helg" och liknande sökord.
 * Pre-rendered HTML med strukturerad data (JSON-LD Schema.org/Event-lista)
 * för Google + sociala medier-OG.
 */

import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getAdminDb } from '@/lib/firestore-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { CITIES, getCity, eventMatchesCity, type City } from '@/lib/cityUtils';

const CACHE_REVALIDATE_SECONDS = 600; // 10 min — events ändras ofta

export const revalidate = CACHE_REVALIDATE_SECONDS;

interface PageProps {
    params: Promise<{ stad: string }>;
}

// Generate static params för de största städerna vid build
export async function generateStaticParams() {
    return CITIES.map(c => ({ stad: c.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { stad } = await params;
    const city = getCity(stad);
    if (!city) return { title: 'Stad ej funnen — VADKUL' };

    const title = `Events i ${city.name} denna vecka — VADKUL`;
    const description = `Veckans evenemang, konserter, marknader och aktiviteter i ${city.name}. Hitta vad som händer i ${city.name} de närmsta 7 dagarna.`;

    return {
        title,
        description,
        openGraph: {
            title,
            description,
            url: `https://vadkul.se/events/${city.slug}`,
            locale: 'sv_SE',
            type: 'website',
        },
        twitter: { card: 'summary_large_image', title, description },
        alternates: { canonical: `https://vadkul.se/events/${city.slug}` },
    };
}

interface EventLite {
    id: string;
    title: string;
    time: Date;
    locationName: string;
    extractedAddress: string;
    lat: number;
    lng: number;
    coverImage: string;
    description: string;
    category: string;
    url: string;
    hostName: string;
}

async function loadCityEvents(city: City): Promise<EventLite[]> {
    const db = getAdminDb();
    if (!db) return [];
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const weekEnd = new Date(now.getTime() + 7 * 24 * 3600 * 1000);

    const snap = await db.collection('linkEvents')
        .where('time', '>=', Timestamp.fromDate(now))
        .where('time', '<', Timestamp.fromDate(weekEnd))
        .orderBy('time', 'asc')
        .limit(500)
        .get();

    return snap.docs
        .map(d => {
            const x = d.data();
            return {
                id: d.id,
                title: x.title || '',
                time: x.time?.toDate?.() || new Date(x.time),
                locationName: x.locationName || '',
                extractedAddress: x.extractedAddress || '',
                lat: Number(x.lat) || 0,
                lng: Number(x.lng) || 0,
                coverImage: x.coverImage || '',
                description: x.description || '',
                category: x.category || 'other',
                url: x.url || '',
                hostName: x.hostName || '',
                hidden: !!x.hidden,
            };
        })
        .filter(e => !e.hidden && eventMatchesCity(e, city, 25));
}

function formatDateSv(d: Date): string {
    return d.toLocaleString('sv-SE', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function dayLabel(d: Date): string {
    const today = new Date(); today.setHours(0,0,0,0);
    const dayDiff = Math.floor((d.getTime() - today.getTime()) / (24 * 3600 * 1000));
    if (dayDiff === 0) return 'Idag';
    if (dayDiff === 1) return 'Imorgon';
    return d.toLocaleString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' });
}

function groupByDay(events: EventLite[]): { day: string; date: Date; events: EventLite[] }[] {
    const map = new Map<string, { day: string; date: Date; events: EventLite[] }>();
    for (const e of events) {
        const key = e.time.toISOString().slice(0, 10);
        if (!map.has(key)) {
            const date = new Date(key);
            map.set(key, { day: dayLabel(e.time), date, events: [] });
        }
        map.get(key)!.events.push(e);
    }
    return [...map.values()];
}

export default async function CityEventsPage({ params }: PageProps) {
    const { stad } = await params;
    const city = getCity(stad);
    if (!city) notFound();

    const events = await loadCityEvents(city);
    const grouped = groupByDay(events);

    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: `Events i ${city.name} denna vecka`,
        numberOfItems: events.length,
        itemListElement: events.slice(0, 50).map((e, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            item: {
                '@type': 'Event',
                name: e.title,
                startDate: e.time.toISOString(),
                url: e.url || `https://vadkul.se/events/${city.slug}#${e.id}`,
                location: { '@type': 'Place', name: e.locationName, address: e.extractedAddress },
                ...(e.coverImage && { image: e.coverImage }),
                ...(e.description && { description: e.description.slice(0, 300) }),
            },
        })),
    };

    return (
        <main style={{ maxWidth: 900, margin: '0 auto', padding: '1.5rem 1rem', fontFamily: 'system-ui, -apple-system, sans-serif', color: '#222' }}>
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

            <nav style={{ fontSize: '0.9rem', color: '#666', marginBottom: '0.5rem' }}>
                <Link href="/">Start</Link> {' › '} <Link href="/events">Alla städer</Link> {' › '} {city.name}
            </nav>

            <h1 style={{ fontSize: '2rem', margin: '0.5rem 0 0.25rem' }}>Events i {city.name}</h1>
            <p style={{ color: '#666', margin: '0 0 1.5rem' }}>
                {events.length} evenemang de närmsta 7 dagarna. Uppdateras flera gånger om dygnet.
            </p>

            {events.length === 0 ? (
                <div style={{ background: '#f6f7fb', padding: '2rem', borderRadius: 8, textAlign: 'center' }}>
                    <p style={{ margin: 0 }}>Inga events hittade för {city.name} denna vecka.</p>
                    <p style={{ marginTop: '0.5rem', color: '#666', fontSize: '0.9rem' }}>
                        Vi lägger till nya händelser dagligen — kika tillbaka snart.
                    </p>
                    <Link href="/" style={{ display: 'inline-block', marginTop: '1rem', padding: '0.5rem 1rem', background: '#222', color: 'white', borderRadius: 4, textDecoration: 'none' }}>
                        Utforska kartan
                    </Link>
                </div>
            ) : (
                <>
                    {grouped.map(g => (
                        <section key={g.date.toISOString()} style={{ marginBottom: '2rem' }}>
                            <h2 style={{ fontSize: '1.25rem', borderBottom: '1px solid #eee', paddingBottom: '0.4rem', textTransform: 'capitalize' }}>
                                {g.day}
                            </h2>
                            <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: '0.75rem' }}>
                                {g.events.map(e => (
                                    <li key={e.id} id={e.id} style={{ display: 'flex', gap: '1rem', padding: '0.75rem', border: '1px solid #eee', borderRadius: 8, background: 'white' }}>
                                        {e.coverImage ? (
                                            <img src={e.coverImage} alt="" loading="lazy"
                                                 style={{ width: 90, height: 90, objectFit: 'cover', borderRadius: 4, flexShrink: 0, background: '#f0f0f0' }} />
                                        ) : (
                                            <div style={{ width: 90, height: 90, background: '#f0f0f0', borderRadius: 4, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', color: '#999' }}>Ingen bild</div>
                                        )}
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <h3 style={{ margin: '0 0 0.25rem', fontSize: '1rem' }}>{e.title}</h3>
                                            <div style={{ fontSize: '0.85rem', color: '#666' }}>
                                                🕐 {formatDateSv(e.time)}
                                            </div>
                                            <div style={{ fontSize: '0.85rem', color: '#666' }}>
                                                📍 {e.locationName || '(plats ej angiven)'}
                                            </div>
                                            {e.description && (
                                                <p style={{ fontSize: '0.85rem', color: '#555', margin: '0.4rem 0 0', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                                    {e.description.slice(0, 200)}
                                                </p>
                                            )}
                                            {e.url && (
                                                <a href={e.url} target="_blank" rel="noopener noreferrer"
                                                   style={{ fontSize: '0.85rem', color: '#2563eb', marginTop: '0.3rem', display: 'inline-block' }}>
                                                    Mer info ↗
                                                </a>
                                            )}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    ))}
                </>
            )}

            <footer style={{ marginTop: '3rem', paddingTop: '1rem', borderTop: '1px solid #eee', color: '#999', fontSize: '0.85rem' }}>
                <p>
                    Letar du efter events i en annan stad? <Link href="/events">Se alla städer →</Link>
                </p>
                <p>
                    Vill du ha karta och svep-vy? <Link href="/">Öppna VADKUL ↗</Link>
                </p>
            </footer>
        </main>
    );
}
