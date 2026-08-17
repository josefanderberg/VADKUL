/**
 * updatedAt-stämpel för ALLA Firestore-skrivningar mot `linkEvents`.
 *
 * Inkrementella synken (sync-firestore-to-sqlite) hämtar bara dokument med
 * `updatedAt > cursor` — ett dokument som skrivs UTAN stämpel syns aldrig i
 * inkrementella hämtningar och fastnar i spegeln tills nästa hel-sync
 * (körs automatiskt var 7:e dag som självläkning).
 *
 * Regel: varje `.update()`/`.set()`/`.add()` mot linkEvents ska slå in sin
 * payload i `stamped(...)`. Admin-SDK:n konverterar Date → Timestamp åt oss.
 */
export function stamped<T extends object>(patch: T): T & { updatedAt: Date } {
    return { ...patch, updatedAt: new Date() };
}
