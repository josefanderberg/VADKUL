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
import { distanceKm } from './townBoundary';

export const SMOKE_MIN_EVENTS = 3;

/** Så långt bakåt räknas en programsidas passerade event som belägg för att sidan är ett program. */
export const LISTING_LOOKBACK_DAYS = 30;

/**
 * Probens generation. Höjs när proben lär sig läsa en ny sorts sajt — då är
 * ett gammalt FAIL inte längre facit, och domänen ska provas igen utan att
 * någon behöver tömma minnesfilen för hand.
 *   1 — Tribe, wp-v2, sitemap + JSON-LD, GoToHub, SiteVision
 *   2 — listsidor: katalog med detaljsidor, program på en enda sida (14/11 2026)
 */
export const PROBE_VERSION = 2;

/**
 * Ett PROGRAM PÅ EN ENDA SIDA (listing-motorn) läses bara för sajter som är
 * utpekade som ett ställe — kandidatfilens femte kolumn, som `npm run
 * venue-candidates` sätter ur OSM. Raden "21 nov · Nyköping, Träffen" betyder
 * olika saker på olika sajter: hos en krog är texten efter datumet akten och
 * platsen är krogen själv; hos ett turnerande band är texten PLATSEN och
 * akten är bandet. Torrkörningen mot gamla FAIL 15/11 2026 släppte igenom
 * haaks.se och pubkor.se (turnéplaner, titlar som "Kalmar - Krögers") och
 * larssonsresor.se (bussresor) — riktiga datum, men inga event på en plats.
 * Kataloger med detaljsidor berörs inte: där bär varje sida sin egen titel.
 */
export const NOT_A_VENUE_NOTE = 'program på en sida: inte ett utpekat ställe';

export function inlineListingAllowed(method: string | undefined, isVenue: boolean | undefined): boolean {
    return method !== 'listing-inline' || isVenue === true;
}

export interface ProbeMemory {
    verdict: 'PASS' | 'FAIL' | 'DUPE' | 'SMOKE-FAIL';
    date: string;
    note?: string;
    /** Generationen som gav verdiktet; saknas på poster från före 14/11 2026 (= 1). */
    probe?: number;
}

/**
 * Gäller minnet av en domän fortfarande, så att den hoppas över? En dubblett
 * är alltid en dubblett. Övriga verdikt gäller i `retryDays` dagar — utom
 * FAIL och SMOKE-FAIL från en äldre probe-generation, som aldrig fick chansen
 * mot dagens prob, och en sajt som fälldes för att den inte var utpekad som
 * ett ställe men nu kommer som ett (`asVenue`).
 */
export function remembersVerdict(entry: ProbeMemory | undefined, ageDays: number, retryDays: number, probeVersion = PROBE_VERSION, asVenue = false): boolean {
    if (!entry) return false;
    if (entry.verdict === 'DUPE') return true;
    if (ageDays >= retryDays) return false;
    // Fälld för att sajten inte var utpekad som ett ställe — nu är den det.
    if (asVenue && entry.note === NOT_A_VENUE_NOTE) return false;
    const failed = entry.verdict === 'FAIL' || entry.verdict === 'SMOKE-FAIL';
    return !(failed && (entry.probe ?? 1) < probeVersion);
}

export interface SmokeVerdict { ok: boolean; reasons: string[]; events: number; sampleTitles: string[]; allTitles: string[] }

/** Möten och lokalbokningar — en förenings egen planering, inte publika event. */
const INTERNAL_RE = /(?<![a-zåäö])(?:styrelsemöte|sektionsmöte|sektions?\s+möte|uppföljningsmöte|årsmöte|medlemsmöte|planeringsmöte|möte|stugbokning|lokalbokning|bokning|bokad|upptaget)(?![a-zåäö])/i;

const dayOf = (d: Date): string => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

