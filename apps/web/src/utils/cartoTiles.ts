// CARTO:s kakel och stadssidornas kartbilder (#205).
//
// CARTO tillåter att deras kakel visas direkt för besökare (§9.c.i) men
// förbjuder att vi cachar innehållet på vår server (§9.c.iii), och en
// förrenderad kartbild är just det. Därför måste scripts/render-city-maps.mjs
// rita bilderna ur EGNA kakel, och därför finns licensvakten.
//
// Modulen importeras både av webben (v2MapBaseStyles) och direkt av node i
// renderingsskriptet (typstrippning, node 22.18+). Den får därför INTE
// importera något och bara använda syntax som går att stryka: inga enum,
// inga namespace.

const CARTO_HOST = /(^|\.)cartocdn\.com$/i;
// Kakeladress med z/x/y på slutet: /12/2253/1205.mvt, /12/2253/1205@2x.png.
const TILE_PATH = /\/\d+\/\d+\/\d+(@\d+x)?\.[a-z0-9]+$/i;
// Stilens formgivning: style.json och sprite under /gl/, typsnitten under
// /fonts/. Den är BSD-3 och CC-BY och SKA hämtas från CARTO.
const STYLE_ASSET_DIR = /\/(gl|fonts)\//;

/**
 * Är adressen kartinnehåll från CARTO som inte får hamna i en förrenderad bild?
 *
 * Allt på cartocdn.com räknas som kartinnehåll UTOM stilens formgivning
 * (style.json, sprite, typsnitt). Okända adresser fäller alltså vakten: det är
 * den säkra riktningen. Den gamla vakten letade efter /vector/ i sökvägen och
 * missade v2-kaklen (/v/<datum>/vectortiles/...) när Voyager bytte i oktober.
 * Kakelmallar med {z}/{x}/{y} räknas också, så samma test hittar CARTO-källan
 * i stilen.
 */
export function isCartoTileUrl(url: string): boolean {
    let u: URL;
    try {
        u = new URL(url);
    } catch {
        return false;
    }
    if (!CARTO_HOST.test(u.hostname)) return false;
    if (TILE_PATH.test(u.pathname)) return true;
    return !STYLE_ASSET_DIR.test(u.pathname);
}

/** Är adressen ett vektorkakel (z/x/y.pbf eller .mvt), från vilken värd som helst? */
export function isVectorTileUrl(url: string): boolean {
    try {
        return /\/\d+\/\d+\/\d+\.(pbf|mvt)$/i.test(new URL(url).pathname);
    } catch {
        return false;
    }
}

/** Det lilla av en MapLibre-källa som källbytet behöver se. */
type SourceLike = {
    type?: string;
    url?: string;
    tiles?: string[];
    minzoom?: number;
    maxzoom?: number;
};

/**
 * Byter varje vektorkälla som hämtar kakel från CARTO mot våra egna kakel,
 * oavsett vad källan heter (förr `carto`, sedan oktober 2026 `protomaps`).
 * Källans id behålls, så stilens lager pekar fortfarande rätt. `egnaKakel` är
 * en kakelmall med {z}/{x}/{y} eller en TileJSON-adress. Returnerar id:n på
 * de källor som byttes.
 *
 * Kaklen måste följa SAMMA schema som stilen. Voyager är sedan oktober
 * skriven mot Protomaps-schemat, så de egna kaklen ska vara ett utdrag ur
 * Protomaps eget bygge (se docs/kartbilder.md), inte planetilers
 * OpenMapTiles-kakel.
 */
export function swapCartoVectorSources(
    style: { sources?: Record<string, SourceLike> },
    egnaKakel: string,
): string[] {
    const bytta: string[] = [];
    for (const [id, src] of Object.entries(style.sources ?? {})) {
        if (src?.type !== 'vector') continue;
        const adresser = [...(src.tiles ?? []), ...(src.url ? [src.url] : [])];
        if (!adresser.some(isCartoTileUrl)) continue;
        style.sources![id] = egnaKakel.includes('{z}')
            // Samma zoomspann som CARTO:s källa: deras kakel och Protomaps
            // bygge går båda till zoom 15.
            ? { type: 'vector', tiles: [egnaKakel], minzoom: src.minzoom ?? 0, maxzoom: src.maxzoom ?? 15 }
            : { type: 'vector', url: egnaKakel };
        bytta.push(id);
    }
    return bytta;
}

// Lager som bara finns i det ena schemat. Båda har water, landcover och
// landuse, så de säger inget.
const PROTOMAPS_ONLY = new Set(['earth', 'roads', 'places', 'boundaries', 'buildings', 'pois', 'transit']);
const OPENMAPTILES_ONLY = new Set([
    'transportation', 'transportation_name', 'place', 'boundary', 'building', 'poi',
    'waterway', 'water_name', 'aeroway', 'aerodrome_label', 'park', 'mountain_peak', 'housenumber',
]);

export type TileSchema = 'protomaps' | 'openmaptiles' | 'okänt';

/**
 * Vilket schema följer ett vektorkakel, utifrån lagernamnen? Fångar det
 * realistiska misstaget att servera den gamla sweden.pmtiles från planetiler
 * (OpenMapTiles) mot Voyagers Protomaps-stil: då ritas bara vatten och
 * bakgrund, och bilden kan ändå bli stor nog att passera tomhetsvakten.
 */
export function tileSchemaOf(layerNames: readonly string[]): TileSchema {
    if (layerNames.some(n => OPENMAPTILES_ONLY.has(n))) return 'openmaptiles';
    if (layerNames.some(n => PROTOMAPS_ONLY.has(n))) return 'protomaps';
    return 'okänt';
}

function readVarint(buf: Uint8Array, pos: number): [number, number] {
    let value = 0;
    let factor = 1;
    for (;;) {
        if (pos >= buf.length) throw new Error('vektorkaklet tar slut mitt i ett tal');
        const b = buf[pos++];
        value += (b & 0x7f) * factor;
        if (b < 0x80) return [value, pos];
        factor *= 128;
    }
}

/** Fälten i ett protobuf-meddelande: [fältnummer, wire-typ, start, slut] för längdfält. */
function* protoFields(buf: Uint8Array): Generator<[number, number, number, number]> {
    let pos = 0;
    while (pos < buf.length) {
        const [tag, p] = readVarint(buf, pos);
        pos = p;
        const field = Math.floor(tag / 8);
        const wire = tag % 8;
        if (wire === 2) {
            const [len, start] = readVarint(buf, pos);
            pos = start + len;
            if (pos > buf.length) throw new Error('vektorkaklet är avkapat');
            yield [field, wire, start, pos];
        } else if (wire === 0) {
            pos = readVarint(buf, pos)[1];
        } else if (wire === 1) {
            pos += 8;
        } else if (wire === 5) {
            pos += 4;
        } else {
            throw new Error(`inget vektorkakel (wire-typ ${wire})`);
        }
    }
}

/**
 * Lagernamnen i ett okomprimerat vektorkakel (MVT). Kaklet är ett protobuf
 * där fält 3 är lagren och lagrets fält 1 är dess namn. Tillräckligt för
 * schemakollen, utan att dra in ett avkodningsbibliotek i skriptet.
 */
export function mvtLayerNames(buf: Uint8Array): string[] {
    const names: string[] = [];
    const text = new TextDecoder();
    for (const [field, , start, end] of protoFields(buf)) {
        if (field !== 3) continue;
        const layer = buf.subarray(start, end);
        for (const [lf, , ls, le] of protoFields(layer)) {
            if (lf === 1) {
                names.push(text.decode(layer.subarray(ls, le)));
                break;
            }
        }
    }
    return names;
}
