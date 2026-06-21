/**
 * eventClaimService.ts — Firestore-lagret för EVENT-ägande i flipper-läget.
 *
 * Mekanik: varje gång kulan studsar på ett event räknas en träff. Den spelare
 * som har FLEST ackumulerade träffar på ett event "äger" det → en ring i
 * ägarens färg ritas runt eventet, och ett nummer visar hur många träffar som
 * krävs för att ta över det. (Reviret färgar HEX-RUTOR; det här färgar enskilda
 * EVENT — två separata lager ovanpå samma pinball-karta.)
 *
 * Doc-id = event-gruppens nyckel `lat.toFixed(4),lng.toFixed(4)` (samma
 * geografiska nyckel som V2Map grupperar markörer på → stabil på alla klienter).
 *
 * Säkerhet (steg 2, "blött"): allt är klient-betrott precis som Reviret —
 * vem som helst inloggad kan skriva. `hits`-mappen kan i teorin manipuleras;
 * steg 3 lägger server-verifierad befästning ovanpå via en Cloud Function.
 */
import {
    collection, doc, onSnapshot, query, where, runTransaction, serverTimestamp,
} from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { regionForLngLat, effectiveHue } from '@/lib/reviret';

export interface EventClaim {
    ownerUid: string;
    ownerHue: number;        // ägarens färgton → ringfärg på alla klienter
    ownerHits: number;       // rekordet att slå (= hits[ownerUid])
    ownerName: string;
    hits: Record<string, number>; // ackumulerade träffar per spelare
}

/** En träff-batch från ett avslutat skott: antal träffar per event-grupp. */
export interface EventHitEntry { key: string; lat: number; lng: number; hits: number; }

/**
 * Lyssna på alla event-claims i de angivna regionerna (samma region-bucketing
 * som Reviret). Kapar tyst vid 30 (Firestore `in`-tak). Fel sväljs (regler ej
 * deployade än / offline) så spelet aldrig kraschar.
 */
export function subscribeEventClaims(
    regions: string[],
    onChange: (claims: Map<string, EventClaim>) => void,
): () => void {
    const capped = regions.slice(0, 30);
    if (capped.length === 0) { onChange(new Map()); return () => {}; }
    const q = query(collection(db, 'eventClaims'), where('region', 'in', capped));
    return onSnapshot(
        q,
        (snap) => {
            const out = new Map<string, EventClaim>();
            snap.forEach((d) => {
                const x = d.data();
                out.set(d.id, {
                    ownerUid: String(x.ownerUid ?? ''),
                    ownerHue: Number(x.ownerHue) || 0,
                    ownerHits: Number(x.ownerHits) || 0,
                    ownerName: String(x.ownerName ?? ''),
                    hits: (x.hits && typeof x.hits === 'object') ? x.hits : {},
                });
            });
            onChange(out);
        },
        () => { /* regler ej deployade / offline → bäst-möjligt, krascha inte */ },
    );
}

/**
 * Bokför träffar från ett skott. Per event körs en transaktion som ökar
 * spelarens egna räknare och flyttar över ägandet om den nya summan slår
 * nuvarande ägares rekord. Bäst-möjligt: fel sväljs (t.ex. innan reglerna
 * deployats) så spelet aldrig kraschar mitt i ett skott.
 */
export async function recordEventHits(entries: EventHitEntry[]): Promise<void> {
    const user = auth.currentUser;
    if (!user || entries.length === 0) return;
    const hue = effectiveHue(user.uid);
    const name = user.displayName ?? '';
    for (const e of entries) {
        if (e.hits <= 0) continue;
        const ref = doc(db, 'eventClaims', e.key);
        await runTransaction(db, async (tx) => {
            const snap = await tx.get(ref);
            const data = snap.exists() ? snap.data() : null;
            const hits: Record<string, number> = { ...(data?.hits ?? {}) };
            const mine = (hits[user.uid] ?? 0) + e.hits;
            hits[user.uid] = mine;

            let ownerUid = String(data?.ownerUid ?? user.uid);
            let ownerHits = Number(data?.ownerHits ?? 0);
            let ownerHue = Number(data?.ownerHue ?? hue);
            let ownerName = String(data?.ownerName ?? name);
            if (mine > ownerHits) {
                ownerUid = user.uid; ownerHits = mine; ownerHue = hue; ownerName = name;
            }
            tx.set(ref, {
                ownerUid, ownerHits, ownerHue, ownerName, hits,
                region: regionForLngLat(e.lng, e.lat),
                updatedAt: serverTimestamp(),
            });
        }).catch(() => { /* bäst-möjligt — se docstring */ });
    }
}
