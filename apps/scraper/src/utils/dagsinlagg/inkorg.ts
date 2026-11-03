/**
 * inkorg.ts - klippen in. Josef genererar Grok-klippen själv i batch och
 * skickar dem som FIL till Telegram-boten med temat som bildtext ("ikväll",
 * "fredag", "helg Växjö"). Boten (bot-daemon.ts) och dagsinläggets
 * vetofönster sparar dem här. Större klipp än 20 MB (Telegrams gräns för
 * botar) går via `npm run klipp-till-minin` (rsync) rakt in i mappen.
 *
 * Rena delar (temaUrBildtext, inkorgsFilnamn) testas; I/O längst ner.
 */

import fs from 'fs';
import path from 'path';
import { hamtaFil, type InkommandeMedia } from '../telegram';
import type { KlippTema } from './typer';
import { stadSlug } from './logg';
import { stockholmDatum } from './tid';

export const INKORG_PATH = process.env.DAGSINLAGG_INKORG
    ? path.resolve(process.env.DAGSINLAGG_INKORG)
    : path.resolve(__dirname, '../../../dagsinlagg/inkorg');

/** Vad folk skriver i bildtexten -> klipp-tema. Första träff i ordningen vinner. */
const TEMA_ORD: [RegExp, KlippTema][] = [
    [/\bskapa[ -]?eget\b|\blägg upp\b|\beget event\b/i, 'skapa-eget'],
    [/\bbjud[ -]?med\b|\bbjud\b|\bvän\b/i, 'bjud-med'],
    [/\bhitta[ -]?p[åa](?!\p{L})|\bsoffan?\b|\buttråkad(?!\p{L})/iu, 'hitta-pa'],
    [/\ballt\b|\bett ställe\b|\baffisch/i, 'allt'],
    [/\bfredag/i, 'fredag'],
    [/\bregn/i, 'regnig'],
    [/\bhelg/i, 'helg'],
    [/\bikväll\b|\bikvall\b|\bkväll/i, 'ikvall'],
    [/\bbudskap\b|\ballmän/i, 'budskap'],
];

/** "helg Växjö" -> { tema: 'helg', stad: 'vaxjo' }; "Ikväll!" -> { tema: 'ikvall' }. */
export function temaUrBildtext(bildtext: string | undefined): { tema: KlippTema; stad?: string } {
    const t = (bildtext ?? '').trim();
    if (!t) return { tema: 'okant' };
    for (const [re, tema] of TEMA_ORD) {
        if (!re.test(t)) continue;
        if (tema === 'helg') {
            const m = t.match(/helg(?:en)?\s+(?:i\s+)?([\p{L}][\p{L} -]*)/iu);
            const stad = m ? stadSlug(m[1].trim()) : '';
            return stad ? { tema, stad } : { tema };
        }
        return { tema };
    }
    return { tema: 'okant' };
}

/** 'YYYY-MM-DD-<tema>[-<stad>]-<n>.mp4', ASCII (logg.temaUrFilnamn läser det). */
export function inkorgsFilnamn(datum: string, tema: KlippTema, stad: string | undefined, lopnummer: number, originalnamn?: string): string {
    const ext = (originalnamn?.match(/\.(mp4|mov)$/i)?.[1] ?? 'mp4').toLowerCase();
    const delar = [datum, tema, ...(stad ? [stadSlug(stad)] : []), String(lopnummer)];
    return `${delar.join('-')}.${ext}`;
}

/** Första lediga löpnumret för datum + tema i mappen. */
export function nastaLopnummer(befintliga: string[], datum: string, tema: KlippTema, stad?: string): number {
    const prefix = [datum, tema, ...(stad ? [stadSlug(stad)] : [])].join('-') + '-';
    let n = 1;
    const namn = new Set(befintliga.map(f => path.basename(f)));
    while ([...namn].some(f => f.startsWith(`${prefix}${n}.`))) n++;
    return n;
}

export function arVideo(media: Pick<InkommandeMedia, 'mimeType' | 'fileName'>): boolean {
    return /^video\//i.test(media.mimeType ?? '') || /\.(mp4|mov)$/i.test(media.fileName ?? '');
}

// --- I/O -------------------------------------------------------------------

export function listaInkorg(mapp = INKORG_PATH): string[] {
    if (!fs.existsSync(mapp)) return [];
    return fs.readdirSync(mapp).filter(f => /\.(mp4|mov)$/i.test(f)).sort();
}

export interface SparatKlipp { fil: string; tema: KlippTema; stad?: string }

/**
 * Sparar ett inkommet klipp i inkorgen. Kastar vid fel (för stor fil, fel typ)
 * så anroparen kan svara i Telegram.
 */
export async function sparaInkommetKlipp(media: InkommandeMedia, mapp = INKORG_PATH, nu = Date.now()): Promise<SparatKlipp> {
    if (!arVideo(media)) throw new Error('inte en videofil (skicka mp4 eller mov som fil)');
    const { tema, stad } = temaUrBildtext(media.caption);
    const datum = stockholmDatum(nu);
    fs.mkdirSync(mapp, { recursive: true });
    const n = nastaLopnummer(listaInkorg(mapp), datum, tema, stad);
    const fil = inkorgsFilnamn(datum, tema, stad, n, media.fileName);
    await hamtaFil(media.fileId, path.join(mapp, fil));
    return { fil, tema, stad };
}
