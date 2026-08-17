/**
 * setEventImage — byt omslagsbild (coverImage) för ett event.
 *
 * Uppdaterar BÅDE den lokala SQLite-spegeln (events.db, `link_events.coverImage`)
 * OCH Firestore (`linkEvents`-dokumentet) så webbappen och 10-listan ser samma bild.
 *
 * Firestore-skrivningen är best-effort: saknas service-account.json (t.ex. under
 * lokal smoke-test) uppdateras bara SQLite och `firestoreUpdated` blir false.
 *
 * Eventet identifieras med sin URL (PRIMARY KEY i link_events).
 */

import Database from 'better-sqlite3';
import path from 'path';
import { stamped } from './firestoreStamp';

const DB_PATH = process.env.SCRAPER_SQLITE_PATH
    ? path.resolve(process.env.SCRAPER_SQLITE_PATH)
    : path.resolve(__dirname, '../../events.db');

export interface SetImageResult {
    /** Hittades eventet alls i SQLite? */
    found: boolean;
    /** Skrevs raden i SQLite? */
    dbUpdated: boolean;
    /** Skrevs dokumentet i Firestore? (false om Firestore ej tillgängligt) */
    firestoreUpdated: boolean;
    /** firestoreId som hittades (om något) */
    firestoreId: string | null;
    /** Felmeddelande (om Firestore-delen kastade) — SQLite kan ändå ha gått igenom */
    error?: string;
}

/** Enkel sanity-koll: vi sätter bara http(s)-URL:er. */
export function isValidImageUrl(url: string): boolean {
    return /^https?:\/\/\S+$/i.test(url.trim());
}

/** Begränsa hur länge vi väntar på Firestore — annars kan en nätverkshicka
 *  hänga hela bot-flödet (gRPC retryar annars i evighet). */
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
    return Promise.race([
        p,
        new Promise<T>((_, reject) =>
            setTimeout(() => reject(new Error(`${label} timeout efter ${ms}ms`)), ms).unref?.()),
    ]);
}

export async function setEventImage(eventUrl: string, imageUrl: string): Promise<SetImageResult> {
    const img = imageUrl.trim();

    // ── 1. SQLite (lokal spegel) ─────────────────────────────────────────────
    let dbUpdated = false;
    let firestoreId: string | null = null;
    const db = new Database(DB_PATH);
    try {
        const row = db
            .prepare('SELECT firestoreId FROM link_events WHERE url = ?')
            .get(eventUrl) as { firestoreId: string | null } | undefined;
        if (!row) {
            return { found: false, dbUpdated: false, firestoreUpdated: false, firestoreId: null };
        }
        firestoreId = row.firestoreId ?? null;
        const info = db
            .prepare('UPDATE link_events SET coverImage = ?, updatedAt = ? WHERE url = ?')
            .run(img, new Date().toISOString(), eventUrl);
        dbUpdated = info.changes > 0;
    } finally {
        db.close();
    }

    // ── 2. Firestore (best-effort) ───────────────────────────────────────────
    let firestoreUpdated = false;
    try {
        // Dynamisk import: undviker att initiera Firebase (banner + service-account)
        // när bara SQLite behövs på anropssidan.
        const { db: firestore } = await import('../config/firebase');
        if (firestore) {
            const FS_TIMEOUT = 15_000;
            if (firestoreId) {
                await withTimeout(
                    firestore.collection('linkEvents').doc(firestoreId).update(stamped({ coverImage: img })),
                    FS_TIMEOUT, 'Firestore update');
                firestoreUpdated = true;
            } else {
                const snap = await withTimeout(
                    firestore.collection('linkEvents').where('url', '==', eventUrl).limit(1).get(),
                    FS_TIMEOUT, 'Firestore query');
                if (!snap.empty) {
                    await withTimeout(
                        snap.docs[0].ref.update(stamped({ coverImage: img })),
                        FS_TIMEOUT, 'Firestore update');
                    firestoreId = snap.docs[0].id;
                    firestoreUpdated = true;
                }
            }
        }
    } catch (e) {
        return {
            found: true,
            dbUpdated,
            firestoreUpdated,
            firestoreId,
            error: `Firestore: ${(e as Error).message}`,
        };
    }

    return { found: true, dbUpdated, firestoreUpdated, firestoreId };
}
