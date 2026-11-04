/**
 * text.ts - inläggstexterna. REN logik: mallar per tema, hashtaggar och
 * kontrollen som varje text måste klara innan den får gå ut.
 *
 * Reglerna (docs/social/dagsinlagg.md, inlagg-plan.md): du-tilltal, granne
 * som tipsar, avsluta med en fråga, max ett utropstecken, 3-6 emojis som
 * radmarkörer, aldrig klyschorna i SPARRADE_FRASER, aldrig tankstreck,
 * Instagram utan länk ("Länk i bion"), hashtaggar sist. Och det viktigaste:
 * varje siffra i texten måste finnas i `data` - siffror kommer ur kartan,
 * aldrig ur en mall eller en språkmodell.
 *
 * Länkrader skrivs med platshållare så samma mall ger båda plattformarna:
 *   {länk}            -> FB: vadkul.se (eller data.url), IG: "Länk i bion ☁️"
 *   @länk <url>       -> FB: raden visar url:en, IG: raden tas bort
 */

import type { KlippTema, Tema } from './typer';

/** Klyschor och reklamord som aldrig får förekomma (publish-fb.ts + BAS). */
export const SPARRADE_FRASER = [
    'Häng med', 'Ta chansen', 'Passa på', 'Missa inte', 'Häng på',
    'Är du redo', 'Här kommer', 'Här är dagens', 'Idag firar vi',
    'Dags att', 'Glöm inte', 'Vi har koll', 'dela gärna', 'vi erbjuder',
    'revolutionerande', 'plattform', 'lansering',
];

export const HASHTAGGAR_BAS = ['#vadkul', '#evenemang', '#sverige'];
export const IG_MAX = 2200;
export const EMOJI_MIN = 3;
export const EMOJI_MAX = 6;
export const LANK_IG = 'Länk i bion ☁️';

export type Plattform = 'fb' | 'ig';
export type TextData = Record<string, number | string>;
export interface Texter { fb: string; ig: string }

// --- Siffror ---------------------------------------------------------------

/** Ärligt golv: 12 345 -> 12 000, 3 487 -> 3 400, 187 -> 180, 42 -> 42. */
export function golv(n: number): number {
    if (n >= 10_000) return Math.floor(n / 1000) * 1000;
    if (n >= 1_000) return Math.floor(n / 100) * 100;
    if (n >= 100) return Math.floor(n / 10) * 10;
    return Math.max(0, Math.floor(n));
}

