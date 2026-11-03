/**
 * eventShareSlug - KOPIA av packages/kontrakt/src/eventShareSlug.ts.
 *
 * Scrapern kör ts-node som CommonJS och kan inte läsa kontraktet (ESM-
 * källa, "type": "module"), på samma sätt som cityLookup.ts läser ortlistan
 * med regex i stället för att importera. Functions har samma kopia.
 * Algoritmen får ALDRIG ändras (gamla /e/-länkar slutar fungera);
 * eventShareSlug.test.ts låser den mot kontraktets guldvärden.
 */
function fnv1a(s: string, seed: number): number {
    let h = seed >>> 0;
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}

export function eventShareSlug(id: string): string {
    const a = fnv1a(id, 2166136261);
    const b = fnv1a(id, 0x7ee3623b);
    return a.toString(16).padStart(8, '0') + b.toString(16).padStart(8, '0');
}
