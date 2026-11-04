/**
 * karta.ts - kartan i korten. REN logik, ingen I/O:
 *
 *  - Stadskortet: stadssidans förrenderade kartbild (apps/web/public/
 *    kartbilder/<slug>.webp, 1260x636 = heron 630x318 i 2x, centrerad på
 *    stadens lat/lng i cityPages.ts, kakelzoom 12) med riktiga brickor
 *    ovanpå. Projektionen är exakt heronas (CityMapHero.worldPx), så
 *    brickan hamnar där eventet är på bilden.
 *  - Sverigekortet: varje plats med event som en prick, Sverige ritat av
 *    utbudet självt. Ren SVG (resvg rastrerar den).
 *
 * Färgerna är en KOPIA av markerHex i apps/web/src/utils/categories.ts och
 * gradienten av sourceGradientCss i v2MapBricka.ts (scraperns ts-node kan
 * inte importera webben). Byt där, byt här.
 */

import type { DestEvent } from './typer';

// --- Projektionen ---------------------------------------------------------------

const TILE = 256;
/** Kakelzoomen kartbilderna ritades i (CityMapHero.HERO_ZOOM). */
export const KARTBILD_ZOOM = 12;
/** Kartbildens mått i bildpixlar (2x av heronas 630x318 CSS-px). */
export const KARTBILD_BREDD = 1260;
export const KARTBILD_HOJD = 636;
/** Bildpixlar per världspixel vid KARTBILD_ZOOM. */
export const KARTBILD_SKALA = 2;

