import { ImageResponse } from 'next/og';
import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';
import { CITIES, getCityEvents } from '@/app/(v1)/evenemang/cityData';

/**
 * Annonsbild 1080×1080 (FB/IG-flöde) med LIVE-siffror: antalet event kommande
 * 7 dagar räknas ur eventdatat när bilden hämtas — inför varje kampanjstart
 * laddar man bara ner färska bilder:
 *
 *   curl -o annons-malmo.png https://vadkul.se/api/marketing/ad/malmo
 *
 * Copyn följer marknadsföringsplanens huvudbudskap ("N saker att göra i X den
 * här veckan. En karta. Noll planering.").
 */
export const dynamic = 'force-dynamic';

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

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ stad: string }> },
) {
    const { stad } = await params;
    const city = CITIES.find(c => c.slug === stad);
    if (!city) return NextResponse.json({ error: 'Okänd stad' }, { status: 404 });

    const [{ events }, fredoka, iconPng] = await Promise.all([
        getCityEvents(city),
        loadFredoka(),
        readFile(path.join(process.cwd(), 'public', 'pwa-icon-512.png')),
    ]);
    const weekCount = events.filter(e => Date.parse(e.time) < Date.now() + 7 * 86_400_000).length;
    const iconSrc = `data:image/png;base64,${iconPng.toString('base64')}`;

    return new ImageResponse(
        (
            <div
                style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 36,
                    padding: 80,
                    background: 'linear-gradient(180deg, #7dd3fc 0%, #38bdf8 55%, #0ea5e9 100%)',
                    fontFamily: 'Fredoka, sans-serif',
                    position: 'relative',
                    textAlign: 'center',
                }}
            >
                <div style={{ position: 'absolute', top: 70, left: 80, width: 180, height: 60, borderRadius: 999, background: 'rgba(255,255,255,0.5)', display: 'flex' }} />
                <div style={{ position: 'absolute', top: 150, right: 90, width: 130, height: 48, borderRadius: 999, background: 'rgba(255,255,255,0.4)', display: 'flex' }} />
                <div style={{ position: 'absolute', bottom: 200, left: 110, width: 150, height: 52, borderRadius: 999, background: 'rgba(255,255,255,0.35)', display: 'flex' }} />

                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={iconSrc} width={230} height={230} alt="" />

                <div
                    style={{
                        fontSize: 76,
                        fontWeight: 600,
                        color: '#ffffff',
                        lineHeight: 1.15,
                        maxWidth: 880,
                        textShadow: '0 6px 24px rgba(3, 105, 161, 0.4)',
                        display: 'flex',
                        justifyContent: 'center',
                    }}
                >
                    {`${weekCount} saker att göra i ${city.name} den här veckan.`}
                </div>
                <div style={{ fontSize: 44, color: '#f0f9ff', display: 'flex' }}>
                    En karta. Noll planering.
                </div>
                <div
                    style={{
                        marginTop: 10,
                        display: 'flex',
                        background: '#ffffff',
                        color: '#0284c7',
                        fontSize: 42,
                        fontWeight: 600,
                        padding: '18px 46px',
                        borderRadius: 999,
                        boxShadow: '0 10px 28px rgba(3, 105, 161, 0.3)',
                    }}
                >
                    vadkul.se
                </div>
            </div>
        ),
        {
            width: 1080,
            height: 1080,
            fonts: fredoka
                ? [{ name: 'Fredoka', data: fredoka, weight: 600 as const, style: 'normal' as const }]
                : undefined,
        },
    );
}
