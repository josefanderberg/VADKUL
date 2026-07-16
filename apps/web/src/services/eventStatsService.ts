// src/services/eventStatsService.ts
import { doc, getDoc, setDoc, increment } from 'firebase/firestore';
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
        const month = new Date().toISOString().slice(0, 7); // 'ÅÅÅÅ-MM'
        let domain: string | null = null;
        try { domain = new URL(evt.url || evt.id).hostname.replace(/^www\./, ''); } catch { /* icke-URL */ }
        // OBS: nästlad map (INTE punktnotation) — setDoc+merge deep-mergar
        // mapar, medan 'clicksByMonth.2026-07' som nyckel hade blivit ett
        // bokstavligt fältnamn med punkt i (punktvägar tolkas bara av updateDoc).
        setDoc(ref, {
            eventId: evt.id,
            clicks: increment(1),
            clicksByMonth: { [month]: increment(1) },
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
