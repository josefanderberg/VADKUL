import Link from 'next/link';
import type { Metadata } from 'next';
import { getShareEvent, shareTimeLabel } from './shareData';
import MapRedirect from './MapRedirect';

// Delnings-landningssida: /e/<slug> är URL:en dela-knappen sprider. Skrapare
// (FB/Messenger/iMessage) läser eventets EGEN titel/beskrivning/OG-bild här;
// människor studsas direkt vidare till kartan med eventet öppet (MapRedirect).
// Renderas på begäran (21k möjliga slugs) — noindex så de inte konkurrerar
// med stads-/kategorisidorna i Google.
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
    const { slug } = await params;
    const event = await getShareEvent(slug);
    if (!event) {
        return { title: 'Event – VADKUL', robots: { index: false } };
    }
    const description = `${shareTimeLabel(event)}${event.locationName ? ` · ${event.locationName}` : ''} — se eventet och allt annat som händer nära dig på VADKUL-kartan.`;
    return {
        title: event.title,
        description,
        robots: { index: false },
        alternates: { canonical: `/e/${slug}` },
        openGraph: {
            title: event.title,
            description,
            url: `/e/${slug}`,
            type: 'website',
        },
        twitter: { card: 'summary_large_image', title: event.title, description },
    };
}

export default async function EventSharePage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const event = await getShareEvent(slug);

    // Okänd/utgången slug (t.ex. gammalt event som skrapats bort): visa en
    // vänlig sida i stället för 404 — länken kan vara veckor gammal.
    if (!event) {
        return (
            <main className="min-h-screen bg-slate-50 text-slate-800 flex items-center justify-center px-5">
                <div className="text-center max-w-sm">
                    <div className="text-5xl" aria-hidden>☁️</div>
                    <h1 className="mt-4 text-xl font-black text-[#006AA7]">Eventet har flugit vidare</h1>
                    <p className="mt-2 text-sm text-slate-600 font-medium">
                        Länken pekar på ett event som inte längre finns kvar — men kartan är full av annat kul.
                    </p>
                    <Link
                        href="/"
                        className="mt-5 inline-flex items-center justify-center px-6 py-3 rounded-2xl bg-[#006AA7] hover:bg-[#005590] text-white font-black text-sm shadow-lg transition-colors"
                    >
                        Se vad som händer nära dig
                    </Link>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-slate-50 text-slate-800 flex items-center justify-center px-5">
            <MapRedirect eventId={event.id} />
            <div className="text-center max-w-sm">
                <div className="text-5xl" aria-hidden>{event.emoji}</div>
                <h1 className="mt-4 text-xl font-black text-slate-900">{event.title}</h1>
                <p className="mt-2 text-sm text-slate-600 font-medium">{shareTimeLabel(event)}</p>
                {event.locationName && <p className="text-sm text-slate-500 font-medium">{event.locationName}</p>}
                <Link
                    href={`/?event=${encodeURIComponent(event.id)}`}
                    className="mt-5 inline-flex items-center justify-center px-6 py-3 rounded-2xl bg-[#006AA7] hover:bg-[#005590] text-white font-black text-sm shadow-lg transition-colors"
                >
                    Öppna på kartan
                </Link>
            </div>
        </main>
    );
}
