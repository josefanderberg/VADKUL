import { ImageResponse } from 'next/og';
import { readFile } from 'fs/promises';
import path from 'path';

/**
 * Annonsbild 1080×1080 (FB/IG-flöde) riktad mot aktiva seniorer, med fokus på
 * att man kan SKAPA EGNA EVENT. Ingen live-siffra — budskapet är funktionen,
 * inte volymen. Hämta:
 *
 *   curl -o annons-senior.png https://vadkul.se/api/marketing/ad-senior
 */
export const dynamic = 'force-dynamic';

async function loadFredoka(): Promise<ArrayBuffer | null> {
    try {
        const css = await fetch(
            'https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600&display=swap',
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
    const [fredoka, iconPng] = await Promise.all([
        loadFredoka(),
        readFile(path.join(process.cwd(), 'public', 'pwa-icon-512.png')),
    ]);
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
                    padding: '64px 70px 56px',
                    background: 'linear-gradient(180deg, #bae6fd 0%, #7dd3fc 42%, #fef3c7 72%, #fcd34d 100%)',
                    fontFamily: 'Fredoka, sans-serif',
                    position: 'relative',
                    textAlign: 'center',
                }}
            >
                {/* Sol */}
                <div style={{ position: 'absolute', top: 64, right: 78, width: 140, height: 140, borderRadius: 999, background: '#fde047', boxShadow: '0 0 90px 40px rgba(253, 224, 71, 0.65)', display: 'flex' }} />
                {/* Småmoln */}
                <div style={{ position: 'absolute', top: 96, left: 70, width: 190, height: 60, borderRadius: 999, background: 'rgba(255,255,255,0.65)', display: 'flex' }} />
                <div style={{ position: 'absolute', top: 200, right: 260, width: 130, height: 46, borderRadius: 999, background: 'rgba(255,255,255,0.5)', display: 'flex' }} />

                {/* Kullar (samma gröna som kartans nöjesfältsland) */}
                <div style={{ position: 'absolute', bottom: -330, left: -420, width: 1200, height: 560, borderRadius: '50%', background: '#79ab55', display: 'flex' }} />
                <div style={{ position: 'absolute', bottom: -370, right: -430, width: 1300, height: 580, borderRadius: '50%', background: '#93c46c', display: 'flex' }} />

                {/* Event-brickor på kullarna, som markörerna på kartan */}
                <div style={{ position: 'absolute', bottom: 150, left: 96, width: 96, height: 96, borderRadius: 999, background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 50, boxShadow: '0 8px 20px rgba(60, 90, 40, 0.35)' }}>🥾</div>
                <div style={{ position: 'absolute', bottom: 120, right: 84, width: 96, height: 96, borderRadius: 999, background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 50, boxShadow: '0 8px 20px rgba(60, 90, 40, 0.35)' }}>🎣</div>

                {/* Logga + ordmärke */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={iconSrc} width={110} height={110} alt="" />
                    <div style={{ fontSize: 54, fontWeight: 600, color: '#ffffff', letterSpacing: 3, textShadow: '0 4px 16px rgba(3, 105, 161, 0.4)', display: 'flex' }}>VADKUL</div>
                </div>

                {/* Rubrik */}
                <div
                    style={{
                        marginTop: 34,
                        fontSize: 82,
                        fontWeight: 600,
                        color: '#ffffff',
                        lineHeight: 1.12,
                        maxWidth: 900,
                        textShadow: '0 6px 24px rgba(3, 105, 161, 0.45)',
                        display: 'flex',
                        justifyContent: 'center',
                    }}
                >
                    Äventyret går inte i pension.
                </div>
                <div style={{ marginTop: 22, fontSize: 40, color: '#075985', lineHeight: 1.3, maxWidth: 860, display: 'flex', justifyContent: 'center' }}>
                    Se allt som händer nära dig på en karta — eller skapa ditt eget event och bjud in fler.
                </div>

                {/* Mockat eventkort: visar skapa-eget-funktionen */}
                <div
                    style={{
                        marginTop: 42,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 20,
                        background: '#ffffff',
                        borderRadius: 36,
                        padding: '30px 38px',
                        boxShadow: '0 16px 40px rgba(60, 90, 40, 0.3)',
                        width: 720,
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 24, textAlign: 'left' }}>
                        <div style={{ width: 92, height: 92, borderRadius: 999, background: '#f0f9ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 50, flexShrink: 0 }}>☕</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <div style={{ fontSize: 38, fontWeight: 600, color: '#0f172a', display: 'flex' }}>Onsdagsvandring med fika</div>
                            <div style={{ fontSize: 28, color: '#64748b', display: 'flex' }}>Skapat av Gunnel · 14 kommer</div>
                        </div>
                    </div>
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: '#79ab55',
                            color: '#ffffff',
                            fontSize: 32,
                            fontWeight: 600,
                            padding: '16px 0',
                            borderRadius: 999,
                        }}
                    >
                        + Skapa ditt eget event
                    </div>
                </div>

                {/* CTA */}
                <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
                    <div
                        style={{
                            display: 'flex',
                            background: '#ffffff',
                            color: '#0284c7',
                            fontSize: 44,
                            fontWeight: 600,
                            padding: '18px 52px',
                            borderRadius: 999,
                            boxShadow: '0 10px 28px rgba(60, 90, 40, 0.35)',
                        }}
                    >
                        vadkul.se
                    </div>
                    <div style={{ fontSize: 27, color: '#ffffff', textShadow: '0 2px 8px rgba(60, 90, 40, 0.5)', display: 'flex' }}>Gratis · Ingen app behövs</div>
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
