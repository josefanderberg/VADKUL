import { ImageResponse } from 'next/og';
import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';

/**
 * Kartbild 1080×1080 för en GODTYCKLIG plats — riktiga karttiles med ortens
 * kommande event som gula prickar ovanpå.
 *
 *   curl -o hudiksvall.png "https://vadkul.se/api/marketing/ad-plats?lat=61.73&lng=17.10&namn=Hudiksvall"
 *   curl -o ren.png "…&stil=karta"
 *
 * TVÅ STILAR, för att de två ytorna tål olika mycket varumärke:
 *
 *   stil=annons (default) — logga, siffra, vadkul.se-pill. Till VADKUL-SIDAN
 *       och till annonser, där vi öppet ÄR avsändaren.
 *   stil=karta — bara kartan och en diskret bildtext. Till FACEBOOKGRUPPERNA.
 *       En annonsbild i en lokalgrupp läses som reklam, och det var precis vad
 *       som fällde Gotland (72 likes, borttaget som "reklam") och Mölndal. En
 *       ren karta är inte reklam, den är ett bevis.
 *
 * Varför inte ad/[stad]? Den kräver en post i CITIES (45 städer med stadssida).
 * Två tredjedelar av facebookgrupperna ligger på orter utan — Kvänum, Byske,
 * Gagnef — och de behöver också en bild.
 *
 * ⚠️ Schemalägger du ett facebookinlägg med bilden hämtar Meta den vid
 * SCHEMALÄGGNINGEN, inte vid publiceringen. Bilden fryser. Se
 * schedule-city-posts.ts — den vägrar därför daterat innehåll längre än 7 dygn fram.
 */
export const dynamic = 'force-dynamic';

const TILE = 256;

const mercY = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));

/** Webbmercator världspixel — samma formel som CityMapHero. */
function project(lat: number, lng: number, zoom: number) {
    const scale = TILE * 2 ** zoom;
    const s = Math.sin((lat * Math.PI) / 180);
    return {
        x: ((lng + 180) / 360) * scale,
        y: (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * scale,
    };
}

/** Zoom så att panelen täcker ~2,2 × radien. Heltal — kakel finns bara så. */
function zoomFor(lat: number, radiusKm: number, panelPx: number): number {
    const metersWanted = 2.2 * radiusKm * 1000;
    const z = Math.log2((156543.03392 * Math.cos((lat * Math.PI) / 180) * panelPx) / metersWanted);
    return Math.max(6, Math.min(13, Math.round(z)));
}

type DestEvent = { time: string; lat?: number; lng?: number };

async function loadFredoka(): Promise<ArrayBuffer | null> {
    try {
        const css = await fetch(
            'https://fonts.googleapis.com/css2?family=Fredoka:wght@600&display=swap',
            { headers: { 'User-Agent': 'curl/8' } },
        ).then((r) => r.text());
        const url = css.match(/src:\s*url\((https:[^)]+)\)\s*format\('truetype'\)/)?.[1];
        if (!url) return null;
        return await fetch(url).then((r) => r.arrayBuffer());
    } catch {
        return null;
    }
}

/**
 * Hämtar kaklen serverside och bakar in dem som data-URI:er.
 *
 * Varför inte låta satori hämta dem själv? För att ETT dött kakel då fäller
 * hela bildgenereringen. Här faller ett trasigt kakel bara bort och lämnar ett
 * hål — bilden blir fortfarande användbar.
 */
