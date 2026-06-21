/**
 * territoryService.ts — tunn Firestore-spegel för TERRITORIER (ackumulerade
 * konvex-hull-revir i flipper-läget). Lagrar ENDAST geometrin + medlems-eventen,
 * ALDRIG träffräknare/ägar-poäng: "ta över"-numret härleds live ur eventClaims
 * (se V2Map terrNumber) så det aldrig kan driva isär. Poängen med spegeln är att
 * de gyllene ytorna överlever reload och syns för andra spelare.
 *
 * Doc-id = medlems-eventens grupp-nycklar (`lat4,lng4`) sorterade och hopslagna
 * med '|' → deterministiskt & idempotent: skjuter man samma kluster igen skrivs
 * samma doc över i stället för att dubbleras.
 *
 * Säkerhet (steg 2, "blött"): klient-betrott precis som territory/eventClaims.
 * Reglerna (#14 territories) måste deployas MANUELLT — tills dess sväljs skriv.
 */
import {
    collection, doc, onSnapshot, query, where, setDoc, serverTimestamp,
} from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { regionForLngLat, effectiveHue } from '@/lib/reviret';

export interface Territory {
    ownerUid: string;
    ownerHue: number;        // ägar-färg (kosmetisk; ägandet räknas live ur eventClaims)
    ownerName: string;
    eventKeys: string[];     // medlems-eventens grupp-nycklar
    eventCount: number;
    ring: number[];          // platt [lng,lat,lng,lat,...] (Firestore tillåter ej nästlade arrayer)
}

/** Lyssna på alla territorier i regionerna. Kapar vid 30 (Firestore `in`). */
export function subscribeTerritories(
    regions: string[],
    onChange: (terrs: Map<string, Territory>) => void,
): () => void {
    const capped = regions.slice(0, 30);
    if (capped.length === 0) { onChange(new Map()); return () => {}; }
    const q = query(collection(db, 'territories'), where('region', 'in', capped));
    return onSnapshot(
        q,
        (snap) => {
            const out = new Map<string, Territory>();
            snap.forEach((d) => {
                const x = d.data();
                const ring = Array.isArray(x.ring) ? (x.ring as number[]) : [];
                const eventKeys = Array.isArray(x.eventKeys) ? (x.eventKeys as string[]) : [];
                out.set(d.id, {
                    ownerUid: String(x.ownerUid ?? ''),
                    ownerHue: Number(x.ownerHue) || 0,
                    ownerName: String(x.ownerName ?? ''),
                    eventKeys,
                    eventCount: Number(x.eventCount) || eventKeys.length,
                    ring,
                });
            });
            onChange(out);
        },
        () => { /* regler ej deployade / offline → bäst-möjligt */ },
    );
}

/** Spegla ett territorium till Firestore (best-effort). */
export async function saveTerritory(t: {
    id: string; eventKeys: string[]; ring: number[]; centroid: [number, number];
}): Promise<void> {
    const user = auth.currentUser;
    if (!user || t.eventKeys.length < 2 || t.ring.length < 4) return;
    await setDoc(
        doc(db, 'territories', t.id),
        {
            ownerUid: user.uid,
            ownerHue: effectiveHue(user.uid),
            ownerName: user.displayName ?? '',
            eventKeys: t.eventKeys,
            eventCount: t.eventKeys.length,
            ring: t.ring,
            region: regionForLngLat(t.centroid[0], t.centroid[1]),
            updatedAt: serverTimestamp(),
        },
        { merge: true },
    ).catch(() => { /* bäst-möjligt — se docstring */ });
}
