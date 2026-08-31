/**
 * Publik länk = rå URL städad från FRÄMMANDE affiliate-spårning och wrappad
 * i VÅR. Ticketmaster-skrapern klistrade 31 maj–28 jul ?c=8469859&ac=1 på
 * länkarna — koden är inte vår (Impact-publisher 7528311) och att servera
 * den är precis vad TM/Impact-compliance underkänner vid programansökan.
 * URL:en i DB rörs inte (primärnyckel + share-slug-bas); både städningen
 * och spårningen sker här i utkanten, vid aggregeringen.
 *
 * Sedan Impact-godkännandet 2026-08-27 wrappas ticketmaster.se-länkar i vår
 * Impact-redirect — samma form som Discovery-API:t själv returnerar för
 * vårt konto (verifierad mot API-svar 2026-09-01).
 */
const FOREIGN_AFFILIATE_PARAMS: Record<string, string[]> = {
    'ticketmaster.': ['c', 'ac'],
    'universe.com': ['c', 'ac', 'ref'],
};
/** Impact Radius-/affiliate-redirectdomäner: länken bär destinationen i ?u= */
const AFFILIATE_REDIRECT_HOST = /\.(evyy\.net|sjv\.io|pxf\.io|7eer\.net|ojrq\.net|i\d+\.net|prf\.hn|go2cloud\.org)$/i;
/** Vår spårningslänk: publisher 7528311, ad 2038747, program 23885. */
const OUR_IMPACT_REDIRECT = 'https://ticketmaster.evyy.net/c/7528311/2038747/23885';
/** Bara .se — ägarbeslut: djuplänka aldrig till andra TM-marknader. */
const WRAPPABLE_HOST = /(^|\.)ticketmaster\.se$/i;

export function publicUrl(raw: string): string {
    try {
        let u = new URL(raw);
        // Impact-redirect (vår eller någon annans): packa upp till den
        // riktiga sidan först, så resten av städningen ser destinationen.
        // Våra egna länkar blir idempotent samma kanoniska form igen nedan.
        if (AFFILIATE_REDIRECT_HOST.test(u.hostname)) {
            const inner = u.searchParams.get('u') || u.searchParams.get('url');
            if (inner && /^https?:\/\//.test(inner)) u = new URL(inner);
        }
        for (const [hostPart, params] of Object.entries(FOREIGN_AFFILIATE_PARAMS)) {
            if (!u.hostname.includes(hostPart)) continue;
            if (u.searchParams.get('c') !== '8469859' && !u.searchParams.has('ref')) continue;
            params.forEach((k) => u.searchParams.delete(k));
        }
        if (u.searchParams.get('utm_medium') === 'affiliate') u.searchParams.delete('utm_medium');
        if (WRAPPABLE_HOST.test(u.hostname)) {
            const wrapped = new URL(OUR_IMPACT_REDIRECT);
            wrapped.searchParams.set('u', u.toString().replace(/\?$/, ''));
            wrapped.searchParams.set('utm_medium', 'affiliate');
            return wrapped.toString();
        }
        return u.toString().replace(/\?$/, '');
    } catch { return raw; }
}
