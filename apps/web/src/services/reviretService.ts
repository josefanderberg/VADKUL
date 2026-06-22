/**
 * reviretService.ts — Firestore-lagret för Reviret (asynkront territorie-spel).
 *
 * En ruta ägs av `territory/{cellId}` = { owner, color, region, claimedAt }.
 * `color` är ägarens färgton (sträng) så alla klienter ritar samma färg utan
 * att slå upp profiler. `region` är en grov geo-bucket så vi kan lyssna BARA på
 * de rutor som syns i vyn (Firestore `in`, max 30) i stället för hela kollektionen.
 *
 * Steg 2 (det här): vem som helst inloggad kan claima/stjäla en ruta genom att
 * sätta sig själv som ägare — allt är "blött". Steg 3 lägger server-verifierad
 * befästning (incheckning på riktiga event) ovanpå via en Cloud Function.
 */
import {
    collection, doc, onSnapshot, query, where, writeBatch, serverTimestamp,
} from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { regionForLngLat, cellCenterLngLat, effectiveHue } from '@/lib/reviret';

export interface TerritoryCell { owner: string; color: string; }

/** Inloggad spelares identitet + (effektiva) färgton (null om utloggad → kan inte claima). */
export function myReviretIdentity(): { uid: string; hue: number } | null {
    const user = auth.currentUser;
    if (!user) return null;
    return { uid: user.uid, hue: effectiveHue(user.uid) };
}

/**
 * Lyssna på alla rutor i de angivna regionerna. Kameran är fryst under en
 * pinball-session, så regionsuppsättningen beräknas en gång och ändras inte.
 * Kapar tyst vid 30 (Firestore `in`-tak) — anroparen loggar om något föll bort.
 */
export function subscribeTerritory(
    regions: string[],
    onChange: (cells: Map<string, TerritoryCell>) => void,
): () => void {
    const capped = regions.slice(0, 30);
    if (capped.length === 0) { onChange(new Map()); return () => {}; }
    const q = query(collection(db, 'territory'), where('region', 'in', capped));
    return onSnapshot(
        q,
        (snap) => {
            const out = new Map<string, TerritoryCell>();
            snap.forEach((d) => {
                const data = d.data();
                out.set(d.id, { owner: data.owner, color: String(data.color ?? '') });
            });
            onChange(out);
        },
        () => { /* rules ej deployade än / offline → bäst-möjligt, krascha inte */ },
    );
}

/**
 * Claima (eller stjäl) en uppsättning rutor åt den inloggade spelaren. Bäst-
 * möjligt: fel sväljs (t.ex. innan firestore-reglerna deployats) så spelet aldrig
 * kraschar mitt i ett skott. Batchar i klumpar om 450 (Firestore-tak 500).
 */
export async function claimCells(cells: string[]): Promise<void> {
    const user = auth.currentUser;
    if (!user || cells.length === 0) return;
    const color = String(effectiveHue(user.uid));
    for (let i = 0; i < cells.length; i += 450) {
        const batch = writeBatch(db);
        for (const cell of cells.slice(i, i + 450)) {
            const [lng, lat] = cellCenterLngLat(cell);
            batch.set(doc(db, 'territory', cell), {
                owner: user.uid,
                color,
                region: regionForLngLat(lng, lat),
                claimedAt: serverTimestamp(),
            });
        }
        await batch.commit().catch(() => { /* bäst-möjligt — se docstring */ });
    }
}