/** Webbmercator: världspixel vid given zoom (samma som MapLibre och heron). */
export function worldPx(lat: number, lng: number, zoom: number): { x: number; y: number } {
    const scale = TILE * 2 ** zoom;
    const x = ((lng + 180) / 360) * scale;
    const s = Math.sin((lat * Math.PI) / 180);
    const y = (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * scale;
    return { x, y };
}

// --- Brickans färg ---------------------------------------------------------------

/** Kopia av markerHex per kategori (apps/web/src/utils/categories.ts). */
export const KATEGORI_HEX: Record<string, string> = {
    music: '#ec4899', stage: '#9333ea', art: '#f97316', sport: '#ef4444', food: '#d97706',
    market: '#059669', party: '#c026d3', social: '#14b8a6', course: '#3b82f6', family: '#06b6d4',
    other: '#94a3b8',
};

const hexTillRgb = (hex: string): [number, number, number] => {
    const h = hex.replace('#', '');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
};

function blanda(hex: string, med: string, andel: number): string {
    const a = hexTillRgb(hex), b = hexTillRgb(med);
    const c = a.map((v, i) => Math.round(v + (b[i] - v) * andel));
    return `rgb(${c[0]},${c[1]},${c[2]})`;
}

/** Brickans kropp: samma 145-graders gradient som kartan (sourceGradientCss). */
export function brickGradient(kategori: string): string {
    const hex = KATEGORI_HEX[kategori];
    if (!hex) return 'linear-gradient(145deg, #344256 0%, #1e293b 55%, #16202e 100%)';
    return `linear-gradient(145deg, ${blanda(hex, '#ffffff', 0.22)} 0%, ${hex} 55%, ${blanda(hex, '#000000', 0.32)} 100%)`;
}

// --- Brickorna på stadskartan ---------------------------------------------------------

export interface KartRuta {
    /** Stadens mitt = kartbildens mitt. */
    lat: number;
    lng: number;
    /** Kartytans mått i kortet (px). */
    bredd: number;
    hojd: number;
    /** Kortpixlar per bildpixel (kartbilden skalas till att täcka ytan). */
    skala: number;
}

/** Skala som får kartbilden att täcka en yta (object-cover, centrerat). */
export function tackande(bredd: number, hojd: number): number {
    return Math.max(bredd / KARTBILD_BREDD, hojd / KARTBILD_HOJD);
}

export interface KartBricka {
    id: string;
    emoji: string;
    kategori: string;
    /** Spetsens läge i kartytan (px från ytans övre vänstra hörn). */
    x: number;
    y: number;
}

/** Ett events läge i kartytan, eller null om det hamnar utanför bilden. */
export function iRutan(e: { lat: number; lng: number }, r: KartRuta, marginal = 0): { x: number; y: number } | null {
    const c = worldPx(r.lat, r.lng, KARTBILD_ZOOM);
    const p = worldPx(e.lat, e.lng, KARTBILD_ZOOM);
    const x = r.bredd / 2 + (p.x - c.x) * KARTBILD_SKALA * r.skala;
    const y = r.hojd / 2 + (p.y - c.y) * KARTBILD_SKALA * r.skala;
    if (x < marginal || x > r.bredd - marginal || y < marginal || y > r.hojd - marginal) return null;
    return { x, y };
}

export interface BrickVal {
    max: number;
    /** Minsta avstånd mellan två brickspetsar (px), så kartan inte korkas igen. */
    minAvstand: number;
    /** Marginal mot kanterna (px), brickan är högre än sin spets. */
    marginal: number;
    /** Övre marginal: brickan sticker upp över spetsen. */
    topp?: number;
    /** Undre marginal: texten under kartan får inte krocka med en spets. */
    botten?: number;
    emojiFor: (e: DestEvent) => string;
}

/**
 * Brickorna kortet visar: populärast först (ps), högst en per plats, inte
 * tätare än minAvstand, aldrig utanför bilden. Kategorierna sprids genom att
 * en kategori som redan har tre brickor får vänta tills alla andra fått plats.
 */
export function valjBrickor(events: DestEvent[], r: KartRuta, v: BrickVal): KartBricka[] {
    const placerbara = events
        .map(e => ({ e, p: iRutan(e, r, v.marginal) }))
        .filter((x): x is { e: DestEvent; p: { x: number; y: number } } => x.p !== null
            && x.p.y >= (v.topp ?? v.marginal) && x.p.y <= r.hojd - (v.botten ?? v.marginal))
        .sort((a, b) => (b.e.ps ?? (b.e.pop ? 40 : 0)) - (a.e.ps ?? (a.e.pop ? 40 : 0)) || a.e.time.localeCompare(b.e.time) || a.e.id.localeCompare(b.e.id));
    const valda: KartBricka[] = [];
    const perKategori = new Map<string, number>();
    const ledig = (p: { x: number; y: number }): boolean =>
        valda.every(b => Math.hypot(b.x - p.x, b.y - p.y) >= v.minAvstand);
    for (const tak of [3, Infinity]) {
        for (const { e, p } of placerbara) {
            if (valda.length >= v.max) return valda;
            if (valda.some(b => b.id === e.id)) continue;
            if ((perKategori.get(e.category) ?? 0) >= tak) continue;
            if (!ledig(p)) continue;
            valda.push({ id: e.id, emoji: v.emojiFor(e), kategori: e.category, x: Math.round(p.x), y: Math.round(p.y) });
            perKategori.set(e.category, (perKategori.get(e.category) ?? 0) + 1);
        }
    }
    return valda;
}

/**
 * Den plats i en ram som ligger längst från alla brickor (rutnät med steg
 * `steg` px). Budskapskortets "ditt event här"-bricka ska stå fritt.
 */
export function ledigPlats(
    brickor: { x: number; y: number }[],
    ram: { x0: number; y0: number; x1: number; y1: number },
    steg = 10,
    /** Punkter relativt kandidaten som också ska stå fritt (brickans kropp, etiketten bredvid). */
    kontroll: { dx: number; dy: number }[] = [{ dx: 0, dy: 0 }],
): { x: number; y: number } {
    let basta = { x: Math.round((ram.x0 + ram.x1) / 2), y: Math.round((ram.y0 + ram.y1) / 2) };
    let bastaAvstand = -1;
    for (let y = ram.y0; y <= ram.y1; y += steg) {
        for (let x = ram.x0; x <= ram.x1; x += steg) {
            const d = brickor.length
                ? Math.min(...kontroll.flatMap(k => brickor.map(b => Math.hypot(b.x - (x + k.dx), b.y - (y + k.dy)))))
                : Infinity;
            if (d > bastaAvstand) { bastaAvstand = d; basta = { x, y }; }
            if (d === Infinity) return basta;
        }
    }
    return basta;
}

// --- Sverige av prickar ----------------------------------------------------------------

/** Sveriges ram (lite luft runt). Event utanför ritas inte. */
export const SVERIGE_RAM = { syd: 55.2, norr: 69.2, vast: 10.9, ost: 24.3 } as const;

const mercY = (lat: number): number => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));