async function loadTiles(
    center: { x: number; y: number }, zoom: number, w: number, h: number,
): Promise<{ src: string; left: number; top: number }[]> {
    const cols = Math.ceil(w / TILE) + 2;
    const rows = Math.ceil(h / TILE) + 2;
    const ctx = Math.floor(center.x / TILE);
    const cty = Math.floor(center.y / TILE);
    const max = 2 ** zoom;

    const wanted: { tx: number; ty: number }[] = [];
    for (let dx = -Math.floor(cols / 2); dx <= Math.floor(cols / 2); dx++) {
        for (let dy = -Math.floor(rows / 2); dy <= Math.floor(rows / 2); dy++) {
            const tx = ctx + dx, ty = cty + dy;
            if (tx < 0 || ty < 0 || tx >= max || ty >= max) continue;
            wanted.push({ tx, ty });
        }
    }

    const results = await Promise.allSettled(wanted.map(async ({ tx, ty }) => {
        // Esris gatukarta — Carto vattenstämplar sedan slutet av aug -26
        // nyckellösa rasterkakel med "API KEY REQUIRED". Obs z/y/x-ordning.
        const url = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/${zoom}/${ty}/${tx}`;
        const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
        if (!res.ok) throw new Error(String(res.status));
        const buf = Buffer.from(await res.arrayBuffer());
        return {
            src: `data:image/png;base64,${buf.toString('base64')}`,
            left: Math.round(w / 2 + (tx * TILE - center.x)),
            top: Math.round(h / 2 + (ty * TILE - center.y)),
        };
    }));

    return results.flatMap(r => (r.status === 'fulfilled' ? [r.value] : []));
}

export async function GET(request: Request) {
    const q = new URL(request.url).searchParams;

    const lat = Number(q.get('lat'));
    const lng = Number(q.get('lng'));
    // Sverigeramen är samma som aggregatens — utanför den är det ett skrivfel,
    // inte en ort, och en bild på Nordsjön hjälper ingen.
    if (!Number.isFinite(lat) || !Number.isFinite(lng) ||
        lat < 55 || lat > 69.3 || lng < 10.5 || lng > 24.6) {
        return NextResponse.json({ error: 'lat/lng saknas eller ligger utanför Sverige' }, { status: 400 });
    }

    const namn = (q.get('namn') ?? '').trim().slice(0, 40) || 'din stad';
    const radieKm = Math.min(Math.max(Number(q.get('radie')) || 25, 5), 120);
    const dagar = Math.min(Math.max(Number(q.get('dagar')) || 7, 1), 30);
    const ren = q.get('stil') === 'karta';

    const W = 1080;
    // Annonsstilen: rubrikblocket är klart runt y≈360, så kartan börjar där —
    // ett tomt blåfält däremellan ser ut som ett renderingsfel.
    const MAP_TOP = ren ? 0 : 380;
    const MAP_H = 1080 - MAP_TOP;

    const zoom = zoomFor(lat, radieKm, W);
    const center = project(lat, lng, zoom);

    const pub = path.join(process.cwd(), 'public');
    const [fredoka, iconPng, destRaw, tiles] = await Promise.all([
        loadFredoka(),
        readFile(path.join(pub, 'pwa-icon-512.png')),
        readFile(path.join(pub, 'events-destinations.json'), 'utf8'),
        loadTiles(center, zoom, W, MAP_H),
    ]);
    const iconSrc = `data:image/png;base64,${iconPng.toString('base64')}`;
    const events: DestEvent[] = JSON.parse(destRaw).events ?? [];

    const now = Date.now();
    const horizon = now + dagar * 86_400_000;

    // Prickarna: projicera i samma mercator som kaklen, dedupe:a per ~150 m så
    // att tio spelningar på samma scen blir EN prick.
    const cells = new Map<string, { x: number; y: number }>();
    let count = 0;
    for (const e of events) {
        const t = Date.parse(e.time);
        if (!(t >= now && t < horizon)) continue;
        const { lat: eLat, lng: eLng } = e;
        if (typeof eLat !== 'number' || typeof eLng !== 'number') continue;

        const p = project(eLat, eLng, zoom);
        const x = W / 2 + (p.x - center.x);
        const y = MAP_H / 2 + (p.y - center.y);
        if (x < -20 || x > W + 20 || y < -20 || y > MAP_H + 20) continue;

        count++;
        const key = `${Math.round(eLat / 0.0015)}:${Math.round(eLng / 0.0015)}`;
        if (!cells.has(key)) cells.set(key, { x, y });
    }
    const dots = [...cells.values()];

    const rubrik = dagar === 7
        ? `saker att göra i ${namn} den här veckan.`
        : `saker att göra i ${namn} de närmaste ${dagar} dagarna.`;

    /* ── Kartlagret: kakel + prickar, delas av båda stilarna ── */
    const mapLayer = (
        <div style={{
            position: 'absolute', left: 0, top: MAP_TOP, width: W, height: MAP_H,
            display: 'flex', overflow: 'hidden', background: '#e8e3dc',
        }}>
            {tiles.map((t, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={t.src} width={TILE} height={TILE} alt=""
                    style={{ position: 'absolute', left: t.left, top: t.top }} />
            ))}
            <svg width={W} height={MAP_H} viewBox={`0 0 ${W} ${MAP_H}`} style={{ position: 'absolute', left: 0, top: 0 }}>
                {dots.map((d, i) => (
                    <g key={i}>
                        <circle cx={d.x} cy={d.y} r={13} fill="#ffffff" opacity={0.9} />
                        <circle cx={d.x} cy={d.y} r={9} fill="#f59e0b" />
                    </g>
                ))}
            </svg>
        </div>
    );

    /* ── stil=karta: bara kartan + diskret bildtext ── */
    if (ren) {
        return new ImageResponse(
            (
                <div style={{
                    width: '100%', height: '100%', display: 'flex', position: 'relative',
                    fontFamily: 'Fredoka, sans-serif', background: '#e8e3dc',
                }}>
                    {mapLayer}
                    <div style={{
                        position: 'absolute', left: 0, right: 0, bottom: 0, height: 150,
                        display: 'flex', flexDirection: 'column', justifyContent: 'center',
                        padding: '0 56px', background: 'rgba(8, 47, 73, 0.88)',
                    }}>
                        <div style={{ fontSize: 52, fontWeight: 600, color: '#ffffff', display: 'flex' }}>
                            {`${count} saker att göra i ${namn}`}
                        </div>
                        <div style={{ fontSize: 30, color: '#fde047', display: 'flex', marginTop: 6 }}>
                            {dagar === 7 ? 'den här veckan' : `de närmaste ${dagar} dagarna`}
                        </div>
                    </div>
                </div>
            ),
            {
                width: 1080, height: 1080,
                fonts: fredoka ? [{ name: 'Fredoka', data: fredoka, weight: 600 as const, style: 'normal' as const }] : undefined,
            },
        );
    }

    /* ── stil=annons: budskap överst, karta under ── */
    return new ImageResponse(
        (
            <div style={{
                width: '100%', height: '100%', display: 'flex', position: 'relative',
                fontFamily: 'Fredoka, sans-serif',
                background: 'linear-gradient(160deg, #082f49 0%, #0c4a6e 60%, #075985 100%)',
            }}>
                {mapLayer}

                <div style={{
                    position: 'absolute', left: 0, top: 0, width: W, height: MAP_TOP + 10,
                    display: 'flex', flexDirection: 'column', padding: '54px 70px 0 70px',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={iconSrc} width={88} height={88} alt="" />
                        <div style={{ fontSize: 44, fontWeight: 600, color: '#ffffff', letterSpacing: 3, display: 'flex' }}>VADKUL</div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 26, marginTop: 34 }}>
                        <div style={{
                            fontSize: 150, fontWeight: 600, color: '#fde047', lineHeight: 0.9,
                            textShadow: '0 0 50px rgba(253, 224, 71, 0.45)', display: 'flex',
                        }}>
                            {count.toLocaleString('sv-SE')}
                        </div>
                        <div style={{
                            fontSize: 44, fontWeight: 600, color: '#ffffff', lineHeight: 1.15,
                            maxWidth: 640, paddingBottom: 12, display: 'flex',
                        }}>
                            {rubrik}
                        </div>
                    </div>
                </div>

                {/* vadkul.se-pillen ligger PÅ kartan, nere till vänster */}
                <div style={{
                    position: 'absolute', left: 70, bottom: 54, display: 'flex',
                    background: '#ffffff', color: '#0284c7', fontSize: 40, fontWeight: 600,
                    padding: '16px 46px', borderRadius: 999,
                    boxShadow: '0 10px 30px rgba(2, 8, 23, 0.45)',
                }}>
                    vadkul.se
                </div>
            </div>
        ),
        {
            width: 1080, height: 1080,
            fonts: fredoka ? [{ name: 'Fredoka', data: fredoka, weight: 600 as const, style: 'normal' as const }] : undefined,
        },
    );
}