export interface JudgeOptions {
    /**
     * Räkna även event så här många dagar BAKÅT. För programsidor (listing-
     * motorn): en liten krog har ofta bara ett eller två event kvar på sidan,
     * men de passerade står kvar ovanför och visar lika väl att sidan är ett
     * program. Kräver då minst ett event EFTER i dag — ett nyhetsarkiv, där
     * varje inlägg bär sitt publiceringsdatum, har aldrig ett datum i morgon.
     */
    lookbackDays?: number;
}

export function judgeEvents(raw: RawEvent[], windowStart: Date, windowEnd: Date, domain: string, opts: JudgeOptions = {}): SmokeVerdict {
    const reasons: string[] = [];
    const from = new Date(windowStart.getTime() - (opts.lookbackDays ?? 0) * 86_400_000);
    const future = raw.filter((e) => e.startDate instanceof Date && !isNaN(+e.startDate)
        && e.startDate >= from && e.startDate < windowEnd);
    const upcoming = future.filter((e) => e.startDate >= windowStart);

    if (future.length < SMOKE_MIN_EVENTS) {
        return { ok: false, reasons: [`bara ${future.length} ${opts.lookbackDays ? 'daterade' : 'framtida'} event (kräver ≥${SMOKE_MIN_EVENTS})`], events: upcoming.length, sampleTitles: [], allTitles: [] };
    }
    if (opts.lookbackDays) {
        const tomorrow = new Date(windowStart.getTime() + 86_400_000);
        if (!future.some((e) => e.startDate >= tomorrow)) {
            return { ok: false, reasons: [`inget kommande event (${future.length} daterade, alla i dag eller passerade)`], events: upcoming.length, sampleTitles: [], allTitles: [] };
        }
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

    // Föreningens interna kalender: möten och lokalbokningar, inga publika
    // event (Hestra IF 15/11: "Stugbokning: Konferensrummet", "OL-sektion möte").
    const internal = future.filter((e) => INTERNAL_RE.test(`${e.title ?? ''} ${e.venueName ?? ''}`)).length;
    if (internal / future.length >= 0.5) reasons.push(`internt kalendarium (${internal} av ${future.length} är möten eller bokningar)`);

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
    // Datumkluster: hälften eller mer på SAMMA DAG, med olika klockslag. Sajtens
    // eget datum (en banner, dagens datum) har vunnit över eventens. Droskan
    // 15/11: 187 av 187 på 21 november; Skissernas museum: 78 av 106 i dag.
    else if (future.length >= 8) {
        const perDay = new Map<string, number>();
        for (const e of future) perDay.set(dayOf(e.startDate), (perDay.get(dayOf(e.startDate)) ?? 0) + 1);
        const top = Math.max(...perDay.values());
        if (top / future.length >= 0.5) reasons.push(`datumkluster (${top} av ${future.length} event samma dag)`);
    }

    return { ok: reasons.length === 0, reasons, events: upcoming.length, sampleTitles: titles.slice(0, 3), allTitles: titles };
}

export interface KnownTitle { t: string; h: string; lat: number | null; lng: number | null }

/** Inom så många km från ortens mittpunkt räknas ett event som ortens eget. */
export const LOCAL_TITLES_KM = 30;

/**
 * Titlarna vi redan har INOM ORTEN (titel → värd), för dubblettkontrollen av
 * ett ställe med känd ort. Jämförelsen mot hela landet fällde Växjö Konserthus
 * 15/11 2026: 34 av 49 titlar "fanns redan" — som samma turné i Karlstad,
 * Örebro och Västerås. En konsertsal delar titlar med hela Sverige utan att vi
 * har just dess kvällar.
 */
export function titlesNear(rows: KnownTitle[], lat: number, lng: number, km = LOCAL_TITLES_KM): Map<string, string> {
    const out = new Map<string, string>();
    for (const r of rows) {
        if (!r.t || r.lat == null || r.lng == null || (r.lat === 0 && r.lng === 0)) continue;
        if (distanceKm(lat, lng, r.lat, r.lng) > km) continue;
        if (!out.has(r.t)) out.set(r.t, r.h ?? '');
    }
    return out;
}
