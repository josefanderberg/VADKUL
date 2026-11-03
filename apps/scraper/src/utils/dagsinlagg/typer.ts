/**
 * typer.ts - delade typer för dagsinlägget: ett inlägg om dagen på
 * Facebook-sidan och Instagram, byggt ur kartdatan och klippen i inkorgen.
 *
 * Planen och reglerna: docs/social/dagsinlagg.md. Ägarbeslut 3/11 2026:
 * aldrig eventlistor, alla siffror ur data, tyst godkännande i Telegram.
 */

/** Dagens tema. Hjulet i teman.ts avgör vilket. */
export type Tema = 'siffra' | 'video' | 'gissa' | 'helg' | 'quiz' | 'budskap';
export const TEMAN: Tema[] = ['siffra', 'video', 'gissa', 'helg', 'quiz', 'budskap'];

export type Form = 'bild' | 'video';

/** Vad ett Grok-klipp i inkorgen handlar om (ur bildtexten i Telegram eller
 *  filnamnet, ASCII så det går att ha i filnamn). */
export type KlippTema =
    | 'ikvall' | 'allt' | 'hitta-pa' | 'fredag' | 'bjud-med' | 'regnig'
    | 'skapa-eget' | 'helg' | 'budskap' | 'okant';
export const KLIPP_TEMAN: KlippTema[] = [
    'ikvall', 'allt', 'hitta-pa', 'fredag', 'bjud-med', 'regnig', 'skapa-eget', 'helg', 'budskap', 'okant',
];

export type InlaggStatus =
    | 'planerad' | 'väntar' | 'vetad' | 'publicerad' | 'misslyckad' | 'förfallen' | 'provkörd';

export type KlippStatus = 'ny' | 'godkänd' | 'avvisad' | 'använd';

export interface Kandidat {
    fil: string;
    betyg: number;
    motivering: string;
}

export interface Inlagg {
    /** 'YYYY-MM-DD' i svensk tid - ett inlägg per dag. */
    id: string;
    tema: Tema;
    /** Undervariant, t.ex. siffra: 'vecka' | 'helg', budskap: 'skapa-eget' | 'appen' | 'bjud-med' | 'milstolpe'. */
    variant?: string;
    form: Form;
    status: InlaggStatus;
    skapad: number;
    publiceraEfter: number;
    publicerad?: number;
    text: { fb: string; ig: string };
    /** Varje siffra som står i texten måste finnas här (kontrollera() i text.ts). */
    data: Record<string, number | string>;
    media: {
        typ: Form;
        fil: string;
        url?: string;
        kandidater?: Kandidat[];
    };
    /** Staden inlägget handlar om (helg, quiz) - för rotationen. */
    stad?: string;
    meta?: { fbPostId?: string; igMediaId?: string; permalink?: string };
    uppfoljning?: {
        /** Kandidaternas mätvärden vid posttid (spelet). Nyckel = event-id. */
        baslinje?: Record<string, number>;
        vinnareId?: string;
        /** Rätt svar (quiz) eller vinnartext som ska postas som kommentar. */
        svar?: string;
        fbKommentarId?: string;
        igKommentarId?: string;
        klar?: boolean;
    };
    insikter?: { hamtad: number; fb?: Record<string, number>; ig?: Record<string, number> };
    fel?: string;
}

export interface Klipp {
    /** Filnamnet i inkorgen (utan sökväg). */
    fil: string;
    tema: KlippTema;
    stad?: string;
    status: KlippStatus;
    mottaget: number;
    betyg?: number;
    motivering?: string;
    /** Granskarens förslag på textrader (går alltid genom kontrolleraTextrad). */
    textrader?: string[];
    /** Inläggs-id klippet användes i. */
    anvantI?: string;
}

export interface Milstolpe {
    text: string;
    /** 'YYYY-MM-DD'. */
    datum: string;
    anvand?: boolean;
}

export interface Logg {
    inlagg: Inlagg[];
    klipp: Klipp[];
    milstolpar: Milstolpe[];
    /** Temavikter satta för hand (0 stänger av). Rapporten föreslår, du bestämmer. */
    vikter?: Partial<Record<Tema, number>>;
}

/** En rad ur events-destinations.json. */
export interface DestEvent {
    id: string;
    title: string;
    time: string;
    endDate?: string;
    hasSpecificTime: boolean;
    lat: number;
    lng: number;
    locationName?: string;
    category: string;
    emoji?: string;
    pop?: boolean;
    ps?: number;
    /** Först sedd, 'YYYY-MM-DD' (högst 14 dagar gammal i aggregatet). */
    fs?: string;
    likes?: number;
}

/** En rad ur events-cards.json (samma index som destinations). */
export interface CardEvent {
    h: string;
    coverImage?: string;
    hostName?: string;
    attendees?: number;
    price?: string;
    isLocationVerified?: boolean;
    isHostVerified?: boolean;
    url?: string;
}
