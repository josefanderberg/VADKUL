import { ImageResponse } from 'next/og';
import { readFile } from 'fs/promises';
import path from 'path';
import type { CityEvent } from './cityData';
import { todayKey, weekKeys, countByDayKeys, pickRecommended } from './cityData';
import { formatCount, pickShareLines } from './cityShare';
import { sourceGradientCss, BRICKA_DARK_BG } from '@/components/v2/v2MapBricka';
import { EVENT_CATEGORIES, type EventCategoryType } from '@/utils/categories';

// Delningsbild för stads- och kategorisidorna (/evenemang/<stad>[/<kategori>]).
//
// Bakgrund (Josef 4/9): sidorna hade ingen egen og:image — sidans openGraph-
// objekt ersätter rotens, så rotens opengraph-image följde inte med, och
// Messenger/FB plockade i stället första <img> på sidan: en kartkakel med
// "kräver API-nyckel"-text. Nu samma look som sajtens bild (og-karta.jpg +
// scrim + ordmärke + guldpills) men med stadens namn, stadens siffror och tre
// kommande event. Renderas på begäran som /e/<slug>-bilden (låg volym: en
// hämtning per delning) och läser samma publika JSON:er som sidorna.

export const SHARE_IMAGE_SIZE = { width: 1200, height: 630 };

// ── Kartbotten per stad (Josef 4/9: "en bild över Stockholm på alla") ──────
// Esris gatukarta som rasterkakel (samma keyless leverantör som kartans
// satellitläge), monterade vid build: staden hamnar i bildens högra del
// (vänster täcks av scrim + text), med stadens egna event som brickor på
// riktiga positioner. Misslyckas en kakelhämtning faller vi tillbaka på
// og-karta.jpg — bilden får aldrig saknas.
// (Var Cartos raster-Voyager, men Carto vattenstämplar sedan slutet av aug -26
// nyckellösa rasterhämtningar med "API KEY REQUIRED" över hela kartan —
// vektorstilen som stora kartan använder är fortsatt fri. Byt inte tillbaka
// utan nyckel.)
const TILE = 256;
const MAP_ZOOM = 12;                       // som heron: hela stadskärnan
const CITY_ANCHOR = { x: 840, y: 315 };    // stadens mittpunkt i bilden
const BRICK_AREA = { x0: 640, x1: 1170, y0: 30, y1: 600 };
const MAX_BRICKS = 12;
const MIN_BRICK_DIST = 48;

