/**
 * Gilla-siffran vid hjärtat på eventkortet.
 *
 * Serverns räknare (eventStats.likes) läses EN gång per kortöppning; ens egen
 * tryckning under tiden kortet är öppet ska ändå synas direkt. Därför bär
 * kortet med sig hur gillat-läget såg ut när siffran hämtades och justerar
 * lokalt: har läget flippats sedan hämtningen är det +-1 mot basen - serverns
 * increment är fire-and-forget och hinner inte alltid fram.
 *
 * Aldrig negativt: en avgillning vars +1 aldrig nådde servern kan annars dra
 * basen under noll.
 */
export function displayedLikeCount(
    base: number,
    savedAtFetch: boolean,
    savedNow: boolean,
): number {
    const adjustment = savedNow === savedAtFetch ? 0 : savedNow ? 1 : -1;
    return Math.max(0, base + adjustment);
}
