/**
 * snowballSmoke.ts — rimlighetskontrollen av en ny källas event (webb-snöbollens
 * steg 3). Ren modul, så reglerna går att testa utan att snöbollen körs.
 *
 * Kontrollen är svaret på "titlar kan vara vad som helst på en okänd sida":
 * antal, titelkvalitet, Sverige-signal och datumspridning måste se ut som en
 * riktig kalender innan källan går live.
 *
 * ÅTERKOMMANDE EVENT ÄR INGA DUBBLETTER (14/11 2026). Regeln "minst hälften
 * av titlarna unika" fällde just de ställen vi saknar mot Happymap:
 * Slottsstallarna i Växjö (Pub-Torsdag och Disco-Fredag varje vecka, 3 unika
 * titlar av 8) och PM & Vänner (5 av 11). En krog eller restaurang HAR samma
 * kväll varje vecka. Skräpet regeln var byggd mot ser annorlunda ut: samma
 * titel på ALLA sidor (sajtens namn), eller samma titel flera gånger samma
 * dag. Därför räknas nu (titel, dag)-par: samma titel på olika dagar är en
 * serie, samma titel samma dag är en upprepning.
 */

import { RawEvent } from '../sources/types';

export const SMOKE_MIN_EVENTS = 3;

export interface SmokeVerdict { ok: boolean; reasons: string[]; events: number; sampleTitles: string[]; allTitles: string[] }

const dayOf = (d: Date): string => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

export function judgeEvents(raw: RawEvent[], windowStart: Date, windowEnd: Date, domain: string): SmokeVerdict {
    const reasons: string[] = [];
    const future = raw.filter((e) => e.startDate instanceof Date && !isNaN(+e.startDate)
        && e.startDate >= windowStart && e.startDate < windowEnd);

    if (future.length < SMOKE_MIN_EVENTS) {
        return { ok: false, reasons: [`bara ${future.length} framtida event (kräver ≥${SMOKE_MIN_EVENTS})`], events: future.length, sampleTitles: [], allTitles: [] };
    }
    const titles = future.map((e) => (e.title ?? '').trim());

    const okLen = titles.filter((t) => t.length >= 3 && t.length <= 120).length;
    if (okLen / titles.length < 0.8) reasons.push(`titellängder orimliga (${okLen}/${titles.length} inom 3–120 tecken)`);

    const hasLetters = titles.filter((t) => /\p{L}{2}/u.test(t)).length;
    if (hasLetters / titles.length < 0.9) reasons.push('titlar utan bokstäver');

    // Upprepning: en enda titel på allt (sajtens namn), eller samma titel
    // flera gånger samma dag. Samma titel på olika dagar är en serie.
    const distinct = new Set(titles.map((t) => t.toLowerCase())).size;
    const pairs = new Set(future.map((e) => `${(e.title ?? '').trim().toLowerCase()}|${dayOf(e.startDate)}`)).size;
    if (distinct < 2) reasons.push(`alla ${titles.length} event har samma titel`);
    else if (pairs / titles.length < 0.8) reasons.push(`titlar repeteras samma dag (${pairs} unika titel+dag av ${titles.length})`);

    const JUNK = /cookie|integritetspolicy|personuppgift|logga in|meny|sök|404|not found|error|javascript|until\b|read more|läs mer$/i;
    const junky = titles.filter((t) => JUNK.test(t)).length;
    if (junky / titles.length > 0.2) reasons.push(`junk-ord i ${junky} titlar (navigation/cookies?)`);

    // Sverige-signal: .se/.nu-domän räcker; annars kräv svenska tecken/ord i innehållet
    const swedishDomain = /\.(se|nu)$/.test(domain);
    if (!swedishDomain) {
        const sv = future.filter((e) =>
            /[åäöÅÄÖ]/.test(`${e.title} ${e.city ?? ''} ${e.address ?? ''} ${e.description ?? ''}`)).length;
        if (sv / future.length < 0.3) reasons.push('ingen Sverige-signal (utländsk domän + inga svenska tecken)');
    }

    // Datumspridning: allt på exakt samma timestamp ⇒ trolig parse-artefakt
    const stamps = new Set(future.map((e) => +e.startDate));
    if (stamps.size === 1 && future.length >= 5) reasons.push('alla event på samma timestamp (datumparse trasig?)');

    return { ok: reasons.length === 0, reasons, events: future.length, sampleTitles: titles.slice(0, 3), allTitles: titles };
}