function worldPx(lat: number, lng: number, zoom: number) {
    const scale = TILE * 2 ** zoom;
    const x = ((lng + 180) / 360) * scale;
    const sin = Math.sin((lat * Math.PI) / 180);
    const y = (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale;
    return { x, y };
}

export type TileFetcher = (url: string) => Promise<Buffer | null>;

const defaultTileFetcher: TileFetcher = async (url) => {
    try {
        const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
        if (!res.ok) return null;
        return Buffer.from(await res.arrayBuffer());
    } catch {
        return null;
    }
};

type Tile = { src: string; left: number; top: number };
type Brick = { emoji: string; left: number; top: number; bg: string; star: boolean };

async function cityTiles(city: { lat: number; lng: number }, fetchTile: TileFetcher): Promise<Tile[] | null> {
    const c = worldPx(city.lat, city.lng, MAP_ZOOM);
    const tlx = c.x - CITY_ANCHOR.x, tly = c.y - CITY_ANCHOR.y;
    const wanted: { tx: number; ty: number }[] = [];
    for (let ty = Math.floor(tly / TILE); ty * TILE < tly + SHARE_IMAGE_SIZE.height; ty++)
        for (let tx = Math.floor(tlx / TILE); tx * TILE < tlx + SHARE_IMAGE_SIZE.width; tx++)
            wanted.push({ tx, ty });
    const bufs = await Promise.all(wanted.map(({ tx, ty }) =>
        fetchTile(`https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/${MAP_ZOOM}/${ty}/${tx}`)));
    if (bufs.some(b => !b)) return null;
    return wanted.map(({ tx, ty }, i) => ({
        src: `data:image/png;base64,${bufs[i]!.toString('base64')}`,
        left: Math.round(tx * TILE - tlx),
        top: Math.round(ty * TILE - tly),
    }));
}

/** Brick-bakgrund ur kategorin — samma markerHex + gradient som kartans
 *  GL-brickor (och stadssidans hero), så bilden färgmatchar riktiga kartan. */
function brickBg(category: string): string {
    const cat = EVENT_CATEGORIES[category as EventCategoryType] as { markerHex?: string } | undefined;
    return cat?.markerHex ? sourceGradientCss(cat.markerHex) : BRICKA_DARK_BG;
}

/** Stadens event som brickor i kartans synliga högerdel — rekommenderade
 *  först, glest (min 48 px), max 12. Brickorna bär kategori-gradienten och
 *  den första (bästa rekommenderade) får ⭐ — som stjärnmärkta event på
 *  riktiga kartan. Exporterad för test. */
export function cityBricks(city: { lat: number; lng: number }, events: CityEvent[], now = Date.now()): Brick[] {
    const c = worldPx(city.lat, city.lng, MAP_ZOOM);
    const tlx = c.x - CITY_ANCHOR.x, tly = c.y - CITY_ANCHOR.y;
    const to = now + 7 * 864e5;
    const upcoming = events.filter(e => e.lat && e.lng && new Date(e.time).getTime() >= now - 36e5 && new Date(e.time).getTime() < to);
    const ordered = [...pickRecommended(upcoming, 20), ...upcoming];
    const seen = new Set<string>();
    const out: Brick[] = [];
    for (const e of ordered) {
        if (out.length >= MAX_BRICKS || seen.has(e.id)) continue;
        seen.add(e.id);
        const p = worldPx(e.lat, e.lng, MAP_ZOOM);
        const left = p.x - tlx, top = p.y - tly;
        if (left < BRICK_AREA.x0 || left > BRICK_AREA.x1 || top < BRICK_AREA.y0 || top > BRICK_AREA.y1) continue;
        if (out.some(b => Math.hypot(b.left - left, b.top - top) < MIN_BRICK_DIST)) continue;
        out.push({ emoji: e.emoji || '🎉', left: Math.round(left), top: Math.round(top), bg: brickBg(e.category), star: out.length === 0 });
    }
    return out;
}
export const SHARE_IMAGE_CONTENT_TYPE = 'image/png';

// Google Fonts ger TTF (satori kräver det) utan modern User-Agent. Miss →
// standardfont, aldrig ett fel som fäller bilden.
async function loadGoogleFont(cssUrl: string): Promise<ArrayBuffer | null> {
    try {
        const css = await fetch(cssUrl, { headers: { 'User-Agent': 'curl/8' } }).then((r) => r.text());
        const url = css.match(/src:\s*url\((https:[^)]+)\)\s*format\('truetype'\)/)?.[1];
        if (!url) return null;
        return await fetch(url).then((r) => r.arrayBuffer());
    } catch {
        return null;
    }
}
const loadFredoka = () => loadGoogleFont('https://fonts.googleapis.com/css2?family=Fredoka:wght@600&display=swap');
const loadInterBlackItalic = () => loadGoogleFont('https://fonts.googleapis.com/css2?family=Inter:ital,wght@1,900&display=swap');

async function readPublic(file: string): Promise<Buffer | null> {
    try {
        return await readFile(path.join(process.cwd(), 'public', file));
    } catch {
        return null;
    }
}

