/**
 * bild.ts - de renderade bilderna (siffer-kort, brickor, rubrikkort,
 * slutkort). REN del: kortSpec() bygger ett satori-träd (React-lika
 * objekt) som snapshot-testas. Renderingen (satori + resvg) bor i
 * bildRender.ts så den här filen kan testas utan de paketen.
 *
 * Stil: BAS-paletten (mörkblå natt, gult ljus), Fredoka, EN sak gul per
 * bild, loggan uppe till vänster, vit vadkul.se-pill nere till vänster
 * (docs/social/inlagg-plan.md). Inga arrangörsfoton: brickor med emoji i
 * stället, det undviker bildrättsfrågan helt.
 */

import { brickGradient, type KartBricka } from './karta';

export const PALETT = {
    morkbla: '#08304A',
    bla: '#0A5077',
    gul: '#FDE047',
    ljusbla: '#BAE6FD',
    vit: '#FFFFFF',
    pillbla: '#0284C7',
} as const;

export const KORT_BREDD = 1080;
export const KORT_HOJD = 1350;
export const SLUTKORT_HOJD = 1920;
export const FONT = 'Fredoka';

/** Ett satori-element: samma form som React.createElement ger. */
export interface Element {
    type: string;
    props: { style?: Record<string, string | number>; children?: Child | Child[]; src?: string; width?: number; height?: number };
}
export type Child = Element | string;

export const el = (type: string, style: Record<string, string | number>, children?: Child | Child[]): Element =>
    ({ type, props: children === undefined ? { style } : { style, children } });

const BAKGRUND = {
    width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
    backgroundImage: `linear-gradient(180deg, ${PALETT.morkbla} 0%, ${PALETT.bla} 100%)`,
    color: PALETT.vit, fontFamily: FONT, padding: '72px', position: 'relative',
} as const;

export function logga(): Element {
    return el('div', { display: 'flex', fontSize: 56, fontWeight: 700, letterSpacing: 2, color: PALETT.vit }, 'VADKUL');
}

/** Vit pill nere till vänster: vadkul.se, med underraden. */
export function pill(under = 'Gratis · Hela Sverige'): Element {
    return el('div', { display: 'flex', flexDirection: 'column', position: 'absolute', left: 72, bottom: 72, gap: 14 }, [
        el('div', {
            display: 'flex', backgroundColor: PALETT.vit, color: PALETT.morkbla, borderRadius: 999,
            padding: '14px 36px', fontSize: 40, fontWeight: 700,
        }, 'vadkul.se'),
        el('div', { display: 'flex', fontSize: 30, color: PALETT.ljusbla }, under),
    ]);
}

export interface SiffraKort { tal: string; rad: string; under?: string }
export interface Bricka { nr?: string; emoji: string; titel: string; under?: string; /** Rund kartbild i stället för emoji (stadsduellen). */ bild?: string }
export interface BrickorKort { rubrik: string; brickor: Bricka[]; fot?: string }
export interface RubrikKort { rubrik: string; under?: string; tal?: string; /** Liten gul etikett ovanför rubriken (den gula saken när inget tal finns). */ etikett?: string }

/** Ett stort tal, gult, med en rad under. Måndagens siffror, fredagens helg. */
export function siffraKort(k: SiffraKort): Element {
    return el('div', BAKGRUND, [
        logga(),
        el('div', { display: 'flex', flexDirection: 'column', flexGrow: 1, justifyContent: 'center', alignItems: 'center', gap: 24, paddingBottom: 120 }, [
            el('div', { display: 'flex', fontSize: k.tal.length > 7 ? 200 : 250, fontWeight: 700, color: PALETT.gul, lineHeight: 1 }, k.tal),
            el('div', { display: 'flex', fontSize: 64, fontWeight: 600, textAlign: 'center', lineHeight: 1.2, maxWidth: 900 }, k.rad),
            ...(k.under ? [el('div', { display: 'flex', fontSize: 40, color: PALETT.ljusbla, marginTop: 16 }, k.under)] : []),
        ]),
        pill(),
    ]);
}