/** '11000' -> '11 000' (vanligt mellanslag, tusentalsavgränsare på svenska). */
export function formateraTal(n: number): string {
    return String(Math.floor(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** 'n+' på golvet: 11 432 -> '11 000+'. Under 20 skrivs talet exakt utan plus. */
export function talMedPlus(n: number): string {
    const g = golv(n);
    return g < 20 ? formateraTal(g) : `${formateraTal(g)}+`;
}

// --- Emojis och sifferkontroll ----------------------------------------------

const KEYCAP = /[0-9#*]️?⃣/gu;
const EMOJI = /\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic})*/gu;

export function raknaEmojis(text: string): number {
    const keycaps = (text.match(KEYCAP) ?? []).length;
    const ovriga = (text.replace(KEYCAP, '').match(EMOJI) ?? []).length;
    return keycaps + ovriga;
}

/** Siffergrupper i en text: '11 000+ event 7/11' -> ['11000', '7', '11']. */
export function siffrorI(text: string): string[] {
    const utan = text
        .replace(KEYCAP, ' ')
        .replace(/https?:\/\/\S+|\bvadkul\.se\/\S*/gi, ' ')
        .replace(/#\S+/g, ' ');
    return (utan.match(/\d+(?: \d{3})*/g) ?? []).map(s => s.replace(/ /g, ''));
}

function siffrorIData(data: TextData): Set<string> {
    const ut = new Set<string>();
    for (const v of Object.values(data)) {
        if (typeof v === 'number') ut.add(String(Math.floor(v)));
        else for (const s of siffrorI(v)) ut.add(s);
    }
    return ut;
}

// --- Kontrollen --------------------------------------------------------------

/** Brott mot reglerna; tom lista = texten får gå ut. */
export function kontrollera(text: string, data: TextData, plattform: Plattform): string[] {
    const brott: string[] = [];
    if (/[–—]/.test(text)) brott.push('tankstreck');
    const lagt = text.toLowerCase();
    for (const fras of SPARRADE_FRASER) {
        if (lagt.includes(fras.toLowerCase())) brott.push(`spärrad fras: ${fras}`);
    }
    const utrop = (text.match(/!/g) ?? []).length;
    if (utrop > 1) brott.push(`${utrop} utropstecken`);
    if (plattform === 'ig' && /https?:\/\/|www\.|vadkul\.se/i.test(text)) brott.push('länk på Instagram');
    const emojis = raknaEmojis(text);
    if (emojis < EMOJI_MIN || emojis > EMOJI_MAX) brott.push(`${emojis} emojis (${EMOJI_MIN}-${EMOJI_MAX})`);
    const rader = text.split('\n').map(r => r.trim()).filter(r => r && !r.startsWith('#'));
    const sista = rader[rader.length - 1] ?? '';
    if (!sista.endsWith('?')) brott.push('slutar inte med en fråga');
    const kanda = siffrorIData(data);
    for (const s of new Set(siffrorI(text))) {
        if (!kanda.has(s)) brott.push(`siffra saknas i data: ${s}`);
    }
    if (plattform === 'ig' && text.length > IG_MAX) brott.push(`för lång (${text.length} > ${IG_MAX})`);
    return brott;
}

/** En textrad som bränns in i videon: max sex ord, inga emojis, max ett "!",
 *  siffror bara ur data. */
export function kontrolleraTextrad(rad: string, data: TextData = {}): string[] {
    const brott: string[] = [];
    if (/[–—]/.test(rad)) brott.push('tankstreck');
    const ord = rad.trim().split(/\s+/).filter(Boolean);
    if (ord.length === 0) brott.push('tom');
    if (ord.length > 6) brott.push(`${ord.length} ord (max 6)`);
    if (raknaEmojis(rad) > 0) brott.push('emoji i textrad');
    if ((rad.match(/!/g) ?? []).length > 1) brott.push('flera utropstecken');
    if (/^[A-ZÅÄÖ\s!?.,]+$/.test(rad) && ord.length > 1) brott.push('versaler');
    const kanda = siffrorIData(data);
    for (const s of new Set(siffrorI(rad))) if (!kanda.has(s)) brott.push(`siffra saknas i data: ${s}`);
    return brott;
}

// --- Hashtaggar ------------------------------------------------------------

export function hashtagForStad(stad: string): string {
    return '#' + stad.toLowerCase().replace(/[^a-zåäö0-9]+/g, '');
}

export function hashtaggar(tema: Tema, stad?: string): string[] {
    const extra: Record<Tema, string[]> = {
        siffra: ['#vadhänder'], video: ['#vadhänder'], gissa: ['#dagensevent'],
        helg: ['#ihelgen'], quiz: ['#quiz'], budskap: ['#gratis'],
    };
    const ut = [...HASHTAGGAR_BAS, ...extra[tema]];
    if (stad) ut.push(hashtagForStad(stad));
    return ut;
}

// --- Mallar ------------------------------------------------------------------

/** Deterministiskt val ur alternativen, så två dagar med samma tema inte
 *  låter likadant men samma dag alltid ger samma text. */
export function variera<T>(alternativ: readonly T[], fro: string): T {
    let h = 0;
    for (const c of fro) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return alternativ[h % alternativ.length];
}

const s = (data: TextData, nyckel: string): string => {
    const v = data[nyckel];
    if (v === undefined) throw new Error(`text: data saknar '${nyckel}'`);
    return typeof v === 'number' ? formateraTal(v) : v;
};

/** Mallkroppen (rader) för tema + variant. Länkrader med platshållare. */
export function mallrader(tema: Tema, variant: string | undefined, data: TextData, fro: string): string[] {
    switch (tema) {
        case 'siffra':
            if (variant === 'helg') return [
                variera([
                    `${s(data, 'helgGolv')} event i helgen, i hela landet 🗓️`,
                    `I helgen: ${s(data, 'helgGolv')} event från norr till söder 🗓️`,
                ], fro),
                'Varje prick på bilden är en plats där något händer 📍',
                `Allt på en karta, gratis ✨`,
                '{länk}',
                variera(['Vad gör du i helgen?', 'Vad blir det i helgen?'], fro),
            ];
            return [
                variera([
                    `${s(data, 'veckaGolv')} event i Sverige den här veckan 🗓️`,
                    `Den här veckan: ${s(data, 'veckaGolv')} event runt om i Sverige 🗓️`,
                ], fro),
                `${s(data, 'nyaGolv')} nya på kartan sedan förra veckan ✨`,
                `Mest ${s(data, 'toppKategori')} ${s(data, 'toppEmoji')}`,
                'Varje prick på bilden är en plats där något händer 📍',
                '{länk}',
                variera(['Vad ska du på?', 'Vad lockar dig den här veckan?', 'Hittar du din stad på bilden?'], fro),
            ];
        case 'gissa':
            return [
                variera([
                    'Tre event i dag, tre städer. Vilket tror du flest öppnar? 👇',
                    'Dagens trio. Vilket av de här tre öppnar flest i dag? 👇',
                ], fro),
                `1️⃣ ${s(data, 'k1Titel')}, ${s(data, 'k1Stad')}`,
                `@länk ${s(data, 'k1Url')}`,
                `2️⃣ ${s(data, 'k2Titel')}, ${s(data, 'k2Stad')}`,
                `@länk ${s(data, 'k2Url')}`,
                `3️⃣ ${s(data, 'k3Titel')}, ${s(data, 'k3Stad')}`,
                `@länk ${s(data, 'k3Url')}`,
                'Svaret kommer i morgon här i kommentarerna ☁️',
                'Vilken gissar du på?',
            ];
        case 'helg':
            return [
                `${s(data, 'antalGolv')} event i ${s(data, 'stad')} i helgen 🗓️`,
                ...(data.kat1 ? [kategoriRad(data)] : []),
                data.topp1 ? `Ett tips: ${s(data, 'topp1')} ✨` : 'Allt på en karta, gratis ✨',
                'Hela helgen på kartan 📍',
                '{länk}',
                variera(['Vad blir det för dig?', `Vad ska du på i ${s(data, 'stad')}?`], fro),
            ];
        case 'quiz':
            return [
                'Quiz 🧠',
                s(data, 'fraga'),
                `1️⃣ ${s(data, 'alt1')}`,
                `2️⃣ ${s(data, 'alt2')}`,
                `3️⃣ ${s(data, 'alt3')}`,
                variant === 'duell' ? 'Svaret kommer i morgon här i kommentarerna ☁️' : 'Svaret kommer i morgon ☁️',
                variant === 'duell' ? 'Vilken stad tippar du på?' : 'Vad tror du?',
            ];
        case 'budskap':
            return budskapsrader(variant ?? 'skapa-eget', data, fro);
        case 'video':
            return videorader((variant ?? 'okant') as KlippTema, data, fro);
    }
}

/** "Mest musik, sedan sport och scen 🎵" ur kat1..kat3 (urval.helgStad). */
function kategoriRad(data: TextData): string {
    const k = [data.kat1, data.kat2, data.kat3].filter((v): v is string => typeof v === 'string' && v.length > 0);
    const emoji = s(data, 'kat1Emoji');
    if (k.length >= 3) return `Mest ${k[0]}, sedan ${k[1]} och ${k[2]} ${emoji}`;
    if (k.length === 2) return `Mest ${k[0]}, sedan ${k[1]} ${emoji}`;
    return `Mest ${k[0]} ${emoji}`;
}

function budskapsrader(variant: string, data: TextData, fro: string): string[] {
    switch (variant) {
        case 'appen': return [
            'VADKUL finns som app 📱',
            'Allt som händer nära dig, i fickan ✨',
            'iPhone i App Store, Android i sluten test 🤖',
            '{länk}',
            variera(['Vad vill du se mer av i appen?', 'Vad saknar du i appen?'], fro),
        ];
        case 'bjud-med': return [
            'Vem skulle du bjuda med? 👋',
            'Hitta något i helgen och skicka det till en vän ✨',
            'Allt som händer nära dig på en karta 📍',
            '{länk}',
            'Vem blir det?',
        ];
        case 'milstolpe': return [
            `${s(data, 'milstolpe')} 🎉`,
            'Tack till alla som använder kartan och tipsar om event ✨',
            'Nästa steg: fler orter, fler event 📍',
            '{länk}',
            'Vad vill du att vi bygger härnäst?',
        ];
        default: return [
            variera(['Har du ett event på gång? 🎪', 'Ordnar du något? 🎪'], fro),
            'Lägg upp det själv på kartan, gratis, tar en minut ✨',
            'Loppis, konsert, träning, föreläsning, allt får plats 📍',
            '{länk}',
            'Vad vill du bjuda in till?',
        ];
    }
}

function videorader(klippTema: KlippTema, data: TextData, fro: string): string[] {
    switch (klippTema) {
        case 'ikvall': return [
            'Vad gör du ikväll? 👇',
            'Allt som händer nära dig, samlat på en karta 📍',
            'Gratis, hela Sverige ✨',
            '{länk}',
            'Vad blir det?',
        ];
        case 'allt': return [
            'Konserter, loppisar, matcher, kurser 👇',
            'Allt som händer, på ett ställe 📍',
            'Hela Sverige, gratis ✨',
            '{länk}',
            'Vad letar du efter?',
        ];
        case 'hitta-pa': return [
            'Vad ska vi hitta på? 🤔',
            'Kolla kartan, något händer alltid nära dig 📍',
            'Gratis, inget konto behövs ✨',
            '{länk}',
            'Vad lockar?',
        ];
        case 'fredag': return [
            variera(['Fredag. Vad händer? 👇', 'Äntligen fredag 👇'], fro),
            'Allt nära dig i kväll och i helgen, på en karta 📍',
            'Gratis, hela Sverige ✨',
            '{länk}',
            'Vad blir det i helgen?',
        ];
        case 'bjud-med': return budskapsrader('bjud-med', data, fro);
        case 'regnig': return [
            'Regnar det? ☔',
            'Massor händer inomhus: bio, museer, kurser, caféer 📍',
            'Allt på kartan ✨',
            '{länk}',
            'Vad gör du en regnig dag?',
        ];
        case 'skapa-eget': return budskapsrader('skapa-eget', data, fro);
        case 'helg': return [
            `${s(data, 'antalGolv')} event i ${s(data, 'stad')} i helgen 🗓️`,
            'Hela helgen på kartan 📍',
            'Gratis ✨',
            '{länk}',
            `Vad ska du på i ${s(data, 'stad')}?`,
        ];
        default: return [
            'Allt som händer nära dig 👇',
            'På en karta, hela Sverige 📍',
            'Gratis ✨',
            '{länk}',
            'Vad ska du på?',
        ];
    }
}

/** Rader -> färdig text för en plattform (länkrader, hashtaggar). */
export function satt(rader: string[], plattform: Plattform, opts: { lank?: string; hashtaggar?: string[] } = {}): string {
    const lank = opts.lank ?? 'vadkul.se';
    const ut: string[] = [];
    for (const rad of rader) {
        if (rad === '{länk}') { ut.push(plattform === 'fb' ? lank : LANK_IG); continue; }
        if (rad.startsWith('@länk ')) { if (plattform === 'fb') ut.push(rad.slice(6)); continue; }
        ut.push(rad);
    }
    let text = ut.join('\n');
    if (plattform === 'ig' && opts.hashtaggar?.length) text += `\n\n${opts.hashtaggar.join(' ')}`;
    return text;
}

export interface ByggTextVal {
    tema: Tema;
    variant?: string;
    data: TextData;
    /** Frö för variationen, normalt dagens datum. */
    fro: string;
    stad?: string;
    /** Länk för Facebook (standard vadkul.se). */
    lank?: string;
}

export function byggText(v: ByggTextVal): Texter {
    const rader = mallrader(v.tema, v.variant, v.data, v.fro);
    const tags = hashtaggar(v.tema, v.stad);
    return {
        fb: satt(rader, 'fb', { lank: v.lank }),
        ig: satt(rader, 'ig', { hashtaggar: tags }),
    };
}

/** Bygg och kontrollera; kastar om mallen själv bryter mot reglerna. */
export function byggKontrolleradText(v: ByggTextVal): Texter {
    const t = byggText(v);
    const fel = [...kontrollera(t.fb, v.data, 'fb').map(b => `fb: ${b}`), ...kontrollera(t.ig, v.data, 'ig').map(b => `ig: ${b}`)];
    if (fel.length) throw new Error(`Mallen ${v.tema}/${v.variant ?? '-'} bryter mot reglerna: ${fel.join('; ')}`);
    return t;
}

// --- Textrader i video -------------------------------------------------------

/** Standardtexterna som bränns in per klipp-tema (BAS: rubrik + en gul sak). */
export function textraderFor(klippTema: KlippTema, data: TextData = {}): [string, string] {
    switch (klippTema) {
        case 'ikvall': return ['Vad händer ikväll?', 'Allt som händer, på en karta'];
        case 'allt': return ['Allt på ett ställe', 'Varje event nära dig'];
        case 'hitta-pa': return ['Vad ska vi hitta på?', 'Kolla kartan'];
        case 'fredag': return ['Fredag. Vad händer?', 'Allt nära dig, på en karta'];
        case 'bjud-med': return ['Vem bjuder du med?', 'Hitta något i helgen'];
        case 'regnig': return ['Regnar det?', 'Massor händer inomhus'];
        case 'skapa-eget': return ['Har du ett event?', 'Lägg upp det själv, gratis'];
        case 'helg': return [`I helgen i ${s(data, 'stad')}`, `${s(data, 'antalGolv')} event`];
        default: return ['Allt som händer nära dig', 'Gratis, hela Sverige'];
    }
}
