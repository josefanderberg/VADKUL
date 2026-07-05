import { ImageResponse } from 'next/og';
import { getShareEvent, shareTimeLabel } from './shareData';

// Per-event-delningsbild: det mottagaren ser i Messenger/FB/iMessage när
// någon delar /e/<slug>. Renderas på begäran (dynamisk slug) — skrapare
// hämtar den en gång per delning, så volymen är låg.
export const alt = 'Event på VADKUL — se vad som händer nära dig på kartan';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// Samma TTF-hämtningstrick som sajtens generiska OG-bild (satori kräver
// TTF, inte woff2); misslyckas hämtningen används standardfonten.
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

export default async function EventShareImage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const [event, fredoka] = await Promise.all([getShareEvent(slug), loadFredoka()]);

    const title = event
        ? (event.title.length > 90 ? `${event.title.slice(0, 88)}…` : event.title)
        : 'Se vad som händer nära dig';
    const timeLine = event ? shareTimeLabel(event) : '';
    const placeLine = event?.locationName ?? '';

    return new ImageResponse(
        (
            <div
                style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    padding: '64px 72px',
                    background: 'linear-gradient(180deg, #7dd3fc 0%, #38bdf8 55%, #0ea5e9 100%)',
                    fontFamily: 'Fredoka, sans-serif',
                    position: 'relative',
                }}
            >
                {/* Småmoln */}
                <div style={{ position: 'absolute', top: 44, right: 90, width: 170, height: 54, borderRadius: 999, background: 'rgba(255,255,255,0.5)', display: 'flex' }} />
                <div style={{ position: 'absolute', top: 130, left: 60, width: 120, height: 42, borderRadius: 999, background: 'rgba(255,255,255,0.35)', display: 'flex' }} />

                <div style={{ display: 'flex', alignItems: 'center', gap: 40 }}>
                    {/* Emoji-bricka */}
                    <div
                        style={{
                            width: 170,
                            height: 170,
                            borderRadius: 999,
                            background: '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 96,
                            boxShadow: '0 10px 30px rgba(3, 105, 161, 0.35)',
                            flexShrink: 0,
                        }}
                    >
                        {event?.emoji ?? '☁️'}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div
                            style={{
                                fontSize: title.length > 55 ? 46 : 58,
                                fontWeight: 600,
                                color: '#ffffff',
                                lineHeight: 1.15,
                                maxWidth: 860,
                                textShadow: '0 4px 18px rgba(3, 105, 161, 0.4)',
                                display: 'flex',
                            }}
                        >
                            {title}
                        </div>
                        {(timeLine || placeLine) && (
                            <div style={{ fontSize: 32, color: '#f0f9ff', display: 'flex' }}>
                                {timeLine}{placeLine ? `  ·  ${placeLine}` : ''}
                            </div>
                        )}
                    </div>
                </div>

                {/* Sidfot: varumärke + CTA */}
                <div style={{ position: 'absolute', bottom: 48, left: 72, right: 72, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ fontSize: 40, fontWeight: 600, color: '#ffffff', letterSpacing: 2, display: 'flex' }}>VADKUL</div>
                    <div
                        style={{
                            display: 'flex',
                            background: '#ffffff',
                            color: '#0284c7',
                            fontSize: 26,
                            fontWeight: 600,
                            padding: '12px 28px',
                            borderRadius: 999,
                            boxShadow: '0 6px 18px rgba(3, 105, 161, 0.3)',
                        }}
                    >
                        Se på kartan
                    </div>
                </div>
            </div>
        ),
        {
            ...size,
            emoji: 'twemoji',
            fonts: fredoka
                ? [{ name: 'Fredoka', data: fredoka, weight: 600 as const, style: 'normal' as const }]
                : undefined,
        },
    );
}
