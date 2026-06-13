/**
 * friluftsframjandet — Engine för hela Friluftsfrämjandets äventyrssök (~300
 * lokalavdelningar, ETT nationellt sök).
 *
 * Sajten (EPiServer + React-öar) exponerar söket som JSON-POST bakom ASP.NET
 * anti-forgery — vi bootar en session från söksidan (cookie + token ur hidden
 * input) och paginerar sedan:
 *
 *   GET  /lat-aventyret-borja/hitta-aventyr/        → cookies + __RequestVerificationToken
 *   POST /Search/AdventureSearch/Search             → { totalMatches, pages, items[40] }
 *        body: {page, query, filterBy, sortBy, layout, __RequestVerificationToken}
 *        headers: content-type: application/json, x-requested-with, token-headern,
 *                 cookie — ALLA krävs, annars 400/redirect.
 *
 * Sök-itemen har koordinater (RÄTT fältordning, till skillnad från deras
 * departments-API där lat/lng är förväxlade), arrangör (lokalavdelning),
 * gren (Vandring/Kajak/…), pris och bild — men datum bara som "11 jun".
 * Exakt start/slut hämtas från detaljsidans "Anmälan, tid & plats"-lista
 * ("torsdag, 11 jun 2026 (kl 09:30)") — parenteser strippas och strängen går
 * genom parseSwedishDate. Kända URL:er hoppas över före detaljhämtning
 * (ctx.isKnownUrl) så nattkörningar bara rör nya äventyr.
 *
 * Ledarutbildningar (forLeaders) och redan avslutade hoppas över.
 *
 * Körs via registryt: `npm run sources -- --ids=friluftsframjandet [--dry-run]`
 */

import { Engine, RawEvent } from '../sources/types';
import { mapPool } from '../utils/mapPool';
import { parseSwedishDate } from '../utils/swedishDate';

const SITE = 'https://www.friluftsframjandet.se';
const BOOT_PATH = '/lat-aventyret-borja/hitta-aventyr/';
const SEARCH_PATH = '/Search/AdventureSearch/Search';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const TOKEN_FIELD = '__RequestVerificationToken';
const PAGE_DELAY_MS = 300;
const SAFETY_PAGE_CAP = 60;     // 60×40 = 2400 äventyr — långt över dagens ~535
const CONCURRENCY = 4;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface FfSession { cookie: string; token: string; }

/** Boota anti-forgery-sessionen: cookies ur Set-Cookie + token ur hidden input. */
async function bootSession(log: (msg: string) => void): Promise<FfSession | null> {
    try {
        const r = await fetch(`${SITE}${BOOT_PATH}`, {
            headers: { 'user-agent': UA },
            signal: AbortSignal.timeout(25_000),
        });
        if (!r.ok) { log(`boot HTTP ${r.status}`); return null; }
        const cookie = r.headers
            .getSetCookie()
            .map((c) => c.split(';')[0])
            .join('; ');
        const html = await r.text();
        const m = html.match(new RegExp(`name="${TOKEN_FIELD}"[^>]*value="([^"]+)"`));
        if (!m || !cookie) { log('boot: token/cookie saknas i svaret'); return null; }
        return { cookie, token: m[1] };
    } catch (err) {
        log(`boot-fel: ${(err as Error).message}`);
        return null;
    }
}

async function searchPage(session: FfSession, page: number, log: (msg: string) => void): Promise<any | null> {
    try {
        const r = await fetch(`${SITE}${SEARCH_PATH}`, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'x-requested-with': 'XMLHttpRequest',
                [TOKEN_FIELD]: session.token,
                cookie: session.cookie,
                'user-agent': UA,
                origin: SITE,
                referer: `${SITE}${BOOT_PATH}`,
            },
            body: JSON.stringify({
                page, query: '', filterBy: '', sortBy: '', layout: 'List',
                [TOKEN_FIELD]: session.token,
            }),
            signal: AbortSignal.timeout(25_000),
        });
        if (!r.ok) { log(`sök sida ${page}: HTTP ${r.status}`); return null; }
        return await r.json();
    } catch (err) {
        log(`sök-fel sida ${page}: ${(err as Error).message}`);
        return null;
    }
}

/**
 * Plocka "Start"/"Slut" ur detaljsidans HTML. Formatet är
 * "torsdag, 11 jun 2026 (kl 09:30)" — parenteserna döljer klockslaget för
 * parseSwedishDate, så de strippas först. Exporterad för test.
 */
