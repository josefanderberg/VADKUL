/**
 * priceRefineTargets.ts — vilka event price-refine ska hämta detaljsidan för,
 * och vilka träffar som inte går att lita på. Ren modul (ingen I/O), så
 * urvalet går att testa utan SQLite/Firebase.
 */

/**
 * Värdar där detaljsidans HTML aldrig bär eventets pris — att hämta dem är
 * bara last på källan:
 *   - svenskakyrkan.se, zoezi.se (Korpen): JS-appar, HTML:en är ett tomt skal
 *   - facebook/instagram: inloggningsvägg
 *   - tickster.com: priset finns bara i biljettbutiken (secure.tickster.com),
 *     som robots.txt stänger för robotar. Kräver Ticksters Event API.
 *   - ticketmaster.*: priset laddas av skript
 *   - swehockey, hockeyallsvenskan, everysport: matchsidor utan biljettpris
 */
const SKIP_HOST_RE = /(?:^|\.)(?:svenskakyrkan\.se|zoezi\.se|facebook\.com|fb\.me|instagram\.com|tickster\.com|ticketmaster\.[a-z.]+|swehockey\.se|hockeyallsvenskan\.se|everysport\.com)$/i;

/** Fragment som är en SPA-rutt (bibliotekens "/evenemang#<uuid>", "#/events/…") — sidan bakom är ett skal. */
const SPA_FRAGMENT_RE = /^#(?:\/|!|[0-9a-f]{8}-[0-9a-f]{4}-)/i;

/**
 * Listing-motorns fragment ("…/evenemang/#2026-11-21-quiz-med-kalle"): sidan
 * bakom är ett helt program med MÅNGA event, så ett pris på den hör till ett
 * av dem — inte nödvändigtvis det här. Motorn läser själv priset ur eventets
 * eget kort. Riksteaterns "#2026-11-29" (bara datum) är en egen detaljsida
 * och hämtas som förut.
 */
const LISTING_FRAGMENT_RE = /^#\d{4}-\d{2}-\d{2}-[a-z0-9]/;

/** Värden utan "www." — nyckeln som grupperar och takbegränsar hämtningarna. */
export function refineHost(url: string): string | null {
    try { return new URL(url).hostname.replace(/^www\./i, '').toLowerCase(); } catch { return null; }
}

/**
 * Adressen att hämta för ett events pris, eller null när sidan inte kan bära
 * det. Fragmentet tas bort: flera speldatum på samma produktionssida
 * (Riksteaterns "#2026-11-29") delar då EN hämtning.
 */
export function priceRefineFetchUrl(url: string): string | null {
    let u: URL;
    try { u = new URL(url); } catch { return null; }
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    if (SKIP_HOST_RE.test(u.hostname)) return null;
    if (SPA_FRAGMENT_RE.test(u.hash) || LISTING_FRAGMENT_RE.test(u.hash)) return null;
    u.hash = '';
    return u.toString();
}

/** Titeln utan datum, klockslag och siffror — "Escape room 15/11" och "Escape room 16/11" är samma event. */
function titleKey(title: string): string {
    return title.toLowerCase().replace(/[\d/.:–-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Sidmallens pris, inte eventets: samma BELOPP på många OLIKA event hos en
 * värd betyder att träffen kommer ur en ruta som står på varje sida (museets
 * entré, medlemsavgiften). Räknas per titel: ett återkommande event med en
 * sida per datum (Trosas escape room, 250–360 kr på sex datum) har samma pris
 * på alla sina sidor och är inget tecken på en mall. Gratis undantas — en
 * biblioteks- eller kommunsajt där allt är gratis är det väntade. Returnerar
 * beloppet som ska hållas tillbaka, annars null.
 */
export function templatePrice(pages: Array<{ price: string; title: string }>, minTitles = 8): string | null {
    const titlesByPrice = new Map<string, Set<string>>();
    const allTitles = new Set<string>();
    for (const p of pages) {
        if (p.price === 'Gratis') continue;
        const key = titleKey(p.title);
        allTitles.add(key);
        titlesByPrice.set(p.price, (titlesByPrice.get(p.price) ?? new Set<string>()).add(key));
    }
    if (allTitles.size < minTitles) return null;
    const [top, titles] = [...titlesByPrice.entries()].sort((a, b) => b[1].size - a[1].size)[0];
    return titles.size / allTitles.size >= 0.9 ? top : null;
}

/** Varva värdarna: en rad per värd och varv, så en stor källa inte äter hela budgeten. */
export function roundRobin<T>(groups: T[][], limit: number): T[] {
    const out: T[] = [];
    for (let i = 0; out.length < limit; i++) {
        let any = false;
        for (const g of groups) {
            if (i < g.length) {
                any = true;
                out.push(g[i]);
                if (out.length >= limit) break;
            }
        }
        if (!any) break;
    }
    return out;
}
