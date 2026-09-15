import { readFile } from 'fs/promises';
import path from 'path';
import { eventShareSlug } from '@/utils/eventShareSlug';
import { buildCardIndex } from '@/utils/eventKey';
import { emojiForCategory } from '@/utils/categories';
import { getAdminDb } from '@/lib/firestore-admin';

// Uppslag slug → event för delningssidorna (/e/[slug]). Läser samma
// events-JSON som stadssidorna, men vid RUNTIME (delningssidor renderas på
// begäran — 21k möjliga slugs går inte att förrendera). Funktionspaketet
// innehåller public/-mappen, så fs-läsning fungerar i drift.
// User-skapade event (Firestore linkEvents) finns INTE i aggregaten — de slås
// upp via Firestore-fallbacken längst ner (sedan 15/9). Bakgrund: deras gamla
// /?event=-delningslänkar normaliserades av Facebook till og:url =
// https://vadkul.se, så förhandsvisningskortet tappade queryn och öppnade
// bara startsidan (Drömfabriken-länkarna 14–15/9). Dela-knappen ger dem
// numera /e/-länkar precis som skrapade event.

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
            // Tolerant uppslag: klarar både gammalt och slankt kortformat
            // (se utils/eventKey) — aggregatet och webben byter format vid
            // olika tidpunkter.
            const lookupCard = buildCardIndex((JSON.parse(cardRaw) as { events: any[] }).events);

            const index = new Map<string, ShareEvent>();
            for (const e of dests) {
                const card = lookupCard(e.id);
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

// ── Firestore-fallbacken: user-skapade event ────────────────────────────────
// Sluggen är en hash av dokument-id:t och kan inte vändas — men de användar-
// skapade eventen är FÅ (tiotal): hämta alla synliga i EN select()-query och
// matcha per slug. Memoiseras med kort TTL så FB-skrapare + besökare inte
// kostar en query var (jfr regeln: aldrig hela kollektioner — det här är den
// lilla userCreated-skivan, inte pipelinens tiotusentals rader).
const USER_INDEX_TTL_MS = 5 * 60_000;
let userIndexMemo: { at: number; index: Map<string, ShareEvent> } | null = null;
let userIndexBuild: Promise<Map<string, ShareEvent>> | null = null;

function loadUserCreatedIndex(): Promise<Map<string, ShareEvent>> {
    if (userIndexMemo && Date.now() - userIndexMemo.at < USER_INDEX_TTL_MS) {
        return Promise.resolve(userIndexMemo.index);
    }
    if (!userIndexBuild) {
        userIndexBuild = (async () => {
            const index = new Map<string, ShareEvent>();
            try {
                const db = getAdminDb();
                if (db) {
                    const snap = await db.collection('linkEvents')
                        .where('userCreated', '==', true)
                        .select('title', 'time', 'hasSpecificTime', 'locationName',
                            'category', 'emoji', 'hostName', 'coverImage', 'hidden')
                        .get();
                    snap.forEach(doc => {
                        const v = doc.data() as Record<string, unknown>;
                        // hidden skrivs som 0/1 av klienten och bool av andra vägar.
                        if (v.hidden === true || v.hidden === 1) return;
                        const time = v.time && typeof (v.time as { toDate?: unknown }).toDate === 'function'
                            ? (v.time as { toDate: () => Date }).toDate()
                            : new Date(String(v.time ?? ''));
                        if (isNaN(time.getTime())) return;
                        if (typeof v.title !== 'string' || !v.title.trim()) return;
                        index.set(eventShareSlug(doc.id), {
                            id: doc.id,
                            title: v.title,
                            time: time.toISOString(),
                            hasSpecificTime: v.hasSpecificTime !== false,
                            locationName: typeof v.locationName === 'string' ? v.locationName : '',
                            emoji: (typeof v.emoji === 'string' && v.emoji)
                                ? v.emoji
                                : emojiForCategory(typeof v.category === 'string' ? v.category : null),
                            hostName: typeof v.hostName === 'string' && v.hostName ? v.hostName : undefined,
                            coverImage: typeof v.coverImage === 'string' && v.coverImage ? v.coverImage : undefined,
                        });
                    });
                }
            } catch {
                // Utan admin-db (t.ex. lokal dev utan service-account): ingen
                // fallback — exakt beteendet som fanns före 15/9.
            }
            userIndexMemo = { at: Date.now(), index };
            return index;
        })().finally(() => { userIndexBuild = null; });
    }
    return userIndexBuild;
}

export async function getShareEvent(slug: string): Promise<ShareEvent | null> {
    const index = await loadIndex();
    const hit = index.get(slug);
    if (hit) return hit;
    return (await loadUserCreatedIndex()).get(slug) ?? null;
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
