/**
 * bildRender.ts - gör ett kort (bild.ts) till en PNG. satori ritar
 * elementträdet som SVG med Fredoka ur repot, resvg rastrerar. Emojis
 * kommer ur @twemoji/svg lokalt (satori kan inte rita färgemoji ur
 * systemfonter, och nätet ska inte behövas vid rendering).
 *
 * Deterministiskt och utan systemberoenden: samma indata ger samma bild på
 * MacBooken och på minin.
 */

import fs from 'fs';
import path from 'path';
import satori, { type Font } from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { kortSpec, textOverlay, type Element, type SiffraKort, type BrickorKort, type RubrikKort, type TextOverlay } from './bild';

const FONT_DIR = path.resolve(__dirname, '../../../assets/fonts');
const TWEMOJI_DIR = path.dirname(require.resolve('@twemoji/svg/package.json'));

let fontCache: Font[] | null = null;

export function fredoka(): Font[] {
    if (fontCache) return fontCache;
    fontCache = [
        { name: 'Fredoka', data: fs.readFileSync(path.join(FONT_DIR, 'Fredoka-SemiBold.ttf')), weight: 600, style: 'normal' },
        { name: 'Fredoka', data: fs.readFileSync(path.join(FONT_DIR, 'Fredoka-Bold.ttf')), weight: 700, style: 'normal' },
    ];
    return fontCache;
}

/**
 * Twemojis filnamn för ett emoji-segment: kodpunkter i hex med bindestreck,
 * utan FE0F (variationsväljaren) när ingen ZWJ ingår. "🗓️" -> "1f5d3",
 * "1️⃣" -> "31-20e3", "👨‍👩‍👧" -> "1f468-200d-1f469-200d-1f467".
 */
export function emojiKod(segment: string): string {
    const harZwj = segment.includes('‍');
    const kodpunkter: number[] = [];
    for (const tecken of segment) {
        const cp = tecken.codePointAt(0)!;
        if (cp === 0xfe0f && !harZwj) continue;
        kodpunkter.push(cp);
    }
    return kodpunkter.map(cp => cp.toString(16)).join('-');
}

export function twemojiSvgPath(segment: string): string | null {
    const fil = path.join(TWEMOJI_DIR, `${emojiKod(segment)}.svg`);
    if (fs.existsSync(fil)) return fil;
    // Reserv: utan FE0F även vid ZWJ-sekvenser.
    const utan = path.join(TWEMOJI_DIR, `${emojiKod(segment.replace(/️/g, ''))}.svg`);
    return fs.existsSync(utan) ? utan : null;
}

async function laddaTillgang(kod: string, segment: string): Promise<string | Font[]> {
    if (kod !== 'emoji') return [];
    const fil = twemojiSvgPath(segment);
    if (!fil) {
        console.warn(`[bild] saknar twemoji för ${JSON.stringify(segment)}`);
        return '';
    }
    return `data:image/svg+xml;base64,${fs.readFileSync(fil).toString('base64')}`;
}

export async function renderaElement(element: Element, bredd: number, hojd: number): Promise<Buffer> {
    const svg = await satori(element as unknown as Parameters<typeof satori>[0], {
        width: bredd, height: hojd, fonts: fredoka(), loadAdditionalAsset: laddaTillgang,
    });
    return new Resvg(svg, { fitTo: { mode: 'width', value: bredd } }).render().asPng();
}

export async function renderaKort(typ: 'siffra', data: SiffraKort, utfil: string): Promise<string>;
export async function renderaKort(typ: 'brickor', data: BrickorKort, utfil: string): Promise<string>;
export async function renderaKort(typ: 'rubrik', data: RubrikKort, utfil: string): Promise<string>;
export async function renderaKort(typ: 'slutkort', data: { ikonDataUri?: string } | undefined, utfil: string): Promise<string>;
export async function renderaKort(typ: 'siffra' | 'brickor' | 'rubrik' | 'slutkort', data: any, utfil: string): Promise<string> {
    const spec = typ === 'slutkort' ? kortSpec('slutkort', data) : kortSpec(typ as 'siffra', data);
    const png = await renderaElement(spec.element, spec.bredd, spec.hojd);
    fs.mkdirSync(path.dirname(utfil), { recursive: true });
    fs.writeFileSync(utfil, png);
    return utfil;
}

/** En textrad som genomskinlig PNG (1080x1920) till videon. */
export async function renderaTextOverlay(t: TextOverlay, utfil: string): Promise<string> {
    const png = await renderaElement(textOverlay(t), 1080, 1920);
    fs.mkdirSync(path.dirname(utfil), { recursive: true });
    fs.writeFileSync(utfil, png);
    return utfil;
}

/** Molnikonen (appikonen) som data-URI till slutkortet, om den finns. */
export function molnIkon(): string | undefined {
    const fil = path.resolve(__dirname, '../../../../web/public/pwa-icon-bla-512.png');
    if (!fs.existsSync(fil)) return undefined;
    return `data:image/png;base64,${fs.readFileSync(fil).toString('base64')}`;
}