/** Tre brickor under en rubrik: spelet (nr + emoji + titel + stad) och quizet (nr + svar). */
export function brickorKort(k: BrickorKort): Element {
    const brickor = k.brickor.map(b => el('div', {
        display: 'flex', alignItems: 'center', gap: 28, backgroundColor: PALETT.vit, color: PALETT.morkbla,
        borderRadius: 40, padding: '28px 36px', boxShadow: `0 0 40px ${PALETT.gul}55`,
    }, [
        ...(b.nr ? [el('div', { display: 'flex', fontSize: 56, fontWeight: 700, color: PALETT.pillbla, width: 60, justifyContent: 'center' }, b.nr)] : []),
        ...(b.bild
            ? [el('div', { display: 'flex', position: 'relative', width: 112, height: 112, borderRadius: 999, overflow: 'hidden', border: `4px solid ${PALETT.ljusbla}` }, [
                { type: 'img', props: { src: b.bild, width: 224, height: 113, style: { position: 'absolute', left: -56, top: 0, width: 224, height: 113 } } },
            ])]
            : b.emoji ? [el('div', { display: 'flex', fontSize: 72, width: 100, justifyContent: 'center' }, b.emoji)] : []),
        el('div', { display: 'flex', flexDirection: 'column', gap: 6, flexGrow: 1 }, [
            el('div', { display: 'flex', fontSize: b.titel.length > 26 ? 36 : 44, fontWeight: 700, lineHeight: 1.15 }, b.titel),
            ...(b.under ? [el('div', { display: 'flex', fontSize: 32, color: PALETT.bla }, b.under)] : []),
        ]),
    ]));
    return el('div', BAKGRUND, [
        logga(),
        el('div', { display: 'flex', flexDirection: 'column', flexGrow: 1, justifyContent: 'center', gap: 36, paddingBottom: 140 }, [
            el('div', { display: 'flex', fontSize: 68, fontWeight: 700, lineHeight: 1.15, marginBottom: 12 }, k.rubrik),
            ...brickor,
            ...(k.fot ? [el('div', { display: 'flex', fontSize: 36, color: PALETT.gul, marginTop: 12 }, k.fot)] : []),
        ]),
        pill(),
    ]);
}

/** Rubrik, underrad och ett gult tal i hörnet: helgen i en stad, budskapen. */
export function rubrikKort(k: RubrikKort): Element {
    return el('div', BAKGRUND, [
        logga(),
        el('div', { display: 'flex', flexDirection: 'column', flexGrow: 1, justifyContent: 'center', gap: 32, paddingBottom: 140, maxWidth: 900 }, [
            ...(k.etikett && !k.tal ? [el('div', { display: 'flex', fontSize: 40, fontWeight: 700, color: PALETT.gul, letterSpacing: 2, textTransform: 'uppercase' }, k.etikett)] : []),
            ...(k.tal ? [el('div', { display: 'flex', fontSize: 180, fontWeight: 700, color: PALETT.gul, lineHeight: 1 }, k.tal)] : []),
            el('div', { display: 'flex', fontSize: k.tal ? 72 : 96, fontWeight: 700, lineHeight: 1.1 }, k.rubrik),
            ...(k.under ? [el('div', { display: 'flex', fontSize: 44, color: PALETT.ljusbla, lineHeight: 1.3 }, k.under)] : []),
        ]),
        pill(),
    ]);
}

/** Slutkortet i videon (1080x1920): loggan, vadkul.se, inga siffror. */
export function slutkort(ikonDataUri?: string): Element {
    return el('div', { ...BAKGRUND, justifyContent: 'center', alignItems: 'center', padding: 0 }, [
        el('div', { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 40 }, [
            ...(ikonDataUri ? [{ type: 'img', props: { src: ikonDataUri, width: 220, height: 220, style: { width: 220, height: 220, borderRadius: 48 } } } as Element] : []),
            el('div', { display: 'flex', fontSize: 120, fontWeight: 700, letterSpacing: 4 }, 'VADKUL'),
            el('div', { display: 'flex', fontSize: 56, color: PALETT.gul, fontWeight: 600 }, 'Allt som händer, på en karta'),
            el('div', {
                display: 'flex', backgroundColor: PALETT.vit, color: PALETT.morkbla, borderRadius: 999,
                padding: '20px 56px', fontSize: 56, fontWeight: 700, marginTop: 24,
            }, 'vadkul.se'),
            el('div', { display: 'flex', fontSize: 40, color: PALETT.ljusbla }, 'Gratis · Nu i App Store'),
        ]),
    ]);
}

export interface KartKort {
    /** Stadens kartbild som data-URI (PNG; satori tappar WebP tyst). */
    kartbild: string;
    /** Kartytans höjd överst i kortet (bredden är hela kortet). */
    ytaHojd: number;
    /** Kartbildens mått i kortet efter skalning (täcker ytan, centrerad). */
    bildBredd: number;
    bildHojd: number;
    brickor: KartBricka[];
    /** Det stora gula talet. Utan tal blir raden rubrik, med etiketten ovanför. */
    tal?: string;
    etikett?: string;
    rad: string;
    under?: string;
    /** En vit bricka med text bredvid (budskapet "ditt event här"). */
    markera?: { x: number; y: number; text: string };
}

export const BRICKA_STORLEK = 76;

