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
export interface Bricka { nr?: string; emoji: string; titel: string; under?: string }
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
        el('div', { display: 'flex', fontSize: 72, width: 100, justifyContent: 'center' }, b.emoji),
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

export type KortTyp = 'siffra' | 'brickor' | 'rubrik' | 'slutkort';
export type KortData = SiffraKort | BrickorKort | RubrikKort;

/** Spec för ett kort: typ + data -> element och mått. */
export function kortSpec(typ: 'siffra', k: SiffraKort): { element: Element; bredd: number; hojd: number };
export function kortSpec(typ: 'brickor', k: BrickorKort): { element: Element; bredd: number; hojd: number };
export function kortSpec(typ: 'rubrik', k: RubrikKort): { element: Element; bredd: number; hojd: number };
export function kortSpec(typ: 'slutkort', k?: { ikonDataUri?: string }): { element: Element; bredd: number; hojd: number };
export function kortSpec(typ: KortTyp, k?: KortData | { ikonDataUri?: string }): { element: Element; bredd: number; hojd: number } {
    switch (typ) {
        case 'siffra': return { element: siffraKort(k as SiffraKort), bredd: KORT_BREDD, hojd: KORT_HOJD };
        case 'brickor': return { element: brickorKort(k as BrickorKort), bredd: KORT_BREDD, hojd: KORT_HOJD };
        case 'rubrik': return { element: rubrikKort(k as RubrikKort), bredd: KORT_BREDD, hojd: KORT_HOJD };
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
