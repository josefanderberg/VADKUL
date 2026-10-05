// Ren slice-logik för /api/events/[layer] — vilka rader ur ett aggregat-lager
// en (kvantiserad) förfrågan ska få. Ingen Firestore och ingen packning här
// (testbart); routen läser lagren, memoiserar och packar.
import { tileKeyFor, descBucketFor, DESC_BUCKETS, type DestRowLike } from '@/utils/eventTiles';

/** En kvantiserad delmängd: tidsfönster och/eller en geografisk ruta. */
export interface SliceSpec {
    /** Epoch-ms, inklusive. Sätts alltid tillsammans med `to`. */
    from?: number;
    to?: number;
    /** Rutnyckel ur utils/eventTiles ("118_18"). */
    tile?: string;
}

/** Hör destinations-raden till slicen? Tid via `time`, ruta via lat/lng. */
export function inSlice(e: DestRowLike | null | undefined, spec: SliceSpec): boolean {
    if (spec.from !== undefined && spec.to !== undefined) {
        const t = typeof e?.time === 'string' ? Date.parse(e.time) : NaN;
        if (!Number.isFinite(t) || t < spec.from || t > spec.to) return false;
    }
    if (spec.tile !== undefined && tileKeyFor(e?.lat, e?.lng) !== spec.tile) return false;
    return true;
}

export function sliceDestinations<T extends DestRowLike>(events: readonly T[], spec: SliceSpec): T[] {
    return events.filter((e) => inSlice(e, spec));
}

/**
 * Korten för exakt de destinations-rader som hör till slicen. Korten bär inga
 * koordinater eller tider — de kopplas via `lookup` (buildCardIndex, som klarar
 * både slankt `h`- och gammalt `id`-format). Ordningen följer destinations.
 */
export function sliceCards<T>(
    destEvents: readonly DestRowLike[],
    lookup: (destId: string) => T | undefined,
    spec: SliceSpec,
): T[] {
    const out: T[] = [];
    for (const e of destEvents) {
        if (typeof e?.id !== 'string' || !inSlice(e, spec)) continue;
        const card = lookup(e.id);
        if (card) out.push(card);
    }
    return out;
}

/** Dela beskrivningslagret ({ id: text }) i DESC_BUCKETS hinkar på id:ts hash. */
export function buildDescBuckets(data: Record<string, string>): Record<string, string>[] {
    const buckets: Record<string, string>[] = Array.from({ length: DESC_BUCKETS }, () => ({}));
    for (const [id, text] of Object.entries(data)) {
        if (typeof text !== 'string' || !text) continue;
        buckets[descBucketFor(id)][id] = text;
    }
    return buckets;
}
