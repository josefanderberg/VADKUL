/**
 * logg.ts - dagsinläggets minne: en JSON-fil på maskinen som kör jobbet
 * (Mac minin), bredvid ig-queue.json. Inte Firestore: den läses och skrivs
 * varje morgon och innehåller inget webben behöver. Gitignorerad.
 *
 * Rena funktioner för allt som rör innehållet (testade i logg.test.ts),
 * tunn I/O i botten (laddaLogg/sparaLogg).
 */

import fs from 'fs';
import path from 'path';
import type { Inlagg, Klipp, KlippTema, Logg, Milstolpe, Tema } from './typer';
import { KLIPP_TEMAN } from './typer';
import { dagarMellan } from './tid';

export const LOGG_PATH = process.env.DAGSINLAGG_LOGG
    ? path.resolve(process.env.DAGSINLAGG_LOGG)
    : path.resolve(__dirname, '../../../dagsinlagg-logg.json');

export const INSIKTER_EFTER_MS = 48 * 60 * 60 * 1000;

export function tomLogg(): Logg {
    return { inlagg: [], klipp: [], milstolpar: [] };
}

/** Saknade listor fylls på - filen kan ha skapats av boten med bara milstolpar. */
export function normaliseraLogg(raw: unknown): Logg {
    const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<Logg>;
    return {
        inlagg: Array.isArray(r.inlagg) ? r.inlagg : [],
        klipp: Array.isArray(r.klipp) ? r.klipp : [],
        milstolpar: Array.isArray(r.milstolpar) ? r.milstolpar : [],
    };
}

export function hittaInlagg(logg: Logg, id: string): Inlagg | undefined {
    return logg.inlagg.find(i => i.id === id);
}

/** Lägger till eller ersätter dagens inlägg. Ett publicerat inlägg rörs
 *  ALDRIG - en omkörning får inte dubbelposta eller tappa id:n. */
export function uppsertInlagg(logg: Logg, inlagg: Inlagg): Logg {
    const i = logg.inlagg.findIndex(x => x.id === inlagg.id);
    if (i === -1) return { ...logg, inlagg: [...logg.inlagg, inlagg] };
    if (logg.inlagg[i].status === 'publicerad') return logg;
    const inlaggLista = logg.inlagg.slice();
    inlaggLista[i] = inlagg;
    return { ...logg, inlagg: inlaggLista };
}

export function patchaInlagg(logg: Logg, id: string, patch: Partial<Inlagg>): Logg {
    return { ...logg, inlagg: logg.inlagg.map(i => (i.id === id ? { ...i, ...patch } : i)) };
}

/** 'Växjö' -> 'vaxjo', 'Upplands Väsby' -> 'upplands-vasby'. Samma ASCII som
 *  inkorgens filnamn, så klipp och stad kan jämföras. */
export function stadSlug(namn: string): string {
    return namn.toLowerCase()
        .replace(/å/g, 'a').replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/é/g, 'e').replace(/ü/g, 'u')
        .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/**
 * Tema (och stad) ur ett inkorgsfilnamn: 'YYYY-MM-DD-<tema>[-<stad>]-<n>.mp4'.
 * Längsta kända tema som matchar vinner (bjud-med före okant). Filer med
 * andra namn (rsync-vägen) blir 'okant' - granskaren får klassa dem.
 */
export function temaUrFilnamn(fil: string): { tema: KlippTema; stad?: string } {
    const bas = path.basename(fil).replace(/\.[^.]+$/, '').toLowerCase();
    const utanDatum = bas.replace(/^\d{4}-\d{2}-\d{2}-/, '');
    const utanLopnummer = utanDatum.replace(/-\d+$/, '');
    const traff = [...KLIPP_TEMAN]
        .filter(t => t !== 'okant')
        .sort((a, b) => b.length - a.length)
        .find(t => utanLopnummer === t || utanLopnummer.startsWith(`${t}-`));
    if (!traff) return { tema: 'okant' };
    const rest = utanLopnummer.slice(traff.length + 1);
    return rest ? { tema: traff, stad: rest } : { tema: traff };
}

