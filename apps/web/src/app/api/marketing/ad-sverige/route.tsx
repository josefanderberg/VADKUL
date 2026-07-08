import { ImageResponse } from 'next/og';
import { readFile } from 'fs/promises';
import path from 'path';

/**
 * Annonsbild 1080×1080 (FB/IG): hela Sverige uppritat av eventprickarna —
 * varje prick är ett RIKTIGT kommande event ur events-destinations.json, och
 * antalet i rubriken räknas live när bilden hämtas:
 *
 *   curl -o annons-sverige.png https://vadkul.se/api/marketing/ad-sverige
 *
 * Är dagens antal ≥ 1000 blir raden "bara idag", annars faller den tillbaka
 * på veckans antal — påståendet i bilden är alltid sant.
 */
export const dynamic = 'force-dynamic';

const LAT_MIN = 55.0, LAT_MAX = 69.3, LNG_MIN = 10.5, LNG_MAX = 24.6;
const mercY = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
const Y_TOP = mercY(LAT_MAX), Y_BOT = mercY(LAT_MIN);

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

export async function GET() {
    const pub = path.join(process.cwd(), 'public');
    const [fredoka, iconPng, destRaw] = await Promise.all([
        loadFredoka(),
        readFile(path.join(pub, 'pwa-icon-512.png')),
        readFile(path.join(pub, 'events-destinations.json'), 'utf8'),
    ]);
    const iconSrc = `data:image/png;base64,${iconPng.toString('base64')}`;
    const events: DestEvent[] = JSON.parse(destRaw).events ?? [];

    const now = Date.now();
    const todayCount = events.filter((e) => {
        const t = Date.parse(e.time);
        return t >= now && t < now + 86_400_000;
    }).length;
    const weekCount = events.filter((e) => {
        const t = Date.parse(e.time);
        return t >= now && t < now + 7 * 86_400_000;
    }).length;
    const useToday = todayCount >= 1000;
    const count = useToday ? todayCount : weekCount;
    const countLabel = useToday ? 'event i Sverige – bara idag.' : 'event i Sverige den här veckan.';

    // Prick-kartan: kommande veckans event, dedupe:ade per ~1 km-cell så att
    // hundra event på samma scen blir EN prick och Sveriges form träder fram.
    const cells = new Map<string, { x: number; y: number }>();
    const MAP_H = 930;
    const MAP_W = Math.round(MAP_H * (((LNG_MAX - LNG_MIN) * Math.PI) / 180) / (Y_TOP - Y_BOT));
    for (const e of events) {
        const t = Date.parse(e.time);
        if (!(t >= now && t < now + 7 * 86_400_000)) continue;
        const { lat, lng } = e;
        if (typeof lat !== 'number' || typeof lng !== 'number') continue;
        if (lat < LAT_MIN || lat > LAT_MAX || lng < LNG_MIN || lng > LNG_MAX) continue;
        const key = `${Math.round(lat / 0.012)}:${Math.round(lng / 0.012)}`;
        if (cells.has(key)) continue;
        cells.set(key, {
            x: ((lng - LNG_MIN) / (LNG_MAX - LNG_MIN)) * MAP_W,
            y: ((Y_TOP - mercY(lat)) / (Y_TOP - Y_BOT)) * MAP_H,
        });
    }
    const dots = [...cells.values()];

    // Några stor-brickor som visar att prickarna är event (som kartans markörer)
    const brickor = [
        { lat: 59.33, lng: 18.06, emoji: '🎶' }, // Stockholm
        { lat: 57.71, lng: 11.97, emoji: '⚽' }, // Göteborg
        { lat: 55.61, lng: 13.0, emoji: '☕' },  // Malmö
        { lat: 63.83, lng: 20.26, emoji: '🎨' }, // Umeå
    ].map((b) => ({
        emoji: b.emoji,
        x: ((b.lng - LNG_MIN) / (LNG_MAX - LNG_MIN)) * MAP_W,
        y: ((Y_TOP - mercY(b.lat)) / (Y_TOP - Y_BOT)) * MAP_H,
    }));

    const rows = [
        { emoji: '🗺️', text: 'Allt samlat på en karta' },
        { emoji: '➕', text: 'Skapa dina egna event' },
        { emoji: '📣', text: 'Dela med ett klick' },
    ];

    return new ImageResponse(
        (
            <div
                style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    background: 'linear-gradient(160deg, #082f49 0%, #0c4a6e 55%, #075985 100%)',
                    fontFamily: 'Fredoka, sans-serif',
                    position: 'relative',
                }}
            >
                {/* Prick-Sverige till höger: varje prick = ett riktigt event */}
                <svg
                    width={MAP_W}
                    height={MAP_H}
                    viewBox={`0 0 ${MAP_W} ${MAP_H}`}
                    style={{ position: 'absolute', right: 14, top: 64 }}
                >
                    {dots.map((d, i) => (
                        <circle
                            key={i}
                            cx={d.x}
                            cy={d.y}
                            r={3.4}
                            fill="#fde047"
                            opacity={0.85}
                        />
                    ))}
                </svg>
                {brickor.map((b, i) => (
                    <div
                        key={i}
                        style={{
                            position: 'absolute',
                            left: 1080 - MAP_W - 14 + b.x - 34,
                            top: 64 + b.y - 34,
                            width: 68,
                            height: 68,
                            borderRadius: 999,
                            background: '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 34,
                            boxShadow: '0 0 24px rgba(253, 224, 71, 0.55)',
                        }}
                    >
                        {b.emoji}
                    </div>
                ))}

                {/* Vänsterspalt: budskapet */}
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-start',
                        padding: '60px 0 56px 70px',
                        width: 620,
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={iconSrc} width={96} height={96} alt="" />
                        <div style={{ fontSize: 48, fontWeight: 600, color: '#ffffff', letterSpacing: 3, display: 'flex' }}>VADKUL</div>
                    </div>

                    <div
                        style={{
                            marginTop: 48,
                            fontSize: 172,
                            fontWeight: 600,
                            color: '#fde047',
                            lineHeight: 1,
                            textShadow: '0 0 50px rgba(253, 224, 71, 0.45)',
                            display: 'flex',
                        }}
                    >
                        {count.toLocaleString('sv-SE')}
                    </div>
                    <div style={{ marginTop: 18, fontSize: 52, fontWeight: 600, color: '#ffffff', lineHeight: 1.2, maxWidth: 470, display: 'flex' }}>
                        {countLabel}
                    </div>
                    <div style={{ marginTop: 14, fontSize: 30, color: '#bae6fd', display: 'flex' }}>
                        Varje gul prick är något som händer.
                    </div>

                    <div style={{ marginTop: 44, display: 'flex', flexDirection: 'column', gap: 22 }}>
                        {rows.map((r, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
                                <div style={{ width: 62, height: 62, borderRadius: 999, background: 'rgba(255,255,255,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30 }}>{r.emoji}</div>
                                <div style={{ fontSize: 36, color: '#ffffff', display: 'flex' }}>{r.text}</div>
                            </div>
                        ))}
                    </div>

                    <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div
                            style={{
                                display: 'flex',
                                background: '#ffffff',
                                color: '#0284c7',
                                fontSize: 44,
                                fontWeight: 600,
                                padding: '18px 52px',
                                borderRadius: 999,
                                boxShadow: '0 10px 30px rgba(2, 8, 23, 0.45)',
                            }}
                        >
                            vadkul.se
                        </div>
                        <div style={{ fontSize: 26, color: '#bae6fd', display: 'flex' }}>Gratis · Ingen app behövs</div>
                    </div>
                </div>
            </div>
        ),
        {
            width: 1080,
            height: 1080,
            emoji: 'twemoji',
            fonts: fredoka
                ? [{ name: 'Fredoka', data: fredoka, weight: 600 as const, style: 'normal' as const }]
                : undefined,
        },
    );
}