export function parseDetailTimes(html: string): { start: Date | null; end: Date | null } {
    const grab = (label: string): Date | null => {
        const m =
            html.match(new RegExp(`<b>${label}:</b>([^<]+)<`)) ||
            html.match(new RegExp(`PropertyList-key">${label}</div>\\s*<div class="PropertyList-value">([^<]+)<`));
        if (!m) return null;
        return parseSwedishDate(m[1].replace(/[()]/g, ' ').trim());
    };
    return { start: grab('Start'), end: grab('Slut') };
}

/** Meta-beskrivningen är detaljsidans enda rena sammanfattning. */
export function parseDescription(html: string): string | undefined {
    const m = html.match(/property="og:description" content="([^"]*)"/);
    if (!m) return undefined;
    const text = m[1]
        .replace(/&#(\d+);/g, (_, c) => String.fromCharCode(parseInt(c, 10)))
        .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&[a-z]+;/g, ' ')
        .replace(/\s+/g, ' ').trim();
    return text || undefined;
}

/**
 * Interna arrangemang som slinker förbi forLeaders-flaggan: ledar-/instruktörs-
 * utbildningar och organisationsträffar. Publika kurser ("Kajakkurs nybörjare")
 * berörs INTE — bara ledar-/instruktörs-prefixade och lokalavdelnings-träffar.
 */
const INTERNAL_TITLE = /ledarutbildning|instruktörsutbildning|ledarintroduktion|träff för lokalavdelningar|intresseanmälan|för ledare\b/i;

/**
 * Sök-item + detalj-tider → RawEvent. null = hoppa över (ledarutbildning,
 * internt, avslutat eller inget startdatum). Exporterad för test.
 */
export function mapFfItem(item: any, detail: { start: Date | null; end: Date | null }, description?: string): RawEvent | null {
    if (!item?.link || !item.title) return null;
    if (item.forLeaders || item.hasEnded) return null;
    if (INTERNAL_TITLE.test(item.title)) return null;
    if (!detail.start) return null;

    const lat = parseFloat(item.latitude);
    const lng = parseFloat(item.longitude);
    const organizer = (item.organizer || '').toString().trim();
    const branch = (item.branch || item.adventureArea || '').toString().trim();

    return {
        title: item.title.toString().trim(),
        url: `${SITE}${item.link}`,
        startDate: detail.start,
        endDate: detail.end ?? undefined,
        coords: lat && lng ? [lat, lng] : undefined,
        venueName: organizer ? `Friluftsfrämjandet ${organizer}` : 'Friluftsfrämjandet',
        hostName: organizer ? `Friluftsfrämjandet ${organizer}` : 'Friluftsfrämjandet',
        imageUrl: item.image?.imageLink ? `${SITE}${item.image.imageLink}` : undefined,
        price: item.price ? String(item.price) : undefined,
        description: [branch && `${branch}.`, description].filter(Boolean).join(' ') || undefined,
    };
}

export const friluftsframjandetEngine: Engine = async (_config, ctx) => {
    const session = await bootSession(ctx.log);
    if (!session) return [];

    // 1. Paginera ihop alla sök-items (dedup på link — flersessionsäventyr kan repeteras)
    const byLink = new Map<string, any>();
    let pages = 1;
    for (let page = 1; page <= Math.min(pages, SAFETY_PAGE_CAP); page++) {
        const data = await searchPage(session, page, ctx.log);
        if (!data || !Array.isArray(data.items)) break;
        pages = Number(data.pages) || pages;
        for (const it of data.items) if (it?.link) byLink.set(it.link, it);
        if (page === 1) ctx.log(`${data.totalMatches} äventyr i söket (${pages} sidor)`);
        if (page < pages) await sleep(PAGE_DELAY_MS);
    }
    const items = [...byLink.values()];

    // 2. Detaljhämta exakta tider för nya äventyr (kända URL:er hoppas över)
    let skippedKnown = 0;
    const mapped = await mapPool(items, CONCURRENCY, async (item): Promise<RawEvent | null> => {
        const url = `${SITE}${item.link}`;
        if (!ctx.refreshKnown && ctx.isKnownUrl && (await ctx.isKnownUrl(url))) { skippedKnown++; return null; }
        if (item.forLeaders || item.hasEnded) return null;   // slipp detaljhämtningen helt
        try {
            const r = await fetch(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(25_000) });
            if (!r.ok) return null;
            const html = await r.text();
            return mapFfItem(item, parseDetailTimes(html), parseDescription(html));
        } catch {
            return null;
        }
    });

    const events = mapped.filter((e): e is RawEvent => e !== null);
    ctx.log(`${events.length} äventyr mappade (${skippedKnown} kända hoppade, ${items.length} i söket)`);
    return events;
};