/** En bricka med spetsen i (x, y): samma nål-droppe som kartan (tre runda
 *  hörn, spetsen nedåt via rotate 45, emojin roterad tillbaka). */
export function brickaEl(x: number, y: number, emoji: string, bakgrund: string, a = BRICKA_STORLEK): Element {
    const r = a / 2;
    return el('div', {
        position: 'absolute', left: Math.round(x - r), top: Math.round(y - a * 0.707 - r), width: a, height: a,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: `${r}px ${r}px 0px ${r}px`, backgroundImage: bakgrund,
        border: '3px solid rgba(255,255,255,0.45)', boxShadow: '0 8px 18px rgba(8,48,74,0.45)',
        transform: 'rotate(45deg)',
    }, el('div', { display: 'flex', fontSize: Math.round(a * 0.54), transform: 'rotate(-45deg)' }, emoji));
}

/** Stadskartan överst med riktiga brickor, talet och raden under. Helgen i en stad. */
export function kartKort(k: KartKort): Element {
    const markering = k.markera ? [
        brickaEl(k.markera.x, k.markera.y, '✨', `linear-gradient(145deg, #FFFFFF 0%, ${PALETT.gul} 100%)`, Math.round(BRICKA_STORLEK * 1.3)),
        el('div', {
            position: 'absolute', left: k.markera.x + 70, top: k.markera.y - 150, display: 'flex',
            backgroundColor: PALETT.vit, color: PALETT.morkbla, borderRadius: 999, padding: '14px 30px',
            fontSize: 40, fontWeight: 700, boxShadow: '0 8px 18px rgba(8,48,74,0.45)',
        }, k.markera.text),
    ] : [];
    return el('div', {
        ...BAKGRUND, padding: 0,
        backgroundImage: `linear-gradient(180deg, ${PALETT.morkbla} 0%, ${PALETT.morkbla} ${Math.round((k.ytaHojd / KORT_HOJD) * 100)}%, ${PALETT.bla} 100%)`,
    }, [
        el('div', { display: 'flex', position: 'relative', width: KORT_BREDD, height: k.ytaHojd, overflow: 'hidden' }, [
            { type: 'img', props: { src: k.kartbild, width: k.bildBredd, height: k.bildHojd, style: {
                position: 'absolute', left: Math.round((KORT_BREDD - k.bildBredd) / 2), top: Math.round((k.ytaHojd - k.bildHojd) / 2),
                width: k.bildBredd, height: k.bildHojd,
            } } },
            el('div', { position: 'absolute', left: 0, top: 0, width: KORT_BREDD, height: 230, display: 'flex',
                backgroundImage: 'linear-gradient(180deg, rgba(8,48,74,0.60) 0%, rgba(8,48,74,0) 100%)' }),
            el('div', { position: 'absolute', left: 0, bottom: 0, width: KORT_BREDD, height: 260, display: 'flex',
                backgroundImage: `linear-gradient(180deg, rgba(8,48,74,0) 0%, ${PALETT.morkbla} 100%)` }),
            ...k.brickor.map(b => brickaEl(b.x, b.y, b.emoji, brickGradient(b.kategori))),
            ...markering,
            el('div', { position: 'absolute', left: 72, top: 64, display: 'flex' }, logga()),
        ]),
        el('div', { display: 'flex', flexDirection: 'column', position: 'absolute', left: 72, right: 72, top: k.ytaHojd - 70, gap: 6 }, [
            ...(k.tal
                ? [el('div', { display: 'flex', fontSize: 180, fontWeight: 700, color: PALETT.gul, lineHeight: 1 }, k.tal)]
                : k.etikett ? [el('div', { display: 'flex', fontSize: 40, fontWeight: 700, color: PALETT.gul, letterSpacing: 2, textTransform: 'uppercase', marginTop: 70, marginBottom: 8 }, k.etikett)] : []),
            el('div', { display: 'flex', fontSize: k.tal ? 64 : 80, fontWeight: 700, lineHeight: 1.12 }, k.rad),
            ...(k.under ? [el('div', { display: 'flex', fontSize: 38, color: PALETT.ljusbla, lineHeight: 1.3, marginTop: 14 }, k.under)] : []),
        ]),
        pill(),
    ]);
}

export interface PrickKort {
    /** Sverige av prickar som data-URI (SVG ur karta.prickSvg). */
    prickBild: string;
    bredd: number;
    hojd: number;
    tal: string;
    rad: string;
    under?: string;
    /** Några riktiga brickor ovanpå prickarna (px i prickytan), så man ser att prickarna är event. */
    brickor?: KartBricka[];
}

