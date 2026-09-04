import { ImageResponse } from 'next/og';
import { readFile } from 'fs/promises';
import path from 'path';
import type { CityEvent } from './cityData';
import { todayKey, weekKeys, countByDayKeys } from './cityData';
import { formatCount, pickShareLines } from './cityShare';

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
    padding: '6px 26px 10px',
    borderRadius: 999,
    boxShadow: '0 0 24px rgba(254, 204, 2, 0.35), 0 8px 24px rgba(2, 30, 55, 0.5)',
};
const PILL_GLOSS: React.CSSProperties = {
    position: 'absolute', top: 4, left: 14, right: 14, height: '44%', borderRadius: 999, display: 'flex',
    background: 'linear-gradient(180deg, rgba(255,255,255,0.30) 0%, rgba(255,255,255,0.10) 65%, rgba(255,255,255,0) 100%)',
};

export async function renderCityShareImage(opts: { headline: string; kicker: string; events: CityEvent[] }) {
    const [fredoka, interBlackItalic, kartaJpg, iconPng] = await Promise.all([
        loadFredoka(),
        loadInterBlackItalic(),
        readPublic('og-karta.jpg'),
        readPublic('pwa-icon-512.png'),
    ]);
    const kartaSrc = kartaJpg ? `data:image/jpeg;base64,${kartaJpg.toString('base64')}` : null;
    const iconSrc = iconPng ? `data:image/png;base64,${iconPng.toString('base64')}` : null;

    const today = countByDayKeys(opts.events, [todayKey()]);
    const week = countByDayKeys(opts.events, weekKeys());
    const lines = pickShareLines(opts.events, 3);
    const headlineSize = opts.headline.length > 30 ? 50 : 62;

    return new ImageResponse(
        (
            <div style={{ width: '100%', height: '100%', display: 'flex', position: 'relative', fontFamily: 'Fredoka, sans-serif', background: '#052846' }}>
                {kartaSrc && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={kartaSrc} width={1200} height={630} alt="" style={{ position: 'absolute', top: 0, left: 0 }} />
                )}
                {/* Scrim: mörkare och bredare än rotens — här bär vänsterhalvan
                    både rubrik, pills och tre eventrader. */}
                <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', background: 'linear-gradient(100deg, rgba(5,40,70,0.92) 0%, rgba(5,40,70,0.80) 40%, rgba(5,40,70,0.30) 62%, rgba(5,40,70,0) 75%)' }} />

                <div style={{ position: 'absolute', top: 36, left: 52, right: 52, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                    {/* Ordmärke, mindre än på rotens bild — staden är huvudsaken */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        {iconSrc && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={iconSrc} width={64} height={64} alt="" />
                        )}
                        <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 40, fontWeight: 900, fontStyle: 'italic', color: '#ffffff', letterSpacing: -1.5, textShadow: '0 4px 16px rgba(2, 30, 55, 0.75)', display: 'flex' }}>VADKUL</div>
                        <div style={{ marginLeft: 4, width: 70, height: 6, borderRadius: 999, background: '#FECC02', display: 'flex' }} />
                    </div>

                    <div style={{ marginTop: 22, fontSize: 24, fontWeight: 600, letterSpacing: 4, color: '#eaf6ff', textShadow: '0 2px 10px rgba(2, 30, 55, 0.75)', display: 'flex' }}>
                        {opts.kicker}
                    </div>
                    <div style={{ marginTop: 4, fontSize: headlineSize, fontWeight: 600, color: '#ffffff', lineHeight: 1.1, maxWidth: 820, textShadow: '0 5px 22px rgba(2, 30, 55, 0.8)', display: 'flex' }}>
                        {opts.headline}
                    </div>

                    {/* Siffrorna: stadens egna (bakas vid hämtning, inte golv som på roten) */}
                    <div style={{ marginTop: 18, display: 'flex', gap: 16 }}>
                        {today > 0 && (
                            <div style={PILL}>
                                <div style={PILL_GLOSS} />
                                <div style={{ display: 'flex', fontSize: 48, fontWeight: 600, color: '#FECC02' }}>{formatCount(today)}</div>
                                <div style={{ display: 'flex', fontSize: 26, fontWeight: 600, marginLeft: 12 }}>idag</div>
                            </div>
                        )}
                        <div style={PILL}>
                            <div style={PILL_GLOSS} />
                            <div style={{ display: 'flex', fontSize: 48, fontWeight: 600, color: '#FECC02' }}>{formatCount(week > 0 ? week : opts.events.length)}</div>
                            <div style={{ display: 'flex', fontSize: 26, fontWeight: 600, marginLeft: 12 }}>{week > 0 ? 'i veckan' : 'evenemang'}</div>
                        </div>
                    </div>

                    {/* Tre kommande event som brickrader — "headern med event på" */}
                    {lines.length > 0 && (
                        <div style={{ marginTop: 22, display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {lines.map((l, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, background: 'rgba(255,255,255,0.92)', borderRadius: 999, padding: '6px 22px 6px 8px', boxShadow: '0 6px 18px rgba(2, 30, 55, 0.35)' }}>
                                    <div style={{ width: 46, height: 46, borderRadius: 999, background: '#e6f3fb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>{l.emoji}</div>
                                    <div style={{ display: 'flex', fontSize: 26, fontWeight: 600, color: '#052846' }}>{l.title}</div>
                                    <div style={{ display: 'flex', fontSize: 22, color: '#0369a1', marginLeft: 4 }}>{l.when}</div>
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
