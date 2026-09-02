/**
 * Opt-in-källorna (Svenska kyrkan, PRO, Korpen) på STADSSIDORNA (Josef 2/9:
 * "aa vi kan väl ha de också" → "en Mer-knapp i slutet av kategorierna där
 * de tre dyker upp som alternativ man kan aktivera"). De ligger utanför
 * sidornas server-HTML, siffror och metadata (SEO-beslutet 1/9 står) — de
 * hämtas som en bakad JSON per stad först när någon källa slås på, och sys in
 * i daglistan i klienten, källa för källa. Rena funktioner här; fetch/kontext
 * bor i CategoryChips (Mer-raden) och DayFilteredList.
 */

import { SOURCE_DEFS } from './sources';
import { SPECIAL_DEFAULT_KEYS } from './categoryDefaults';

export const CITY_OPT_IN_STORAGE_KEY = 'vadkul_stadssida_optin';

/** Sökvägen till stadens bakade opt-in-lista (route handler, force-static). */
export const cityOptInJsonHref = (citySlug: string) => `/evenemang/${citySlug}/opt-in.json`;

const KNOWN = new Set(SOURCE_DEFS.map(s => s.key));

/** Sparat val → källnycklar (bara kända, sorterade). null = inget sparat val
 *  (saknas eller trasigt) — då gäller standardregeln. */
export function parseStoredSources(stored: string | null | undefined): string[] | null {
    if (!stored) return null;
    try {
        const v = JSON.parse(stored);
        if (!Array.isArray(v)) return null;
        return [...new Set(v.filter((k): k is string => typeof k === 'string' && KNOWN.has(k)))].sort();
    } catch {
        return null;
    }
}

/**
 * Standardläget: användarens eget val (localStorage, JSON-lista med nycklar)
 * vinner alltid — även ett tomt val. Annars SAMMA regel som kartan
 * (utils/categoryDefaults): inloggad 65+ får kyrkan + PRO förvalda, alla
 * andra inklusive utloggade får inget.
 */
export function cityOptInDefault(stored: string | null | undefined, loggedIn: boolean, age: unknown): string[] {
    const own = parseStoredSources(stored);
    if (own) return own;
    if (loggedIn && typeof age === 'number' && Number.isFinite(age) && age >= 65) {
        return [...SPECIAL_DEFAULT_KEYS].sort();
    }
    return [];
}

// Minsta gemensamma nämnare av DayFilteredList:s ListedDay/ListedEvent som
// sammanslagningen behöver — typerna importeras inte (klientmodul med
// 'use client'), och funktionerna ska kunna testas utan React.
export type MergeRow = { coverImage?: string; t: number; hour: number | null; source?: string; dups?: MergeRow[] };
export type MergeDay<R extends MergeRow> = { key: string; label: string; short: string; hourCounts: number[]; events: R[] };

/**
 * Behåll bara raderna från de VALDA källorna (rad-nivå: en grupprad följer
 * sin representant). Dagar utan kvarvarande rader faller bort och
 * timstaplarna räknas om ur de kvarvarande raderna — de bakade hourCounts
 * täcker alla tre källorna. Tom källista → tom lista.
 */
export function filterDaysBySource<R extends MergeRow, D extends MergeDay<R>>(days: D[], sources: readonly string[]): D[] {
    if (sources.length === 0) return [];
    const want = new Set(sources);
    const out: D[] = [];
    for (const d of days) {
        const events = d.events.filter(r => !!r.source && want.has(r.source));
        if (events.length === 0) continue;
        const hourCounts = Array(24).fill(0) as number[];
        for (const r of events) {
            for (const x of [r, ...(r.dups ?? [])]) if (x.hour !== null) hourCounts[x.hour]++;
        }
        out.push({ ...d, events, hourCounts });
    }
    return out;
}

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
