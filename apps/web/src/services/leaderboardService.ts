/**
 * leaderboardService.ts — DAGENS TOPPLISTA för Reviret-spelet.
 *
 * Varje spelare har EN rad per dag: `leaderboard/{dag}__{uid}` =
 * { uid, name, hue, points, events, day, region, updatedAt }. Vi behåller
 * dagens BÄSTA resultat (max poäng/event) via en transaktion — "dagens bästa
 * resultat" nollställs alltså varje dygn eftersom doc-id:t innehåller dagen.
 *
 * `hue` är spelarens effektiva färgton (vald i profilen, annars deterministisk per
 * uid — se effectiveHue) så topplistan kan färga varje rad utan att slå upp profiler.
 *
 * Bäst-möjligt: skrivfel sväljs (oinloggad / regler ej deployade / offline) så
 * spelet aldrig kraschar mitt i ett skott. Reglerna (#15 leaderboard) måste
 * deployas MANUELLT (`firebase deploy --only firestore:rules`) — tills dess
 * körs topplistan rent lokalt (writes/reads nekas tyst).
 */
import {
    collection, doc, onSnapshot, query, where, runTransaction, serverTimestamp,
} from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { effectiveHue } from '@/lib/reviret';

export interface LeaderboardEntry {
    uid: string;
    name: string;
    hue: number;
    points: number;
    events: number;
}

/** Lokal dagsnyckel "YYYY-MM-DD" (spelarens tidszon). */
export function todayKey(): string {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
}

/**
 * Spara dagens resultat för den inloggade spelaren. Behåller MAX poäng + event
 * för dagen (transaktion) så ett senare, mindre revir inte sänker placeringen.
 * Bäst-möjligt — fel sväljs (se filens docstring).
 */
export async function saveDailyScore(points: number, events: number, region: string): Promise<void> {
    const user = auth.currentUser;
    if (!user || points <= 0) return;
    const day = todayKey();
    const ref = doc(db, 'leaderboard', `${day}__${user.uid}`);
    const name = (user.displayName || 'Spelare').slice(0, 80);
    const hue = effectiveHue(user.uid);
    await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        const prevPoints = snap.exists() ? Number(snap.data().points) || 0 : 0;
        const prevEvents = snap.exists() ? Number(snap.data().events) || 0 : 0;
        tx.set(ref, {
            uid: user.uid,
            name,
            hue,
            points: Math.max(prevPoints, points),
            events: Math.max(prevEvents, events),
            day,
            region,
            updatedAt: serverTimestamp(),
        });
    }).catch(() => { /* bäst-möjligt — se docstring */ });
}

/**
 * Lyssna på dagens topplista. Equality-filter på `day` (auto-index, ingen
 * sammansatt index krävs) → sorteras + kapas på klienten till topp `max`.
 */
export function subscribeDailyLeaderboard(
    onChange: (entries: LeaderboardEntry[]) => void,
    max = 6,
): () => void {
    const q = query(collection(db, 'leaderboard'), where('day', '==', todayKey()));
    return onSnapshot(
        q,
        (snap) => {
            const rows: LeaderboardEntry[] = [];
            snap.forEach((d) => {
                const x = d.data();
                rows.push({
                    uid: String(x.uid ?? ''),
                    name: String(x.name ?? 'Spelare'),
                    hue: Number(x.hue) || 0,
                    points: Number(x.points) || 0,
                    events: Number(x.events) || 0,
                });
            });
            rows.sort((a, b) => b.points - a.points || b.events - a.events);
            onChange(rows.slice(0, max));
        },
        () => { /* regler ej deployade / offline → bäst-möjligt */ },
    );
}