/** Höjd/bredd för Sverigeramen i mercator: kartytan ska ha den formen. */
export function sverigeProportion(): number {
    const b = ((SVERIGE_RAM.ost - SVERIGE_RAM.vast) * Math.PI) / 180;
    return (mercY(SVERIGE_RAM.norr) - mercY(SVERIGE_RAM.syd)) / b;
}

export interface Prick { x: number; y: number; n: number }

/** En koordinat i Sverigeytan (px), eller null utanför ramen. */
export function sverigePunkt(lat: number, lng: number, bredd: number, hojd: number): { x: number; y: number } | null {
    const r = SVERIGE_RAM;
    if (!(lat >= r.syd && lat <= r.norr && lng >= r.vast && lng <= r.ost)) return null;
    const yN = mercY(r.norr), yS = mercY(r.syd);
    return { x: ((lng - r.vast) / (r.ost - r.vast)) * bredd, y: ((yN - mercY(lat)) / (yN - yS)) * hojd };
}

/**
 * Event -> prickar i en yta med Sverigeramens form. Event på samma plats
 * (inom en halv pixel) slås ihop till en prick med antal, så en konserthall
 * med tjugo kvällar inte blir tjugo prickar ovanpå varandra.
 */
export function prickar(events: { lat: number; lng: number }[], bredd: number, hojd: number): Prick[] {
    const per = new Map<string, Prick>();
    for (const e of events) {
        const pos = sverigePunkt(e.lat, e.lng, bredd, hojd);
        if (!pos) continue;
        const x = Math.round(pos.x * 2) / 2;
        const y = Math.round(pos.y * 2) / 2;
        const nyckel = `${x},${y}`;
        const p = per.get(nyckel);
        if (p) p.n++;
        else per.set(nyckel, { x, y, n: 1 });
    }
    return [...per.values()].sort((a, b) => a.y - b.y || a.x - b.x);
}

/** Prickens radie: växer lite med antalet event på platsen. Små och jämna
 *  prickar låter Sveriges form träda fram (stora sken blir en klump i söder). */
export function prickRadie(n: number, bas = 3): number {
    return Math.min(bas * 1.6, bas * (1 + Math.log2(n) * 0.12));
}

/**
 * Prickarna som SVG: ett mjukt sken under (glow) och en skarp kärna ovanpå,
 * gult på genomskinligt (kortets mörkblå bakgrund syns igenom).
 */
export function prickSvg(p: Prick[], bredd: number, hojd: number, farg = '#FDE047'): string {
    const f = (n: number): string => (Math.round(n * 10) / 10).toString();
    const sken = p.map(d => `<circle cx="${f(d.x)}" cy="${f(d.y)}" r="${f(prickRadie(d.n) * 2.2)}"/>`).join('');
    const karna = p.map(d => `<circle cx="${f(d.x)}" cy="${f(d.y)}" r="${f(prickRadie(d.n))}"/>`).join('');
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${bredd}" height="${hojd}" viewBox="0 0 ${bredd} ${hojd}">`
        + `<g fill="${farg}" fill-opacity="0.07">${sken}</g>`
        + `<g fill="${farg}" fill-opacity="0.9">${karna}</g>`
        + '</svg>';
}
