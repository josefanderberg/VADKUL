/**
 * Osynliga tecken som följer med när man kopierar en länk: riktningsmarkörer
 * (LRM/RLM, bidi-inbäddningar och -isoleringar), nollbreddstecken, BOM och
 * mjukt bindestreck. Facebook och mobilernas dela-menyer lägger gärna på
 * " \u200E" (mellanslag + LRM) efter länken. `trim()` rör dem inte, och
 * `new URL()` kodar dem snällt till "%20%E2%80%8E" i sökvägen - så
 * ANMÄL-knappen ledde till en 404 (Växjö Citys halloween-tips 29/9).
 * Teckenklassen nedan skrivs med \u-koder: bokstavliga osynliga tecken i
 * källkoden kan tyst försvinna i en editor.
 */
const INVISIBLE_CHARS = /[\u00AD\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF]/g;

/**
 * Samma skräp i redan kodad form sist i en URL: mellanslag, NBSP och tecknen
 * ovan. Fångar länkar som sparades innan rensningen fanns, så att en
 * redigering av ett gammalt tips lagar länken av sig själv.
 */
const TRAILING_ENCODED_JUNK = /(?:%20|%C2%A0|%C2%AD|%E2%80%8[B-F]|%E2%80%A[A-E]|%E2%81%A[0-46-9]|%EF%BB%BF)+$/i;

/**
 * Normalisera tips-länken: osynliga tecken bort, protokoll saknas → https://
 * läggs på, sedan måste det bli en riktig http(s)-URL med punkt i domänen
 * ("aftonbladet" räcker inte, "javascript:…" stoppas). null = ogiltig →
 * Skapa-knappen hålls inaktiv.
 */
export function normalizeTipUrl(raw: string): string | null {
    const trimmed = raw.replace(INVISIBLE_CHARS, '').trim();
    if (!trimmed) return null;
    const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    try {
        const u = new URL(withProto);
        if ((u.protocol !== 'http:' && u.protocol !== 'https:') || !u.hostname.includes('.')) return null;
        return u.toString().replace(TRAILING_ENCODED_JUNK, '');
    } catch { return null; }
}
