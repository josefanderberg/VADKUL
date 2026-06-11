/**
 * Textnormalisering som delas av engines — håll källspecifika regex i respektive
 * engine, men HTML-strippen av beskrivningar är identisk överallt.
 */

/**
 * Normalisera beskrivnings-HTML från en källa: strippa taggar och entities,
 * ta bort WP-excerpt-rester ("[…]"), kollapsa whitespace, klipp längden.
 */
export function cleanDescription(raw: unknown, maxLen = 500): string {
    return (raw ?? '')
        .toString()
        .replace(/<[^>]+>/g, ' ')
        .replace(/&[a-z]+;/gi, ' ')
        .replace(/\[…\]|\[\.\.\.\]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, maxLen);
}
