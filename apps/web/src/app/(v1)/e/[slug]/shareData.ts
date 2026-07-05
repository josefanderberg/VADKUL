import { readFile } from 'fs/promises';
import path from 'path';
import { eventShareSlug } from '@/utils/eventShareSlug';

// Uppslag slug → event för delningssidorna (/e/[slug]). Läser samma
// events-JSON som stadssidorna, men vid RUNTIME (delningssidor renderas på
// begäran — 21k möjliga slugs går inte att förrendera). Funktionspaketet
// innehåller public/-mappen, så fs-läsning fungerar i drift.
// OBS: user-skapade event (Firestore linkEvents) finns INTE i aggregaten —
// deras dela-knapp använder gamla /?event=-länken i stället.

export type ShareEvent = {
    id: string;
    title: string;
    time: string;
    hasSpecificTime: boolean;
    locationName: string;
    emoji: string;
    hostName?: string;
    coverImage?: string;
};

let indexPromise: Promise<Map<string, ShareEvent>> | null = null;

function loadIndex(): Promise<Map<string, ShareEvent>> {
    if (!indexPromise) {
        indexPromise = (async () => {
            const pub = (f: string) => readFile(path.join(process.cwd(), 'public', f), 'utf8');
            const [destRaw, cardRaw] = await Promise.all([
                pub('events-destinations.json'),
                pub('events-cards.json'),
            ]);
            const dests = (JSON.parse(destRaw) as { events: any[] }).events;
            const cards = new Map<string, any>();
            for (const c of (JSON.parse(cardRaw) as { events: any[] }).events) cards.set(c.id, c);

            const index = new Map<string, ShareEvent>();
            for (const e of dests) {
                const card = cards.get(e.id);
                index.set(eventShareSlug(e.id), {
                    id: e.id,
                    title: e.title,
                    time: e.time,
                    hasSpecificTime: !!e.hasSpecificTime,
                    locationName: e.locationName || '',
                    emoji: e.emoji || '🎉',
                    hostName: card?.hostName || undefined,
                    coverImage: card?.coverImage || undefined,
                });
            }
            return index;
        })();
    }
    return indexPromise;
}

export async function getShareEvent(slug: string): Promise<ShareEvent | null> {
    const index = await loadIndex();
    return index.get(slug) ?? null;
}

// Svensk datum-/tidsformattering (samma zon-tänk som stadssidorna).
const TZ = 'Europe/Stockholm';
const dateFmt = new Intl.DateTimeFormat('sv-SE', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long' });
const clockFmt = new Intl.DateTimeFormat('sv-SE', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });

/** T.ex. "Söndag 5 juli kl 18.30" — bara första bokstaven versal (svensk stil). */
export function shareTimeLabel(e: ShareEvent): string {
    const d = new Date(e.time);
    const label = dateFmt.format(d) + (e.hasSpecificTime ? ` kl ${clockFmt.format(d)}` : '');
    return label.charAt(0).toUpperCase() + label.slice(1);
}
