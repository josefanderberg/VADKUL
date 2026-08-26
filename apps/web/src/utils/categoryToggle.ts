/**
 * Toggle-regeln för kategorifiltret (Josef 26/8): kryssar man i en VANLIG
 * kategori släcks opt-in-källorna (Svenska kyrkan/PRO, och 🧸 i familj-opt-in-
 * läget) automatiskt — "filtrera på Musik" ska betyda BARA Musik-utbudet, inte
 * Musik + kyrkans hundratals event som råkade vara förvalda. Rensa-krysset
 * återställer sedan hela läget till standard (defaultSpecialCategories).
 *
 * Regeln gäller bara PÅ-slag av normala kategorier: att kryssa i en opt-in-
 * källa rör inte normal-valet ("PRO OCKSÅ", se categoryDefaults), och ur-kryss
 * är alltid bara ur-kryss.
 */
import { SPECIAL_CATEGORY_KEYS } from './categories';

export function toggleCategory(
    prev: ReadonlySet<string>,
    id: string,
    opts: { familyOptIn?: boolean } = {},
): Set<string> {
    const familyOptIn = !!opts.familyOptIn;
    const next = new Set(prev);
    if (next.has(id)) {
        next.delete(id);
        return next;
    }
    next.add(id);
    const isOptIn = SPECIAL_CATEGORY_KEYS.has(id) || (familyOptIn && id === 'family');
    if (!isOptIn) {
        for (const key of SPECIAL_CATEGORY_KEYS) next.delete(key);
        if (familyOptIn) next.delete('family');
    }
    return next;
}
