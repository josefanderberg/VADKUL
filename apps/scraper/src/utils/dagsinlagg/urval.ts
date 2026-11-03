/**
 * urval.ts - vad inläggen handlar om, räknat ur kartdatan. REN logik:
 * events-destinations.json (och cards) in, siffror och kandidater ut.
 * Ingen Firestore, ingen fetch. Ortlistan (cityPoints) skickas in av
 * anroparen så funktionerna går att testa med en liten fixtur.
 *
 * Regler: opt-in-källorna (Svenska kyrkan, PRO, Korpen) räknas aldrig med
 * (ett inlägg ska visa kartan en ny besökare ser); siffror avrundas till
 * ärliga golv; städer roterar; spelet och helgen nämner högst tre event.
 */

import { eventShareSlug } from '../eventShareSlug';
import { isOptInSource } from '../cityPostText';
import { gissning, raknaOrt, VECKODAGAR, type Gissning, type RapportEvent } from '../ortsrapport';
import { distanceKm, nearestTown, type TownPoint } from '../townBoundary';
import type { DestEvent } from './typer';
import { dagarMellan, dygnet, helgen, plusDagar, stockholmDatum, stockholmVeckodag } from './tid';
import { golv, talMedPlus } from './text';

/** Radien för "i staden", samma som stadssidorna och helgpushen. */
export const STAD_RADIE_KM = 10;
/** Minsta antal helgevent för att en stad ska få ett helginlägg. */
export const HELG_MIN = 15;
/** Minsta antal event (30 dagar) för att en stad ska få ett quiz. */
export const QUIZ_MIN = 40;
/** Så länge en stad vilar efter ett helg- eller quizinlägg. */
export const STAD_VILA_DAGAR = 28;
export const TITEL_MAX = 40;

/** Titlar som får nämnas i text: korta, utan utropstecken (max ett "!" per
 *  inlägg) och utan versalskrik. */
export function titelDuger(titel: string): boolean {
    const t = titel.trim();
    if (!t || t.length > TITEL_MAX) return false;
    if (/[!?–—]/.test(t)) return false;
    const bokstaver = t.replace(/[^A-Za-zÅÄÖåäö]/g, '');
    if (bokstaver.length >= 6 && bokstaver === bokstaver.toUpperCase()) return false;
    return true;
}

export const KATEGORI_TEXT: Record<string, string> = {
    music: 'musik', stage: 'scen', art: 'konst', sport: 'sport och träning', food: 'mat och dryck',
    market: 'marknader', party: 'fest och uteliv', social: 'socialt', course: 'kurser och föreläsningar',
    family: 'familj', other: 'övrigt',
};

export const STANDARD_EMOJI: Record<string, string> = {
    music: '🎵', stage: '🎭', art: '🎨', sport: '⚽', food: '🍽️', market: '🛍️', party: '🎉',
    social: '☕', course: '🎓', family: '🧸', other: '📍',
};

