/**
 * KOPIA av apps/web/src/utils/eventShareSlug.ts — måste räkna EXAKT likadant,
 * annars pekar notisernas /e/<slug>-länkar fel. Ändra ALDRIG algoritmen
 * (gamla delade länkar slutar då fungera); ändras web-versionen måste denna
 * följa med.
 *
 * Två FNV-1a-hashar med olika seed → 64 bitar → 16 hex-tecken.
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
