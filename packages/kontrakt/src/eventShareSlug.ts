/**
 * Kort, stabil delnings-slug för ett event: /e/<slug> i stället för att stoppa
 * hela käll-URL:en (eventets id) i query-strängen. Slugs beräknas likadant på
 * klienten (dela-knappen) och servern (/e/[slug]-uppslaget) — ändra ALDRIG
 * algoritmen utan att inse att gamla delade länkar då slutar fungera.
 *
 * Två FNV-1a-hashar med olika seed → 64 bitar → 16 hex-tecken. Kollisionsrisk
 * bland ~20k event är försumbar (~1 på 10^11).
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
