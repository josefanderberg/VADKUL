/**
 * ortMatch.ts — matcha ett ortnamn (--orter-flaggan) mot kandidater.
 *
 * Exakt träff vinner alltid över substring: `--orter=Mora` gav tidigare
 * Hedemora (dry-run 2026-08-23) eftersom includes-matchningen tog första
 * bästa. Substring-fallbacken finns kvar för partiella namn — men bara när
 * ingen kandidat matchar exakt.
 */

/** Kandidater vars nycklar matchar `query` — exakta träffar om sådana finns,
 *  annars substring-träffar. Skiftlägesokänsligt. Tom array = ingen träff. */
export function matchOrt<T>(candidates: T[], query: string, keysOf: (c: T) => string[]): T[] {
    const q = query.toLowerCase();
    const exact = candidates.filter(c => keysOf(c).some(k => k.toLowerCase() === q));
    if (exact.length > 0) return exact;
    return candidates.filter(c => keysOf(c).some(k => k.toLowerCase().includes(q)));
}
