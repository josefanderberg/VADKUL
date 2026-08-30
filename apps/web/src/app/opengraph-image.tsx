import { ImageResponse } from 'next/og';
import { readFile } from 'fs/promises';
import path from 'path';

// Delningsbilden (Open Graph) — det folk ser när en VADKUL-länk delas i
// Messenger/Facebook/iMessage m.fl. Renderas EN gång vid build (force-static),
// så fs-läsning och font-hämtning sker på byggmaskinen, inte per request.
//
// Bakgrunden (og-karta.jpg) är en riktig fångst av nöjesfältskartan över
// Stockholm med eventbrickorna INBAKADE (guld-⭐, gröna "skapat på VADKUL"-
// brickan m.fl. — bakade med kartans egen brick-ritkod, 30/8). Görs om:
// se scratch-receptet i commit-meddelandet för og-karta.jpg. Siffrorna i
// pillsen är golv tagna ur aggregaten 30/8 (1 538 idag / 12 466 veckan) —
// välkomstrutan visar de exakta, här står trygga "1 000+"/"10 000+".
export const dynamic = 'force-static';

export const alt = 'VADKUL – eventkartan med 1 000+ event idag och 10 000+ i veckan';
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
    const [fredoka, kartaJpg, iconPng] = await Promise.all([
        loadFredoka(),
        readFile(path.join(process.cwd(), 'public', 'og-karta.jpg')),
        readFile(path.join(process.cwd(), 'public', 'pwa-icon-512.png')),
    ]);
    const kartaSrc = `data:image/jpeg;base64,${kartaJpg.toString('base64')}`;
    const iconSrc = `data:image/png;base64,${iconPng.toString('base64')}`;

    return new ImageResponse(
        (
            <div
                style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    position: 'relative',
                    fontFamily: 'Fredoka, sans-serif',
                }}
            >
                {/* Kartfångsten med inbakade brickor — hela ytan */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={kartaSrc} width={1200} height={630} alt="" style={{ position: 'absolute', top: 0, left: 0 }} />

                {/* Mörkblå scrim från vänster så text/logga bär mot kartan;
                    brickorna till höger lämnas orörda. */}
                <div
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        background: 'linear-gradient(100deg, rgba(5,40,70,0.88) 0%, rgba(5,40,70,0.60) 32%, rgba(5,40,70,0.16) 52%, rgba(5,40,70,0) 63%)',
                    }}
                />

                {/* Vänsterkolumnen: logga, ordmärke, pills */}
                <div style={{ position: 'absolute', top: 44, left: 52, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={iconSrc} width={128} height={128} alt="" />
                        <div
                            style={{
                                fontSize: 84,
                                fontWeight: 600,
                                color: '#ffffff',
                                letterSpacing: 3,
                                textShadow: '0 5px 22px rgba(2, 30, 55, 0.75)',
                                display: 'flex',
                            }}
                        >
                            VADKUL
                        </div>
                    </div>
                    <div
                        style={{
                            marginTop: 6,
                            fontSize: 27,
                            color: '#eaf6ff',
                            textShadow: '0 2px 10px rgba(2, 30, 55, 0.75)',
                            display: 'flex',
                            maxWidth: 520,
                        }}
                    >
                        Hitta events och saker att göra nära dig
                    </div>

                    {/* Vägskylts-stacken: gul idag-rad + mörk vecko-rad + vit totalpill
                        (samma färgspråk som kartans stadsskyltar). */}
                    <div
                        style={{
                            marginTop: 34,
                            display: 'flex',
                            alignItems: 'center',
                            background: '#ffc53d',
                            color: '#1f2937',
                            fontSize: 34,
                            fontWeight: 600,
                            padding: '13px 30px',
                            borderRadius: 16,
                            boxShadow: '0 8px 24px rgba(2, 30, 55, 0.4)',
                        }}
                    >
                        1 000+ event bara idag
                    </div>
                    <div
                        style={{
                            marginTop: 14,
                            display: 'flex',
                            alignItems: 'center',
                            background: 'rgba(37, 42, 51, 0.94)',
                            color: '#ffffff',
                            fontSize: 34,
                            fontWeight: 600,
                            padding: '13px 30px',
                            borderRadius: 16,
                            boxShadow: '0 8px 24px rgba(2, 30, 55, 0.4)',
                        }}
                    >
                        10 000+ den kommande veckan
                    </div>
                    <div
                        style={{
                            marginTop: 14,
                            display: 'flex',
                            alignItems: 'center',
                            background: '#ffffff',
                            color: '#0284c7',
                            fontSize: 26,
                            fontWeight: 600,
                            padding: '10px 24px',
                            borderRadius: 999,
                            boxShadow: '0 8px 24px rgba(2, 30, 55, 0.35)',
                        }}
                    >
                        20 000+ event i hela Sverige – gratis
                    </div>
                </div>

                {/* Etiketten under gröna brickan (inbakad på ~(906,338)) —
                    positionen är matchad mot compose-skriptets placering. */}
                <div
                    style={{
                        position: 'absolute',
                        top: 386,
                        left: 906,
                        transform: 'translateX(-50%)',
                        display: 'flex',
                        alignItems: 'center',
                        background: '#ffffff',
                        color: '#047857',
                        fontSize: 21,
                        fontWeight: 600,
                        padding: '6px 16px',
                        borderRadius: 999,
                        boxShadow: '0 4px 14px rgba(2, 30, 55, 0.35)',
                    }}
                >
                    Skapat på VADKUL
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