/** Nya filer i inkorgen registreras som 'ny'; kända rörs inte. */
export function registreraKlipp(logg: Logg, filer: string[], nu: number): Logg {
    const kanda = new Set(logg.klipp.map(k => k.fil));
    const nya: Klipp[] = filer
        .map(f => path.basename(f))
        .filter(f => /\.(mp4|mov)$/i.test(f) && !kanda.has(f))
        .map(fil => ({ fil, ...temaUrFilnamn(fil), status: 'ny' as const, mottaget: nu }));
    return nya.length ? { ...logg, klipp: [...logg.klipp, ...nya] } : logg;
}

/** Klipp vars fil försvunnit ur inkorgen markeras avvisade (raderade för hand). */
export function rensaForsvunnaKlipp(logg: Logg, filerSomFinns: string[]): Logg {
    const finns = new Set(filerSomFinns.map(f => path.basename(f)));
    return {
        ...logg,
        klipp: logg.klipp.map(k => (k.status === 'ny' || k.status === 'godkänd') && !finns.has(k.fil)
            ? { ...k, status: 'avvisad' as const, motivering: 'filen borta ur inkorgen' }
            : k),
    };
}

export function patchaKlipp(logg: Logg, fil: string, patch: Partial<Klipp>): Logg {
    return { ...logg, klipp: logg.klipp.map(k => (k.fil === fil ? { ...k, ...patch } : k)) };
}

export function ledigaKlipp(logg: Logg): Klipp[] {
    return logg.klipp.filter(k => k.status === 'ny' || k.status === 'godkänd');
}

/** Städer ett tema redan använt de senaste `dagar` dagarna (rotationen). */
export function staderAnvanda(logg: Logg, tema: Tema, dagar: number, idag: string): string[] {
    return logg.inlagg
        .filter(i => i.tema === tema && i.stad && i.status !== 'vetad' && i.status !== 'misslyckad'
            && dagarMellan(i.id, idag) < dagar)
        .map(i => i.stad!);
}

/** Inlägg publicerade för mer än 48 h sedan som ännu inte fått insikter. */
export function utanInsikter(logg: Logg, nu: number, efterMs = INSIKTER_EFTER_MS): Inlagg[] {
    return logg.inlagg.filter(i => i.status === 'publicerad' && i.publicerad && !i.insikter
        && nu - i.publicerad >= efterMs);
}

/** Publicerade spel- och quizinlägg som väntar på sin uppföljningskommentar. */
export function oavslutadUppfoljning(logg: Logg): Inlagg[] {
    return logg.inlagg.filter(i => i.status === 'publicerad' && (i.tema === 'gissa' || i.tema === 'quiz')
        && !i.uppfoljning?.klar);
}

export function oanvandMilstolpe(logg: Logg): Milstolpe | undefined {
    return [...logg.milstolpar].filter(m => !m.anvand).sort((a, b) => (a.datum < b.datum ? -1 : 1))[0];
}

export function markeraMilstolpe(logg: Logg, text: string): Logg {
    let klar = false;
    return {
        ...logg,
        milstolpar: logg.milstolpar.map(m => {
            if (!klar && !m.anvand && m.text === text) { klar = true; return { ...m, anvand: true }; }
            return m;
        }),
    };
}

/** De senaste n inläggen (nyast först). */
export function senasteInlagg(logg: Logg, n: number): Inlagg[] {
    return [...logg.inlagg].sort((a, b) => (a.id < b.id ? 1 : -1)).slice(0, n);
}

// --- I/O -----------------------------------------------------------------

export function laddaLogg(file = LOGG_PATH): Logg {
    if (!fs.existsSync(file)) return tomLogg();
    try {
        return normaliseraLogg(JSON.parse(fs.readFileSync(file, 'utf-8')));
    } catch (e) {
        throw new Error(`Kunde inte läsa ${file}: ${(e as Error).message}`);
    }
}

/** Atomisk skrivning (tmp + rename) - boten och dagsinlägget delar filen. */
export function sparaLogg(logg: Logg, file = LOGG_PATH): void {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(logg, null, 2) + '\n', 'utf-8');
    fs.renameSync(tmp, file);
}
