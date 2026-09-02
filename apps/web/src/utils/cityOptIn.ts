/**
 * Opt-in-källorna (Svenska kyrkan, PRO, Korpen) på STADSSIDORNA (Josef 2/9:
 * "aa vi kan väl ha de också"). De ligger utanför sidornas server-HTML,
 * siffror och metadata (SEO-beslutet 1/9 står) — de hämtas som en bakad JSON
 * per stad först när växeln slås på, och sys in i daglistan i klienten.
 * Rena funktioner här; fetch/kontext bor i OptInToggle/DayFilteredList.
 */

export const CITY_OPT_IN_STORAGE_KEY = 'vadkul_stadssida_optin';

/** Sökvägen till stadens bakade opt-in-lista (route handler, force-static). */
export const cityOptInJsonHref = (citySlug: string) => `/evenemang/${citySlug}/opt-in.json`;

/**
 * Standardläget: användarens eget val (localStorage '1'/'0') vinner alltid;
 * annars SAMMA regel som kartan (utils/categoryDefaults) — på bara för
 * inloggade 65+, av för alla andra inklusive utloggade.
 */
export function cityOptInDefault(stored: string | null | undefined, loggedIn: boolean, age: unknown): boolean {
    if (stored === '1') return true;
    if (stored === '0') return false;
    return loggedIn && typeof age === 'number' && Number.isFinite(age) && age >= 65;
}

// Minsta gemensamma nämnare av DayFilteredList:s ListedDay/ListedEvent som
// sammanslagningen behöver — typerna importeras inte (klientmodul med
// 'use client'), och funktionen ska kunna testas utan React.
export type MergeRow = { coverImage?: string; t: number; hour: number | null; dups?: MergeRow[] };
export type MergeDay<R extends MergeRow> = { key: string; label: string; short: string; hourCounts: number[]; events: R[] };

/**
 * Sy in opt-in-dagarna i serverns daglista: samma dag → raderna slås ihop
 * och sorteras om enligt serverns regel (bildsatta rader först, tidsordning
 * inom varje grupp) och timstaplarna summeras; dagar som bara finns i
 * opt-in-listan läggs till. Resultatet är sorterat på dagnyckel
 * ('YYYY-MM-DD'). Utan extra dagar returneras serverns lista orörd (samma
 * referens — inga onödiga omrenderingar).
 */
export function mergeListedDays<R extends MergeRow, D extends MergeDay<R>>(base: D[], extra: D[] | null | undefined): D[] {
    if (!extra || extra.length === 0) return base;
    const byKey = new Map<string, D>();
    for (const d of base) byKey.set(d.key, d);
    for (const x of extra) {
        const cur = byKey.get(x.key);
        if (!cur) {
            byKey.set(x.key, x);
            continue;
        }
        const rows = [...cur.events, ...x.events];
        const byTime = (a: R, b: R) => a.t - b.t;
        const merged = [
            ...rows.filter(r => !!r.coverImage).sort(byTime),
            ...rows.filter(r => !r.coverImage).sort(byTime),
        ];
        const hourCounts = Array.from({ length: 24 }, (_, h) => (cur.hourCounts[h] ?? 0) + (x.hourCounts[h] ?? 0));
        byKey.set(x.key, { ...cur, events: merged, hourCounts });
    }
    return [...byKey.values()].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}
