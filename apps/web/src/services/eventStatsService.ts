// src/services/eventStatsService.ts
import { doc, getDoc, setDoc, increment, collection, query, where, documentId, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { eventShareSlug } from '../utils/eventShareSlug';

/**
 * Visningsräknare per event: eventStats/{slug} med fältet `views`.
 *
 * Doc-id är eventShareSlug(event.id) — rå-id:t för scrapade event är en URL
 * och därmed ogiltigt som Firestore-doc-id ('/' är segmentavskiljare). Slugen
 * är samma stabila hash som /e/[slug]-delningen använder, så statistiken kan
 * korsrefereras mot delningslänkarna. Rå-id:t sparas som fält för uppslag.
 *
 * Visas som 👁-badge på eventkortet (LinkEventCard) + läsbart i konsolen.
 */
export function recordEventView(eventId: string): void {
    try {
        const ref = doc(db, 'eventStats', eventShareSlug(eventId));
        // Fire-and-forget setDoc-merge + increment (samma mönster som
        // users.inviteCount): räknaren är best-effort och får aldrig störa UI:t.
        setDoc(ref, { views: increment(1), eventId }, { merge: true }).catch(() => {
            /* nätverk/regler nere → släpp visningen */
        });
    } catch {
        /* defensivt — en trasig räknare ska inte fälla kartan */
    }
}

/**
 * Klick på ANMÄL = vi länkar en besökare vidare till arrangören. Räknas i
 * SAMMA eventStats-doc som visningarna: `clicks` (totalt) + `clicksByMonth`
 * ('ÅÅÅÅ-MM' → antal, tidsserien bakom "vi har skickat er X besökare sedan
 * maj") + hostName/domain/title INBAKADE i dokumentet — eventet försvinner ur
 * aggregaten när det passerat, men statistiken ska kunna summeras per
 * arrangör långt senare (outreach-mejlen, docs/outreach/).
 *
 * Aggregering per arrangör: filtrera eventStats på hostName/domain och summera
 * clicks — se docs/outreach/README.md.
 */
export function recordEventClick(evt: { id: string; url?: string; title?: string; hostName?: string }): void {
    try {
        const ref = doc(db, 'eventStats', eventShareSlug(evt.id));
        const now = new Date().toISOString();
        const month = now.slice(0, 7);  // 'ÅÅÅÅ-MM'
        // Dagshink (14/9): månadshinkarna kan inte svara på "klick senaste
        // 7/30 dagarna" — arrangörsmejlens fönster behöver dagar. Docstorleken
        // är ofarlig: event lever veckor, inte år.
        const day = now.slice(0, 10);   // 'ÅÅÅÅ-MM-DD'
        let domain: string | null = null;
        try { domain = new URL(evt.url || evt.id).hostname.replace(/^www\./, ''); } catch { /* icke-URL */ }
        // OBS: nästlad map (INTE punktnotation) — setDoc+merge deep-mergar
        // mapar, medan 'clicksByMonth.2026-07' som nyckel hade blivit ett
        // bokstavligt fältnamn med punkt i (punktvägar tolkas bara av updateDoc).
        setDoc(ref, {
            eventId: evt.id,
            clicks: increment(1),
            clicksByMonth: { [month]: increment(1) },
            clicksByDay: { [day]: increment(1) },
            ...(evt.title ? { title: evt.title } : {}),
            ...(evt.hostName ? { hostName: evt.hostName } : {}),
            ...(domain ? { domain } : {}),
        }, { merge: true }).catch(() => {
            /* nätverk/regler nere → släpp klicket, aldrig störa utlänkningen */
        });
    } catch {
        /* defensivt — räknaren får inte hindra att länken öppnas */
    }
}

/**
 * Gilla-räknaren per event: `likes` i SAMMA eventStats-doc som views/clicks.
 * +1 när någon gillar (hjärtat på kortet), -1 när gillningen tas bort (hjärtat
 * igen, krysset i sparat-listan eller svep bort). Fire-and-forget som views -
 * räknaren är best-effort och får aldrig störa själva sparningen (som bor i
 * users.savedEventIds och alltid går igenom).
 */
export function recordEventLike(eventId: string, delta: 1 | -1): void {
    try {
        const ref = doc(db, 'eventStats', eventShareSlug(eventId));
        setDoc(ref, { likes: increment(delta), eventId }, { merge: true }).catch(() => {
            /* nätverk/regler nere → släpp gillningen ur statistiken */
        });
    } catch {
        /* defensivt - en trasig räknare ska inte fälla kartan */
    }
}

/**
 * Kommer/Intresserad-räknarna (6/10, spår 3): `going`/`interested` i SAMMA
 * eventStats-doc. Deltan kommer från utils/rsvpTransition (testad) så ett
 * byte Kommer→Intresserad blir exakt -1/+1. Fire-and-forget som likes -
 * själva svaret bor i eventRsvps/{slug}/svar/{uid} och går alltid igenom.
 */
export function recordEventRsvpCount(eventId: string, deltas: { going?: number; interested?: number }): void {
    const fields: Record<string, unknown> = {};
    if (deltas.going) fields.going = increment(deltas.going);
    if (deltas.interested) fields.interested = increment(deltas.interested);
    if (Object.keys(fields).length === 0) return;
    try {
        const ref = doc(db, 'eventStats', eventShareSlug(eventId));
        setDoc(ref, { ...fields, eventId }, { merge: true }).catch(() => {
            /* nätverk/regler nere → släpp räknaren, aldrig svaret */
        });
    } catch {
        /* defensivt - en trasig räknare ska inte fälla kartan */
    }
}

export interface EventEngagement { likes: number; going: number; interested: number }

// Sessionscache med promise-dedupe: hjärtats siffra OCH footerns räknare
// läser SAMMA getDoc - en läsning per event och besök oavsett hur många ytor
// som frågar. Fel cachas inte (nästa öppning får försöka igen).
const engagementCache = new Map<string, Promise<EventEngagement | null>>();

/**
 * Läs likes + going + interested i ETT svep (siffran vid hjärtat och
 * Kommer/Intresserad-footern). Returnerar null vid fel (offline, rules ej
 * deployade) så siffrorna döljs i stället för att ljuga "0".
 */
export function getEventEngagement(eventId: string): Promise<EventEngagement | null> {
    const slug = eventShareSlug(eventId);
    let p = engagementCache.get(slug);
    if (!p) {
        p = (async (): Promise<EventEngagement | null> => {
            try {
                const snap = await getDoc(doc(db, 'eventStats', slug));
                const data = snap.exists() ? snap.data() : null;
                // Decrement kan i teorin gå under noll (t.ex. avgillning vars
                // +1 aldrig nådde servern) - visa aldrig ett negativt tal.
                const n = (v: unknown) => (typeof v === 'number' ? Math.max(0, v) : 0);
                return { likes: n(data?.likes), going: n(data?.going), interested: n(data?.interested) };
            } catch {
                return null;
            }
        })();
        engagementCache.set(slug, p);
        void p.then(v => { if (v === null) engagementCache.delete(slug); });
    }
    return p;
}

/**
 * Läs gilla-antalet för ett event (siffran vid hjärtat på kortet). Delar
 * läsning och cache med getEventEngagement.
 */
export async function getEventLikes(eventId: string): Promise<number | null> {
    const engagement = await getEventEngagement(eventId);
    return engagement === null ? null : engagement.likes;
}

/**
 * Läs gilla-antal för FLERA event i klump - stadssidornas spotlight, vars
 * rader läses live ur linkEvents och därför står utanför aggregatets bakade
 * siffror (daglistan får sina ur events-destinations.json i stället, noll
 * läsningar). documentId()-in-frågor i bitar om 30 (Firestores tak); event
 * utan eventStats-dokument kostar ingenting och utelämnas (= 0). Fel →
 * tom mapp, så siffrorna döljs i stället för att ljuga.
 */
export async function getEventLikesBatch(eventIds: string[]): Promise<Map<string, number>> {
    const out = new Map<string, number>();
    if (eventIds.length === 0) return out;
    try {
        const bySlug = new Map<string, string>();
        for (const id of eventIds) bySlug.set(eventShareSlug(id), id);
        const slugs = [...bySlug.keys()];
        const chunks: string[][] = [];
        for (let i = 0; i < slugs.length; i += 30) chunks.push(slugs.slice(i, i + 30));
        const snaps = await Promise.all(chunks.map(c =>
            getDocs(query(collection(db, 'eventStats'), where(documentId(), 'in', c)))));
        for (const snap of snaps) {
            for (const d of snap.docs) {
                const likes = d.data()?.likes;
                const id = bySlug.get(d.id);
                if (id && typeof likes === 'number' && likes > 0) out.set(id, likes);
            }
        }
    } catch {
        /* offline/regler nere → siffrorna döljs */
    }
    return out;
}

/**
 * Läs visningsantalet för ett event (👁-badgen på kortet). En getDoc per
 * kortöppning — inga lyssnare, ingen extra egress. Returnerar null vid fel
 * (offline, rules ej deployade) så badgen döljs i stället för att ljuga "0".
 */
export async function getEventViews(eventId: string): Promise<number | null> {
    try {
        const snap = await getDoc(doc(db, 'eventStats', eventShareSlug(eventId)));
        if (!snap.exists()) return 0;
        const views = snap.data()?.views;
        return typeof views === 'number' ? views : 0;
    } catch {
        return null;
    }
}