/** Första emojin i en sträng (aggregatet kan ha "🎵🎤"); tom sträng om ingen. */
export function forstaEmoji(s: string | undefined): string {
    if (!s) return '';
    const m = s.match(/\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*|[0-9#*]\uFE0F?\u20E3/u);
    return m ? m[0] : '';
}

export function emojiFor(e: Pick<DestEvent, 'emoji' | 'category'>): string {
    return forstaEmoji(e.emoji) || STANDARD_EMOJI[e.category] || '📍';
}

export function utanOptIn(events: DestEvent[]): DestEvent[] {
    return events.filter(e => !isOptInSource(e.id));
}

const ms = (iso: string): number => new Date(iso).getTime();

/** Event som pågår under [start, slut): startar i fönstret, eller är ett
 *  flerdagarsevent som spänner över det. */
export function iFonstret(events: DestEvent[], start: Date, slut: Date): DestEvent[] {
    const s = start.getTime(), e = slut.getTime();
    return events.filter(ev => {
        const t = ms(ev.time);
        if (Number.isNaN(t)) return false;
        if (t >= s && t < e) return true;
        if (ev.endDate) {
            const slutT = ms(ev.endDate);
            return t < e && slutT >= s;
        }
        return false;
    });
}

export function iDygnet(events: DestEvent[], datum: string): DestEvent[] {
    const d = dygnet(datum);
    return iFonstret(events, d.start, d.slut);
}

export function iStaden(events: DestEvent[], stad: TownPoint, radieKm = STAD_RADIE_KM): DestEvent[] {
    return events.filter(e => distanceKm(e.lat, e.lng, stad.lat, stad.lng) <= radieKm);
}

function toppKategori(events: DestEvent[]): { kategori: string; antal: number } {
    const antal = new Map<string, number>();
    for (const e of events) {
        if (e.category === 'other') continue;
        antal.set(e.category, (antal.get(e.category) ?? 0) + 1);
    }
    const [kategori, n] = [...antal.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0] ?? ['other', 0];
    return { kategori, antal: n };
}

// --- Siffror -------------------------------------------------------------------

export interface Siffror {
    datum: string;
    idag: number;
    vecka: number;
    nya: number;
    toppKategori: string;
    toppKategoriAntal: number;
    helg: number;
    helgFredag: string;
    toppStad?: string;
    toppStadAntal?: number;
    /** Färdiga textvärden (golv) som byggText använder. */
    data: Record<string, string | number>;
}

/** Måndagens och fredagens siffror. `orter` = cityPoints för toppstaden. */
export function siffror(alla: DestEvent[], nu: Date | number, orter: TownPoint[] = []): Siffror {
    const events = utanOptIn(alla);
    const datum = stockholmDatum(nu);
    const idag = iDygnet(events, datum).length;
    const veckaSlut = dygnet(plusDagar(datum, 6)).slut;
    const vecka = iFonstret(events, dygnet(datum).start, veckaSlut);
    const forraVeckan = plusDagar(datum, -7);
    const nya = events.filter(e => e.fs && dagarMellan(e.fs, datum) <= 7 && e.fs > forraVeckan && ms(e.time) >= dygnet(datum).start.getTime()).length;
    const topp = toppKategori(vecka);
    const h = helgen(nu);
    const helgEvents = iFonstret(events, h.start, h.slut);
    let toppStad: string | undefined, toppStadAntal: number | undefined;
    if (orter.length) {
        const perStad = new Map<string, number>();
        for (const e of helgEvents) {
            const t = nearestTown(e, orter);
            if (t && distanceKm(e.lat, e.lng, t.lat, t.lng) <= STAD_RADIE_KM) perStad.set(t.name, (perStad.get(t.name) ?? 0) + 1);
        }
        const basta = [...perStad.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'sv'))[0];
        if (basta) [toppStad, toppStadAntal] = basta;
    }
    const data: Record<string, string | number> = {
        idagGolv: talMedPlus(idag), veckaGolv: talMedPlus(vecka.length), nyaGolv: talMedPlus(nya),
        toppKategori: KATEGORI_TEXT[topp.kategori] ?? topp.kategori, toppEmoji: STANDARD_EMOJI[topp.kategori] ?? '📍',
        helgGolv: talMedPlus(helgEvents.length),
        idag, vecka: vecka.length, nya, helg: helgEvents.length,
    };
    if (toppStad) { data.toppStad = toppStad; data.toppStadAntal = toppStadAntal!; }
    return {
        datum, idag, vecka: vecka.length, nya, toppKategori: topp.kategori, toppKategoriAntal: topp.antal,
        helg: helgEvents.length, helgFredag: h.fredag, toppStad, toppStadAntal, data,
    };
}

// --- Spelet ---------------------------------------------------------------------

export interface GissaKandidat {
    id: string;
    slug: string;
    url: string;
    titel: string;
    stad: string;
    emoji: string;
    kategori: string;
    ps: number;
    time: string;
}

const popPoang = (e: DestEvent): number => e.ps ?? (e.pop ? 40 : 0);

/**
 * Tre event i dag, tre olika städer, tre olika kategorier: högst ps först.
 * Klockslag krävs (ett heldagsevent kan ingen "öppna i dag"), familj och
 * opt-in utesluts, titeln får plats på en bricka.
 */
export function gissaKandidater(alla: DestEvent[], orter: TownPoint[], nu: Date | number, uteslutId: string[] = []): GissaKandidat[] {
    const datum = stockholmDatum(nu);
    const uteslut = new Set(uteslutId);
    const kandidater = iDygnet(utanOptIn(alla), datum)
        .filter(e => e.hasSpecificTime && e.category !== 'family' && e.title && titelDuger(e.title)
            && popPoang(e) > 0 && !uteslut.has(e.id))
        .sort((a, b) => popPoang(b) - popPoang(a) || a.title.localeCompare(b.title, 'sv'));
    const valda: GissaKandidat[] = [];
    const stader = new Set<string>(), kategorier = new Set<string>(), titlar = new Set<string>();
    for (const e of kandidater) {
        const t = nearestTown(e, orter);
        if (!t || distanceKm(e.lat, e.lng, t.lat, t.lng) > STAD_RADIE_KM) continue;
        const titel = e.title.trim();
        if (stader.has(t.name) || kategorier.has(e.category) || titlar.has(titel.toLowerCase())) continue;
        stader.add(t.name); kategorier.add(e.category); titlar.add(titel.toLowerCase());
        const slug = eventShareSlug(e.id);
        valda.push({ id: e.id, slug, url: `https://vadkul.se/e/${slug}`, titel, stad: t.name, emoji: emojiFor(e), kategori: e.category, ps: popPoang(e), time: e.time });
        if (valda.length === 3) break;
    }
    return valda.length === 3 ? valda : [];
}

export function gissaData(k: GissaKandidat[]): Record<string, string | number> {
    const data: Record<string, string | number> = {};
    k.forEach((x, i) => {
        data[`k${i + 1}Titel`] = x.titel; data[`k${i + 1}Stad`] = x.stad; data[`k${i + 1}Url`] = x.url;
    });
    return data;
}

/**
 * Vinnaren i spelet: störst ökning sedan baslinjen i poängen
 * views + 3*clicks + going + interested. Under golvet (3 poäng) avgörs
 * på ps och texten säger "den vi tror flest hittar till" i stället för att
 * påstå klick. Siffrorna visas aldrig.
 */
export interface Matvarde { views?: number; clicks?: number; going?: number; interested?: number }
export const VINNAR_GOLV = 3;

export function poang(m: Matvarde): number {
    return (m.views ?? 0) + 3 * (m.clicks ?? 0) + (m.going ?? 0) + (m.interested ?? 0);
}

export function avgorVinnare(
    kandidater: { id: string; titel: string; stad: string; ps: number }[],
    baslinje: Record<string, number>,
    nuPoang: Record<string, number>,
): { vinnare: { id: string; titel: string; stad: string; nr: number }; grund: 'klick' | 'ps' } {
    const delta = kandidater.map((k, i) => ({ k, nr: i + 1, d: (nuPoang[k.id] ?? 0) - (baslinje[k.id] ?? 0) }));
    const basta = [...delta].sort((a, b) => b.d - a.d || b.k.ps - a.k.ps || a.nr - b.nr)[0];
    if (basta.d >= VINNAR_GOLV) return { vinnare: { ...basta.k, nr: basta.nr }, grund: 'klick' };
    const psBasta = [...delta].sort((a, b) => b.k.ps - a.k.ps || a.nr - b.nr)[0];
    return { vinnare: { ...psBasta.k, nr: psBasta.nr }, grund: 'ps' };
}

const NR_EMOJI = ['1️⃣', '2️⃣', '3️⃣'];

export function vinnarKommentar(v: ReturnType<typeof avgorVinnare>): string {
    const { vinnare, grund } = v;
    return grund === 'klick'
        ? `Flest hittade till ${NR_EMOJI[vinnare.nr - 1]} ${vinnare.titel} i ${vinnare.stad} ☁️ Tack för alla gissningar, nytt spel på onsdag.`
        : `Jämnt i dag. Den vi tror flest hittar till: ${NR_EMOJI[vinnare.nr - 1]} ${vinnare.titel} i ${vinnare.stad} ☁️ Nytt spel på onsdag.`;
}

// --- Helgen i en stad ---------------------------------------------------------------

export interface HelgStad {
    stad: string;
    antal: number;
    fredag: string;
    topp: { titel: string; emoji: string; dag: string }[];
    data: Record<string, string | number>;
}

/**
 * Staden med flest helgevent bland `kandidatStader` (städer med stadssida),
 * som inte vilar. Tre namngivna event: högst ps, en per dag om det går,
 * inte familj.
 */
export function helgStad(alla: DestEvent[], kandidatStader: TownPoint[], nu: Date | number, vilande: string[] = []): HelgStad | null {
    const h = helgen(nu);
    const events = iFonstret(utanOptIn(alla), h.start, h.slut);
    const vila = new Set(vilande.map(s => s.toLowerCase()));
    let basta: { stad: TownPoint; egna: DestEvent[] } | null = null;
    for (const stad of kandidatStader) {
        if (vila.has(stad.name.toLowerCase())) continue;
        const egna = iStaden(events, stad);
        if (egna.length >= HELG_MIN && (!basta || egna.length > basta.egna.length)) basta = { stad, egna };
    }
    if (!basta) return null;
    const dagNamn = (e: DestEvent): string => VECKODAGAR[(stockholmVeckodag(ms(e.time)) + 6) % 7];
    const rankade = basta.egna
        .filter(e => e.category !== 'family' && e.title && titelDuger(e.title))
        .sort((a, b) => popPoang(b) - popPoang(a) || (a.hasSpecificTime ? 0 : 1) - (b.hasSpecificTime ? 0 : 1) || ms(a.time) - ms(b.time));
    const topp: HelgStad['topp'] = [];
    const dagar = new Set<string>(), titlar = new Set<string>();
    for (const forsok of [true, false]) {
        for (const e of rankade) {
            if (topp.length === 3) break;
            const dag = dagNamn(e), titel = e.title.trim();
            if (titlar.has(titel.toLowerCase())) continue;
            if (forsok && dagar.has(dag)) continue;
            dagar.add(dag); titlar.add(titel.toLowerCase());
            topp.push({ titel, emoji: emojiFor(e), dag });
        }
    }
    const data: Record<string, string | number> = {
        stad: basta.stad.name, antal: basta.egna.length, antalGolv: talMedPlus(basta.egna.length),
        topp1: topp[0]?.titel ?? '', topp2: topp[1]?.titel ?? '', topp3: topp[2]?.titel ?? '',
    };
    return { stad: basta.stad.name, antal: basta.egna.length, fredag: h.fredag, topp, data };
}

// --- Quizet -------------------------------------------------------------------------

export interface Quiz {
    stad: string;
    fraga: string;
    alternativ: string[];
    ratt: number;
    svar: string;
    antal: number;
    data: Record<string, string | number>;
}

export function tillRapportEvent(e: DestEvent): RapportEvent {
    return { url: e.id, title: e.title, time: e.time, lat: e.lat, lng: e.lng, category: e.category, locationName: e.locationName };
}

/** Quiz om en stad som inte vilar: "Vilken veckodag händer det minst i X?" */
export function quizForStad(alla: DestEvent[], kandidatStader: TownPoint[], orter: TownPoint[], nu: Date | number, vilande: string[] = []): Quiz | null {
    const fran = new Date(typeof nu === 'number' ? nu : nu.getTime());
    const events = utanOptIn(alla).map(tillRapportEvent);
    const vila = new Set(vilande.map(s => s.toLowerCase()));
    const ordning = [...kandidatStader].filter(s => !vila.has(s.name.toLowerCase()));
    let basta: { stat: ReturnType<typeof raknaOrt>; g: Gissning } | null = null;
    for (const stad of ordning) {
        const stat = raknaOrt(events, stad, orter, { fran, dagar: 30, maxKm: STAD_RADIE_KM });
        if (stat.antal < QUIZ_MIN) continue;
        const g = gissning(stat);
        // Ett rättvist quiz: lugnaste dagen klart lugnare än de andra två
        // alternativen (minst 15 %) och livligaste minst 1,5 gånger lugnaste.
        const tal = g.alternativ.map(a => stat.perVeckodag[VECKODAGAR.indexOf(a)]);
        const ratt = tal[g.ratt];
        const nast = Math.min(...tal.filter((_, i) => i !== g.ratt));
        const livligast = Math.max(...tal);
        if (ratt > nast * 0.85 || livligast < ratt * 1.5) continue;
        if (!basta || stat.antal > basta.stat.antal) basta = { stat, g };
    }
    if (!basta) return null;
    const { stat, g } = basta;
    return {
        stad: stat.ort, fraga: g.fraga, alternativ: g.alternativ, ratt: g.ratt, svar: g.alternativ[g.ratt], antal: stat.antal,
        data: { stad: stat.ort, fraga: g.fraga, alt1: g.alternativ[0], alt2: g.alternativ[1], alt3: g.alternativ[2], antal: stat.antal },
    };
}

export function quizKommentar(q: Pick<Quiz, 'ratt' | 'svar' | 'stad'>): string {
    return `Rätt svar: ${NR_EMOJI[q.ratt]} ${q.svar}. Lugnast i ${q.stad} enligt kartan just nu ☁️ Nytt quiz på lördag.`;
}

/** Städer med stadssida ur ortlistan (de kan få helg- och quizinlägg). */
export function stadssidor(orter: TownPoint[], harSlug: (namn: string) => boolean): TownPoint[] {
    return orter.filter(o => harSlug(o.name));
}

export { golv };
