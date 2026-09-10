/**
 * popularEvent.ts — klassar event som 🔥 Populära (stora arrangemang som drar
 * folk: konserter, föreställningar, festivaler, matcher med publikvärde) till
 * skillnad från vardagsutbudet (sagostunder, studiecirklar, hembygdsträffar).
 *
 * Körs vid aggregate-steget och bakas som valfritt `pop: true` i lagren —
 * kartans 🔥-filter och stadssidornas Populära-chip läser samma facit.
 * Ingen recency-decay med flit: flaggan ska vara en egenskap hos EVENTET,
 * inte hos när aggregatet råkade köras, annars flippar den mellan nätter.
 *
 * Signalerna är en sammanslagning av två beprövade poängmodeller:
 * dragScore (stadsinläggens urval, cityPostText.ts) och stadssidornas
 * scoreEvent (apps/web .../evenemang/cityData.ts). Vikterna kalibreras mot
 * verkligt data med scripts/analyze-popular.ts — kör om analysen, tyck aldrig.
 *
 * Ren logik utan I/O — testas i popularEvent.test.ts.
 */

import { isOptInSource, isNoiseEvent, rankCategory, ticketBoost } from './cityPostText';
import { isTrustedTicketSource, isAffiliateLink } from './ticketSources';

export interface PopularInput {
    url: string;
    title: string;
    time: string;          // ISO
    category: string;
    hasSpecificTime: boolean;
    coverImage?: string | null;
    price?: string | null;
    attendees?: number | null;
}

/** Spegel av `normTitle` i apps/web .../evenemang/cityData.ts — ändras den
 *  ena måste den andra med, annars betyder repeatCount olika saker i
 *  klassningen och på stadssidorna. */
export const normTitlePop = (t: string): string =>
    t.toLowerCase().replace(/[^a-z0-9åäö]+/g, ' ').trim();

/** Global titelfrekvens över aggregatets radmängd — rutindetektorn.
 *  "Sommarcafé" ×400 = verksamhet; engångstitel = riktig händelse. */
export function buildTitleFreq(rows: { title: string | null }[]): Map<string, number> {
    const freq = new Map<string, number>();
    for (const r of rows) {
        const key = normTitlePop(r.title || '');
        if (!key) continue;
        freq.set(key, (freq.get(key) ?? 0) + 1);
    }
    return freq;
}

/** Spegel av SPECIAL_WORDS/ROUTINE_WORDS i apps/web .../evenemang/cityData.ts
 *  — ändras den ena måste den andra med. Matchas mot normTitlePop-titeln. */
const SPECIAL_WORDS = /festival|premiär|vernissage|invigning|turné|mässa|stand.?up|konsert|final|release|cirkus|opera|musikal|nationaldag|midsommar|utställning|föreställning/;
const ROUTINE_WORDS = /gudstjänst|morgonbön|middagsbön|aftonbön|vägkyrka|sommarkyrka|öppen kyrka|sommarcafé|drop.?in|öppen förskola|språkcafé|stickcafé|promenadgrupp|bokcirkel/;

/**
 * Domäner vars utbud per definition är småskaligt (bibliotek, hembygd,
 * studieförbund, folkrörelser) — vetas oavsett poäng. OBS `sv.se`
 * (Studieförbundet Vuxenskolan) MÅSTE matchas som exakt host/suffix:
 * substrängen "sv" träffar svenskakyrkan.se och halva svenska webben.
 */
const SMALL_VENUE_SUFFIXES = ['hembygd.se', 'abf.se', 'bilda.nu', 'sv.se'];
const SMALL_VENUE_SUBSTRINGS = [
    'bibliotek', 'medborgarskolan', 'friluftsframjandet',
    'rotary', 'rodakorset', 'naturskyddsforeningen',
];

export function isSmallVenueHost(url: string): boolean {
    let host: string;
    try { host = new URL(url).hostname.toLowerCase(); } catch { return false; }
    if (SMALL_VENUE_SUFFIXES.some(s => host === s || host.endsWith(`.${s}`))) return true;
    return SMALL_VENUE_SUBSTRINGS.some(s => host.includes(s));
}

/** Ribban — sätts från analyze-popular-utfallet, aldrig ur magkänsla.
 *  Kalibrerad 10/9 på 48k event: 30 → 16 % (lunchföreläsningar slank in),
 *  40 → 8,6 % (ägarens val), 45 → 5,5 % (tunt utanför storstan). */
export const POPULAR_THRESHOLD = 40;

export function popularScore(e: PopularInput, repeatCount: number): number {
    let s = 0;

    // Unikhet: engångstitel = händelse, mångfaldig titel = verksamhet.
    s += repeatCount <= 1 ? 12 : Math.round(-8 * Math.log2(repeatCount));

    // Biljettsläpp: någon tar betalt = arrangemang med publik. Ticketmaster/
    // affiliate tyngst (ägarens prioritet 1/9), övriga kuraterade system näst.
    if (/ticketmaster/i.test(e.url) || isAffiliateLink(e.url)) s += 14;
    else if (isTrustedTicketSource(e.url) || ticketBoost(e.url) > 0) s += 10;

    // Kategori: musik/scen/marknad bär, kurser drar ned (dragScore-skalan).
    s += (rankCategory(e.category) - 2) * 4;

    const nt = normTitlePop(e.title);
    if (SPECIAL_WORDS.test(nt)) s += 8;

    if (e.coverImage) s += 8;              // arrangören har lagt jobb på eventet
    if (e.price) s += 6;                   // biljettbelagt = arrangemang
    if ((e.attendees ?? 0) > 0) s += 6;    // FB-going — fylls sällan men säkert

    const d = new Date(e.time);
    if (e.hasSpecificTime) {
        s += 2;
        const h = d.getHours();
        if (h >= 17 && h <= 22) s += 4;    // kvällstid = när man går ut
    }
    const day = d.getDay();
    if (day === 0 || day === 5 || day === 6) s += 3;   // fre/lör/sön

    return s;
}

/** Hårt veto — aldrig populär oavsett poäng. */
export function isVetoed(e: PopularInput): boolean {
    return isOptInSource(e.url)                        // kyrkan/PRO/Korpen är opt-in-dolda överallt
        || isNoiseEvent(e)                             // seriematcher, körrep, kyrkrutiner
        || ROUTINE_WORDS.test(normTitlePop(e.title))
        || isSmallVenueHost(e.url);
}

/** Hårda veton först, sedan poängribban. */
export function isPopularEvent(e: PopularInput, repeatCount: number): boolean {
    return !isVetoed(e) && popularScore(e, repeatCount) >= POPULAR_THRESHOLD;
}