/** Sverige ritat av utbudet till höger, talet uppe till vänster där Norge är tomt. */
export function prickKort(k: PrickKort): Element {
    const vanster = KORT_BREDD - 36 - k.bredd;
    const topp = Math.round((KORT_HOJD - k.hojd) / 2);
    return el('div', BAKGRUND, [
        { type: 'img', props: { src: k.prickBild, width: k.bredd, height: k.hojd, style: {
            position: 'absolute', left: vanster, top: topp, width: k.bredd, height: k.hojd,
        } } },
        ...(k.brickor ?? []).map(b => brickaEl(vanster + b.x, topp + b.y, b.emoji, brickGradient(b.kategori), 66)),
        logga(),
        el('div', { display: 'flex', flexDirection: 'column', marginTop: 150, gap: 10, maxWidth: 560 }, [
            el('div', { display: 'flex', fontSize: k.tal.length > 5 ? 140 : 170, fontWeight: 700, color: PALETT.gul, lineHeight: 1 }, k.tal),
            el('div', { display: 'flex', fontSize: 58, fontWeight: 700, lineHeight: 1.15, maxWidth: 470 }, k.rad),
            ...(k.under ? [el('div', { display: 'flex', fontSize: 36, color: PALETT.ljusbla, lineHeight: 1.3, marginTop: 16, maxWidth: 400 }, k.under)] : []),
        ]),
        pill(),
    ]);
}

export interface TextOverlay { text: string; storlek?: number; farg?: string; y?: number }

/**
 * En textrad för videon: genomskinlig 1080x1920 med raden centrerad kring
 * `y` (BAS: rubrik 84 px vit kring y 520). Läggs ovanpå klippet med ffmpegs
 * overlay-filter (drawtext finns inte i Homebrews ffmpeg-bygge).
 */
export function textOverlay(t: TextOverlay): Element {
    const storlek = t.storlek ?? 84;
    return el('div', { width: '100%', height: '100%', display: 'flex', fontFamily: FONT, position: 'relative' }, [
        el('div', {
            position: 'absolute', left: 90, right: 90, top: (t.y ?? 520) - storlek, display: 'flex', justifyContent: 'center',
            fontSize: storlek, fontWeight: 700, color: t.farg ?? PALETT.vit, textAlign: 'center', lineHeight: 1.15,
            textShadow: '0 4px 24px rgba(8,48,74,0.55)',
        }, t.text),
    ]);
}

export type KortTyp = 'siffra' | 'brickor' | 'rubrik' | 'karta' | 'prickar' | 'slutkort';
export type KortData = SiffraKort | BrickorKort | RubrikKort | KartKort | PrickKort;

/** Spec för ett kort: typ + data -> element och mått. */
export function kortSpec(typ: 'siffra', k: SiffraKort): { element: Element; bredd: number; hojd: number };
export function kortSpec(typ: 'brickor', k: BrickorKort): { element: Element; bredd: number; hojd: number };
export function kortSpec(typ: 'rubrik', k: RubrikKort): { element: Element; bredd: number; hojd: number };
export function kortSpec(typ: 'karta', k: KartKort): { element: Element; bredd: number; hojd: number };
export function kortSpec(typ: 'prickar', k: PrickKort): { element: Element; bredd: number; hojd: number };
export function kortSpec(typ: 'slutkort', k?: { ikonDataUri?: string }): { element: Element; bredd: number; hojd: number };
export function kortSpec(typ: KortTyp, k?: KortData | { ikonDataUri?: string }): { element: Element; bredd: number; hojd: number } {
    switch (typ) {
        case 'siffra': return { element: siffraKort(k as SiffraKort), bredd: KORT_BREDD, hojd: KORT_HOJD };
        case 'brickor': return { element: brickorKort(k as BrickorKort), bredd: KORT_BREDD, hojd: KORT_HOJD };
        case 'rubrik': return { element: rubrikKort(k as RubrikKort), bredd: KORT_BREDD, hojd: KORT_HOJD };
        case 'karta': return { element: kartKort(k as KartKort), bredd: KORT_BREDD, hojd: KORT_HOJD };
        case 'prickar': return { element: prickKort(k as PrickKort), bredd: KORT_BREDD, hojd: KORT_HOJD };
        case 'slutkort': return { element: slutkort((k as { ikonDataUri?: string } | undefined)?.ikonDataUri), bredd: KORT_BREDD, hojd: SLUTKORT_HOJD };
    }
}

/** All text i ett träd (för tester och för att lista emojis som behöver bild). */
export function texterI(e: Child): string[] {
    if (typeof e === 'string') return [e];
    const c = e.props.children;
    if (c === undefined) return [];
    return (Array.isArray(c) ? c : [c]).flatMap(texterI);
}
