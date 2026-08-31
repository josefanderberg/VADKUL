/**
 * Publik länk = rå URL städad från FRÄMMANDE affiliate-spårning och wrappad
 * i VÅR. Ticketmaster-skrapern klistrade 31 maj–28 jul ?c=8469859&ac=1 på
 * länkarna — koden är inte vår (Impact-publisher 7528311) och att servera
 * den är precis vad TM/Impact-compliance underkänner vid programansökan.
 * URL:en i DB rörs inte (primärnyckel + share-slug-bas); både städningen
 * och spårningen sker här i utkanten, vid aggregeringen.
 *
 * Sedan Impact-godkännandet 2026-08-27 wrappas ticketmaster-länkar i vår
 * Impact-redirect — per marknad (se/dk/no), se OUR_IMPACT_REDIRECTS nedan.
 */
const FOREIGN_AFFILIATE_PARAMS: Record<string, string[]> = {
    'ticketmaster.': ['c', 'ac'],
    'universe.com': ['c', 'ac', 'ref'],
};
/** Impact Radius-/affiliate-redirectdomäner: länken bär destinationen i ?u= */
const AFFILIATE_REDIRECT_HOST = /\.(evyy\.net|sjv\.io|pxf\.io|7eer\.net|ojrq\.net|i\d+\.net|prf\.hn|go2cloud\.org)$/i;
/**
 * Våra spårningslänkar per TM-marknad (publisher 7528311). Impact kör EN
 * kampanj per land — SE-mallen svarar 404 för .dk/.no-destinationer, så
 * varje marknad MÅSTE wrappas med sin egen (alla tre hämtade ur Impacts
 * länkverktyg + skarptestade 31/8). Ägarbeslut 31/8: se+dk+no — fler
 * marknader kräver sin egen mall här, wrappa ALDRIG med fel lands länk.
 */
const OUR_IMPACT_REDIRECTS: Record<string, string> = {
    se: 'https://ticketmaster.evyy.net/c/7528311/2038747/23885',
    dk: 'https://ticketmaster.evyy.net/c/7528311/1958964/23893',
    no: 'https://ticketmaster.evyy.net/c/7528311/1958977/23900',
};
const WRAPPABLE_HOST = /(^|\.)ticketmaster\.(se|dk|no)$/i;

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
        const market = u.hostname.match(WRAPPABLE_HOST)?.[2]?.toLowerCase();
        if (market && OUR_IMPACT_REDIRECTS[market]) {
            const wrapped = new URL(OUR_IMPACT_REDIRECTS[market]);
            wrapped.searchParams.set('u', u.toString().replace(/\?$/, ''));
            wrapped.searchParams.set('utm_medium', 'affiliate');
            return wrapped.toString();
        }
        return u.toString().replace(/\?$/, '');
    } catch { return raw; }
}
