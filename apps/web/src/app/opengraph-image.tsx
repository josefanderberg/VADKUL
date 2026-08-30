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
// standardfonten i stället för att fälla bygget. Fredoka bär brödtext/pills;
// Inter Black Italic bär ordmärket — välkomstrutans VADKUL är font-black
// italic i SYSTEM-sans (inte Fredoka), och Inter 900 kursiv är närmsta
// nedladdningsbara motsvarighet.
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
const loadFredoka = () =>
    loadGoogleFont('https://fonts.googleapis.com/css2?family=Fredoka:wght@600&display=swap');
const loadInterBlackItalic = () =>
    loadGoogleFont('https://fonts.googleapis.com/css2?family=Inter:ital,wght@1,900&display=swap');

export default async function OpengraphImage() {
    const [fredoka, interBlackItalic, kartaJpg, iconPng] = await Promise.all([
        loadFredoka(),
        loadInterBlackItalic(),
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
                    {/* Ordmärket matchar välkomstrutans: font-black + kursivt +
                        tight spärrning, med det gula strecket under. */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={iconSrc} width={128} height={128} alt="" />
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                            <div
                                style={{
                                    fontFamily: 'Inter, sans-serif',
                                    fontSize: 84,
                                    fontWeight: 900,
                                    fontStyle: 'italic',
                                    color: '#ffffff',
                                    letterSpacing: -3,
                                    textShadow: '0 5px 22px rgba(2, 30, 55, 0.75)',
                                    display: 'flex',
                                }}
                            >
                                VADKUL
                            </div>
                            <div style={{ marginTop: 8, marginLeft: 6, width: 150, height: 8, borderRadius: 999, background: '#FECC02', display: 'flex', boxShadow: '0 2px 10px rgba(2, 30, 55, 0.5)' }} />
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

                    {/* Siffrorna är bildens huvudnummer (ägarfeedback 31/8: de ska
                        poppa, Sverige nämnas, övrig text hållas nere). Kicker-raden
                        bär Sverige; sifferdelen är dubbelt så stor som orden.
                        Vägskyltarnas färgspråk: gul idag-rad + mörk vecko-rad. */}
                    <div
                        style={{
                            marginTop: 30,
                            display: 'flex',
                            alignItems: 'center',
                            color: '#eaf6ff',
                            fontSize: 24,
                            fontWeight: 600,
                            letterSpacing: 4,
                            textShadow: '0 2px 10px rgba(2, 30, 55, 0.75)',
                        }}
                    >
                        JUST NU I HELA SVERIGE
                    </div>
                    {/* Pillsen bär guld-CTA:ns look (city-cta): blå gradient +
                        guldkant + guldglöd. Knapparnas animerade ljussvep funkar
                        inte fruset i stillbild (två identiska stråk lästes som
                        kopior — ägarfeedback 31/8); i stället en glasig topp-
                        glans så de skiner som blanka knappar (glint-pricken i
                        vänsterkurvan provades och togs bort på ägar-nej). */}
                    <div
                        style={{
                            marginTop: 16,
                            position: 'relative',
                            display: 'flex',
                            alignItems: 'baseline',
                            overflow: 'hidden',
                            background: 'linear-gradient(90deg, #006AA7, #004B78)',
                            border: '3px solid #FECC02',
                            color: '#ffffff',
                            padding: '10px 36px 16px',
                            borderRadius: 999,
                            boxShadow: '0 0 30px rgba(254, 204, 2, 0.4), 0 10px 30px rgba(2, 30, 55, 0.55)',
                        }}
                    >
                        <div style={{ position: 'absolute', top: 5, left: 18, right: 18, height: '44%', borderRadius: 999, background: 'linear-gradient(180deg, rgba(255,255,255,0.30) 0%, rgba(255,255,255,0.10) 65%, rgba(255,255,255,0) 100%)', display: 'flex' }} />
                        <div style={{ display: 'flex', fontSize: 66, fontWeight: 600, color: '#FECC02' }}>1 000+</div>
                        <div style={{ display: 'flex', fontSize: 33, fontWeight: 600, marginLeft: 14 }}>event idag</div>
                    </div>
                    <div
                        style={{
                            marginTop: 16,
                            position: 'relative',
                            display: 'flex',
                            alignItems: 'baseline',
                            overflow: 'hidden',
                            background: 'linear-gradient(90deg, #006AA7, #004B78)',
                            border: '3px solid #FECC02',
                            color: '#ffffff',
                            padding: '10px 36px 16px',
                            borderRadius: 999,
                            boxShadow: '0 0 30px rgba(254, 204, 2, 0.4), 0 10px 30px rgba(2, 30, 55, 0.55)',
                        }}
                    >
                        <div style={{ position: 'absolute', top: 5, left: 18, right: 18, height: '44%', borderRadius: 999, background: 'linear-gradient(180deg, rgba(255,255,255,0.30) 0%, rgba(255,255,255,0.10) 65%, rgba(255,255,255,0) 100%)', display: 'flex' }} />
                        <div style={{ display: 'flex', fontSize: 66, fontWeight: 600, color: '#FECC02' }}>10 000+</div>
                        <div style={{ display: 'flex', fontSize: 33, fontWeight: 600, marginLeft: 14 }}>i veckan</div>
                    </div>
                </div>
            </div>
        ),
        {
            ...size,
            // Tom fonts-array fäller satori — utebliven hämtning ger undefined
            // (standardfont) precis som förr.
            fonts: fredoka || interBlackItalic
                ? [
                      ...(fredoka ? [{ name: 'Fredoka', data: fredoka, weight: 600 as const, style: 'normal' as const }] : []),
                      ...(interBlackItalic ? [{ name: 'Inter', data: interBlackItalic, weight: 900 as const, style: 'italic' as const }] : []),
                  ]
                : undefined,
        },
    );
}