const PILL: React.CSSProperties = {
    position: 'relative',
    display: 'flex',
    alignItems: 'baseline',
    overflow: 'hidden',
    background: 'linear-gradient(90deg, #006AA7, #004B78)',
    border: '3px solid #FECC02',
    color: '#ffffff',
    padding: '4px 22px 8px',
    borderRadius: 999,
    boxShadow: '0 0 24px rgba(254, 204, 2, 0.35), 0 8px 24px rgba(2, 30, 55, 0.5)',
};
const PILL_GLOSS: React.CSSProperties = {
    position: 'absolute', top: 4, left: 14, right: 14, height: '44%', borderRadius: 999, display: 'flex',
    background: 'linear-gradient(180deg, rgba(255,255,255,0.30) 0%, rgba(255,255,255,0.10) 65%, rgba(255,255,255,0) 100%)',
};

export async function renderCityShareImage(opts: {
    headline: string; kicker: string; events: CityEvent[];
    /** Stadens mittpunkt → riktig kartbotten över staden med event-brickor. Utan: og-karta.jpg. */
    city?: { lat: number; lng: number };
    tileFetcher?: TileFetcher;
}) {
    const [fredoka, interBlackItalic, kartaJpg, iconPng, tiles] = await Promise.all([
        loadFredoka(),
        loadInterBlackItalic(),
        readPublic('og-karta.jpg'),
        readPublic('pwa-icon-512.png'),
        opts.city ? cityTiles(opts.city, opts.tileFetcher ?? defaultTileFetcher) : Promise.resolve(null),
    ]);
    const bricks = opts.city && tiles ? cityBricks(opts.city, opts.events) : [];
    const kartaSrc = kartaJpg ? `data:image/jpeg;base64,${kartaJpg.toString('base64')}` : null;
    const iconSrc = iconPng ? `data:image/png;base64,${iconPng.toString('base64')}` : null;

    const today = countByDayKeys(opts.events, [todayKey()]);
    const week = countByDayKeys(opts.events, weekKeys());
    const lines = pickShareLines(opts.events, 5);
    const headlineSize = opts.headline.length > 30 ? 44 : 54;

    return new ImageResponse(
        (
            <div style={{ width: '100%', height: '100%', display: 'flex', position: 'relative', fontFamily: 'Fredoka, sans-serif', background: '#052846' }}>
                {tiles ? tiles.map((t, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={i} src={t.src} width={TILE} height={TILE} alt="" style={{ position: 'absolute', left: t.left, top: t.top }} />
                )) : kartaSrc && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={kartaSrc} width={1200} height={630} alt="" style={{ position: 'absolute', top: 0, left: 0 }} />
                )}
                {/* Stadens event som brickor på riktiga positioner (bara på riktig
                    kartbotten): samma nål-droppe som kartans GL-brickor — rundad
                    kvadrat med tre runda hörn, roterad 45° så spetsen (det fjärde)
                    pekar nedåt mot koordinaten — i kategori-gradienten, med ⭐ vid
                    axeln på den bästa rekommenderade (som stjärnmärkta på kartan). */}
                {bricks.map((b, i) => (
                    <div key={`b${i}`} style={{ position: 'absolute', left: b.left - 22, top: b.top - 53, width: 44, height: 44, borderRadius: '999px 999px 0 999px', background: b.bg, border: '2px solid rgba(255,255,255,0.4)', transform: 'rotate(45deg)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(2, 30, 55, 0.45)' }}>
                        <div style={{ display: 'flex', transform: 'rotate(-45deg)', fontSize: 24, lineHeight: 1 }}>{b.emoji}</div>
                    </div>
                ))}
                {bricks.filter(b => b.star).map((b, i) => (
                    <div key={`s${i}`} style={{ position: 'absolute', left: b.left + 8, top: b.top - 63, display: 'flex', fontSize: 20, textShadow: '0 2px 6px rgba(2, 30, 55, 0.6)' }}>⭐</div>
                ))}
                {tiles && (
                    <div style={{ position: 'absolute', right: 10, bottom: 6, fontSize: 14, color: 'rgba(5,40,70,0.75)', background: 'rgba(255,255,255,0.7)', padding: '2px 8px', borderRadius: 6, display: 'flex' }}>© Esri © OpenStreetMap</div>
                )}
                {/* Scrim: mörkare och bredare än rotens — här bär vänsterhalvan
                    både rubrik, pills och tre eventrader. */}
                <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', background: 'linear-gradient(100deg, rgba(5,40,70,0.92) 0%, rgba(5,40,70,0.80) 40%, rgba(5,40,70,0.30) 62%, rgba(5,40,70,0) 75%)' }} />

                <div style={{ position: 'absolute', top: 28, left: 52, right: 52, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                    {/* Ordmärke, mindre än på rotens bild — staden är huvudsaken */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        {iconSrc && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={iconSrc} width={54} height={54} alt="" />
                        )}
                        <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 34, fontWeight: 900, fontStyle: 'italic', color: '#ffffff', letterSpacing: -1.5, textShadow: '0 4px 16px rgba(2, 30, 55, 0.75)', display: 'flex' }}>VADKUL</div>
                        <div style={{ marginLeft: 4, width: 70, height: 6, borderRadius: 999, background: '#FECC02', display: 'flex' }} />
                    </div>

                    <div style={{ marginTop: 14, fontSize: 20, fontWeight: 600, letterSpacing: 4, color: '#eaf6ff', textShadow: '0 2px 10px rgba(2, 30, 55, 0.75)', display: 'flex' }}>
                        {opts.kicker}
                    </div>
                    <div style={{ marginTop: 2, fontSize: headlineSize, fontWeight: 600, color: '#ffffff', lineHeight: 1.1, maxWidth: 860, textShadow: '0 5px 22px rgba(2, 30, 55, 0.8)', display: 'flex' }}>
                        {opts.headline}
                    </div>

                    {/* Siffrorna: stadens egna (bakas vid hämtning, inte golv som på roten) */}
                    <div style={{ marginTop: 12, display: 'flex', gap: 14 }}>
                        {today > 0 && (
                            <div style={PILL}>
                                <div style={PILL_GLOSS} />
                                <div style={{ display: 'flex', fontSize: 38, fontWeight: 600, color: '#FECC02' }}>{formatCount(today)}</div>
                                <div style={{ display: 'flex', fontSize: 22, fontWeight: 600, marginLeft: 10 }}>idag</div>
                            </div>
                        )}
                        <div style={PILL}>
                            <div style={PILL_GLOSS} />
                            <div style={{ display: 'flex', fontSize: 38, fontWeight: 600, color: '#FECC02' }}>{formatCount(week > 0 ? week : opts.events.length)}</div>
                            <div style={{ display: 'flex', fontSize: 22, fontWeight: 600, marginLeft: 10 }}>{week > 0 ? 'i veckan' : 'evenemang'}</div>
                        </div>
                    </div>

                    {/* Veckans fem bästa som brickrader — "headern med event på" */}
                    {lines.length > 0 && (
                        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 7 }}>
                            {lines.map((l, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(255,255,255,0.92)', borderRadius: 999, padding: '4px 20px 4px 6px', boxShadow: '0 6px 18px rgba(2, 30, 55, 0.35)' }}>
                                    <div style={{ width: 40, height: 40, borderRadius: 999, background: '#e6f3fb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>{l.emoji}</div>
                                    <div style={{ display: 'flex', fontSize: 23, fontWeight: 600, color: '#052846' }}>{l.title}</div>
                                    <div style={{ display: 'flex', fontSize: 19, color: '#0369a1', marginLeft: 2 }}>{l.when}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        ),
        {
            ...SHARE_IMAGE_SIZE,
            emoji: 'twemoji',
            fonts: fredoka || interBlackItalic
                ? [
                      ...(fredoka ? [{ name: 'Fredoka', data: fredoka, weight: 600 as const, style: 'normal' as const }] : []),
                      ...(interBlackItalic ? [{ name: 'Inter', data: interBlackItalic, weight: 900 as const, style: 'italic' as const }] : []),
                  ]
                : undefined,
        },
    );
}
