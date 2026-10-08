// src/services/rsvpService.ts
import { collection, deleteDoc, doc, getDocs, limit as qLimit, orderBy, query, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { eventShareSlug } from '../utils/eventShareSlug';
import { rsvpShareId } from '../utils/rsvpTransition';
import { recordForturInvite } from './forturService';
import type { EventRsvpStatus } from '@/types';

/**
 * Kommer/Intresserad på ALLA event (6/10, spår 3 i produktplanen): det
 * publika svaret bor i eventRsvps/{slug}/svar/{uid} — slug är eventShareSlug
 * som för eventStats, eftersom skrapade events rå-id är en URL och ogiltigt
 * som doc-id. ANONYMA svar är poängen (Josef: "om det är okända från typ
 * facebook så ska de räknas med"): uid kan vara en anonym session
 * (ensureTipIdentity), då utan namn/bild → grå avatar i kortet.
 *
 * Räknarna (eventStats.going/.interested) skrivs separat av föräldern via
 * recordEventRsvpCount — det här är själva svaret med namn/bild för
 * avatarraden. Eget läge speglas dessutom i users.goingEventIds/
 * interestedEventIds (inloggade) + localStorage, för snabb hydrering utan
 * collectionGroup-frågor.
 */

export interface RsvpFace {
    uid: string;
    name: string | null;
    photoURL: string | null;
    status: EventRsvpStatus;
}

function svarDocRef(eventId: string, userCreated: boolean | undefined, uid: string) {
    const slug = eventShareSlug(rsvpShareId(eventId, userCreated));
    return doc(db, 'eventRsvps', slug, 'svar', uid);
}

/** Skriv (eller ta bort, status null) sitt svar. Kastar vid fel — föräldern
 *  visar toast och backar det optimistiska läget. */
export async function setRsvpStatus(
    eventId: string,
    userCreated: boolean | undefined,
    uid: string,
    status: EventRsvpStatus | null,
    who: { name?: string | null; photoURL?: string | null },
): Promise<void> {
    const ref = svarDocRef(eventId, userCreated, uid);
    if (status === null) {
        await deleteDoc(ref);
    } else {
        await setDoc(ref, {
            eventId: rsvpShareId(eventId, userCreated),
            status,
            // Anonyma svar har varken namn eller bild — fälten utelämnas helt
            // (reglerna vitlistar dem, men null-värden är onödigt brus).
            ...(who.name ? { name: who.name } : {}),
            ...(who.photoURL ? { photoURL: who.photoURL } : {}),
            createdAt: serverTimestamp(),
        });
        // Förturen (8/10): kom man hit via en inbjudningslänk är det här
        // "vännen som tackar ja" - inbjudaren bokförs (no-op annars).
        void recordForturInvite(uid, 'svar', ref.parent.parent!.id);
    }
    facesCache.delete(ref.parent.parent!.id);
}

// Sessionscache för avatarraden — en läsning per event och besök; egna svar
// invaliderar (setRsvpStatus ovan) så raden hämtas om med en själv i.
const facesCache = new Map<string, Promise<RsvpFace[]>>();

/** De senaste svaren för avatarraden i kortet ("liten profilbild"). Äldst
 *  först så inbjudaren (som oftast svarade först) står främst. Fel → tom
 *  lista (raden döljs i stället för att ljuga). */
export function fetchRsvpFaces(eventId: string, userCreated: boolean | undefined, max = 12): Promise<RsvpFace[]> {
    const slug = eventShareSlug(rsvpShareId(eventId, userCreated));
    let p = facesCache.get(slug);
    if (!p) {
        p = (async (): Promise<RsvpFace[]> => {
            try {
                const snap = await getDocs(query(
                    collection(db, 'eventRsvps', slug, 'svar'),
                    orderBy('createdAt', 'asc'),
                    qLimit(max),
                ));
                return snap.docs.map(d => {
                    const data = d.data();
                    return {
                        uid: d.id,
                        name: typeof data.name === 'string' ? data.name : null,
                        photoURL: typeof data.photoURL === 'string' ? data.photoURL : null,
                        status: data.status === 'interested' ? 'interested' : 'going',
                    } satisfies RsvpFace;
                });
            } catch {
                return [];
            }
        })();
        facesCache.set(slug, p);
    }
    return p;
}
