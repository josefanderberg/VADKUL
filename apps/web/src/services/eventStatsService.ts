// src/services/eventStatsService.ts
import { doc, setDoc, increment } from 'firebase/firestore';
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
 * Ingen läs-yta i appen — ägaren läser siffrorna i Firestore-konsolen.
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
