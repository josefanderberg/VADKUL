// lib/outreach/hash.ts
//
// Textfingeravtryck för copy-paste-spärren: identisk (normaliserad) text i två
// grupper ska upptäckas INNAN den postas. Samma dubbel-FNV-1a-princip som
// eventShareSlug (utils/eventShareSlug.ts) men över normaliserad brödtext.

/** Normalisera innan hashning: gemener, whitespace-kollaps, inga URL:er
 *  (länken skiljer sig alltid per grupp och ska inte rädda en dubblett). */
export function normalizeBody(text: string): string {
    return text
        .toLowerCase()
        .replace(/https?:\/\/\S+/g, '')
        .replace(/[0-9]+/g, '#')      // "305 event" vs "58 grejer" är samma mall
        .replace(/\s+/g, ' ')
        .trim();
}

function fnv1a(str: string, seed: number): number {
    let h = seed >>> 0;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h >>> 0;
}

/** 16 hex tecken — stabilt fingeravtryck av normaliserad text. */
export function bodyHash(text: string): string {
    const norm = normalizeBody(text);
    const a = fnv1a(norm, 0x811c9dc5).toString(16).padStart(8, '0');
    const b = fnv1a(norm, 0x9747b28c).toString(16).padStart(8, '0');
    return a + b;
}

/** Trigram-Jaccard-likhet 0..1 — fångar "nästan samma text" (duplikatvarningen
 *  "87 % lik inlägget i Nyköping"). O(n) per text, gott och väl snabbt för
 *  jämförelse mot de ~20 senaste inläggen. */
export function trigramSimilarity(aText: string, bText: string): number {
    const grams = (t: string) => {
        const s = normalizeBody(t);
        const set = new Set<string>();
        for (let i = 0; i + 3 <= s.length; i++) set.add(s.slice(i, i + 3));
        return set;
    };
    const A = grams(aText), B = grams(bText);
    if (A.size === 0 || B.size === 0) return 0;
    let inter = 0;
    for (const g of A) if (B.has(g)) inter++;
    return inter / (A.size + B.size - inter);
}
