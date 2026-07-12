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
