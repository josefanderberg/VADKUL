/**
 * Beslutslogik för Firestore→SQLite-synken: hel eller inkrementell läsning?
 *
 * Inkrementellt läge hämtar bara dokument med `updatedAt > cursor` — kräver
 * att alla skrivvägar stämplar updatedAt (se firestoreStamp.ts). Som
 * självläkning mot ostämplade skrivningar (t.ex. web-sidans attendees eller
 * ett glömt oneoff-script) körs en hel sync automatiskt var
 * FULL_SYNC_INTERVAL_DAYS:e dag.
 */

export const FULL_SYNC_INTERVAL_DAYS = 7;

/**
 * Överlapp bakåt från cursorn: täcker klockskev mellan maskiner och dokument
 * som skrevs medan förra synken pågick. Dubbelhämtade dokument är ofarliga —
 * upserten är idempotent.
 */
export const CURSOR_OVERLAP_MS = 10 * 60_000;

export interface SyncPlanInput {
    now: Date;
    /** ISO-tid (körstart) för senaste lyckade sync, oavsett läge. */
    lastSyncAt: string | null;
    /** ISO-tid för senaste HELA sync. */
    lastFullSyncAt: string | null;
    forceFull?: boolean;
}

export interface SyncPlan {
    mode: 'full' | 'incremental';
    /** Cursor inkl. överlapp — bara i inkrementellt läge. */
    since?: Date;
    reason: string;
}

export function planSync({ now, lastSyncAt, lastFullSyncAt, forceFull }: SyncPlanInput): SyncPlan {
    if (forceFull) return { mode: 'full', reason: '--full angavs' };
    if (!lastSyncAt) return { mode: 'full', reason: 'ingen cursor — första körningen' };

    const last = new Date(lastSyncAt);
    if (isNaN(last.getTime())) return { mode: 'full', reason: `ogiltig cursor ("${lastSyncAt}")` };

    const lastFull = lastFullSyncAt ? new Date(lastFullSyncAt) : null;
    if (!lastFull || isNaN(lastFull.getTime())
        || now.getTime() - lastFull.getTime() > FULL_SYNC_INTERVAL_DAYS * 86_400_000) {
        return { mode: 'full', reason: `självläkning — >${FULL_SYNC_INTERVAL_DAYS} dagar sedan senaste hel-sync` };
    }

    return {
        mode: 'incremental',
        since: new Date(last.getTime() - CURSOR_OVERLAP_MS),
        reason: `ändringar sedan ${lastSyncAt} (${CURSOR_OVERLAP_MS / 60_000} min överlapp)`,
    };
}
