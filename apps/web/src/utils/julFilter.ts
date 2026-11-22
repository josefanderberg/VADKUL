/**
 * julFilter.ts - kartans två LÄGEN ihop: 🔥 Populära och 🎄 Jul (#272).
 *
 * Båda är egna lägen, inte kategorier. Ett läge ENSAMT smalnar kartan till
 * sina event; BÅDA på är en UNION (populära OCH julevent visas), samma
 * tanke som 🔥 + kategorier (ägarbeslut 11/10). Inget läge på = allt passerar.
 *
 * Användarskapade event syns alltid (sajtens kärna) - 🔥-regeln släpper dem
 * via sin bypass (utils/popularFilter), jul-läget gör likadant här.
 */
import { ärJulevent } from './julevent';
import { passesPopularFilter } from './popularFilter';

interface LägesKandidat {
    title?: string | null;
    pop?: boolean;
    userCreated?: boolean;
    featuredUntil?: Date;
}

export function passesModeFilter(e: LägesKandidat, popularOnly: boolean, julOnly: boolean): boolean {
    if (!popularOnly && !julOnly) return true;
    if (popularOnly && passesPopularFilter(e, true)) return true;
    return julOnly && (!!e.userCreated || ärJulevent(e.title));
}
