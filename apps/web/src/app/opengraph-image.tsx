import { ImageResponse } from 'next/og';
import { readFile } from 'fs/promises';
import path from 'path';

// Delningsbilden (Open Graph) — det folk ser när en VADKUL-länk delas i
// Messenger/Facebook/iMessage m.fl. Renderas EN gång vid build (force-static),
// så fs-läsning och font-hämtning sker på byggmaskinen, inte per request.
export const dynamic = 'force-static';

export const alt = 'VADKUL – hitta events och saker att göra nära dig, på en karta';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// Google Fonts serverar TTF (som satori kräver — inte woff2) när requesten
// saknar modern User-Agent. Misslyckas hämtningen faller vi tillbaka på
// standardfonten i stället för att fälla bygget.
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

export default async function OpengraphImage() {
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
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 56,
                    background: 'linear-gradient(180deg, #7dd3fc 0%, #38bdf8 55%, #0ea5e9 100%)',
                    fontFamily: 'Fredoka, sans-serif',
                    position: 'relative',
                }}
            >
                {/* Småmoln i bakgrunden */}
                <div style={{ position: 'absolute', top: 48, left: 80, width: 150, height: 52, borderRadius: 999, background: 'rgba(255,255,255,0.55)', display: 'flex' }} />
                <div style={{ position: 'absolute', top: 96, left: 150, width: 90, height: 40, borderRadius: 999, background: 'rgba(255,255,255,0.4)', display: 'flex' }} />
                <div style={{ position: 'absolute', top: 70, right: 110, width: 180, height: 56, borderRadius: 999, background: 'rgba(255,255,255,0.5)', display: 'flex' }} />
                <div style={{ position: 'absolute', bottom: 70, left: 210, width: 120, height: 44, borderRadius: 999, background: 'rgba(255,255,255,0.35)', display: 'flex' }} />
                <div style={{ position: 'absolute', bottom: 110, right: 170, width: 140, height: 48, borderRadius: 999, background: 'rgba(255,255,255,0.4)', display: 'flex' }} />

                {/* Molnet (logotypen) */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={iconSrc} width={310} height={310} alt="" />

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 18 }}>
                    <div
                        style={{
                            fontSize: 120,
                            fontWeight: 600,
                            color: '#ffffff',
                            letterSpacing: 4,
                            textShadow: '0 6px 28px rgba(3, 105, 161, 0.45)',
                            display: 'flex',
                        }}
                    >
                        VADKUL
                    </div>
                    <div style={{ fontSize: 38, color: '#f0f9ff', display: 'flex', maxWidth: 620 }}>
                        Hitta events och saker att göra nära dig – på en karta
                    </div>
                    <div
                        style={{
                            marginTop: 14,
                            display: 'flex',
                            alignItems: 'center',
                            background: '#ffffff',
                            color: '#0284c7',
                            fontSize: 32,
                            fontWeight: 600,
                            padding: '14px 34px',
                            borderRadius: 999,
                            boxShadow: '0 8px 24px rgba(3, 105, 161, 0.3)',
                        }}
                    >
                        20 000+ event i hela Sverige
                    </div>
                </div>
            </div>
        ),
        {
            ...size,
            fonts: fredoka
                ? [{ name: 'Fredoka', data: fredoka, weight: 600 as const, style: 'normal' as const }]
                : undefined,
        },
    );
}
