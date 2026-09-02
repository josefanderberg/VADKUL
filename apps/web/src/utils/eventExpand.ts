/**
 * Rena hjälpare för det UTFÄLLDA eventet på stadssidorna (EventExpanded,
 * Josef 2/9: "man öppnar upp eventet inne på stadssidan") — och det som
 * eventkortet på kartan delar med det. Inget nät, ingen webbläsare: allt
 * här är testbart i vitest.
 */

/**
 * Äldre skrapade beskrivningar tappade radbrytningarna HELT — styckena sitter
 * ihop utan ens mellanslag ("…intresseklubb.Tävlingsområde…", "…11:30Klasserna…").
 * Saknar texten \n men har sådana skarvar (skiljetecken/siffra direkt följt av
 * versal) stoppar vi in radbrytningar där. Nyskrapat innehåll har riktiga \n
 * (skraperfix 2026-07-11) och lämnas orört.
 * (Bodde i LinkEventCard t.o.m. 2/9 — flyttad hit när stadssidorna började
 * visa samma beskrivningar.)
 */
export function withRecoveredLineBreaks(text: string): string {
    if (!text || text.includes('\n')) return text;
    return text
        .replace(/([.!?…)])(?=[A-ZÅÄÖ"“])/g, '$1\n')
        .replace(/(\d)(?=[A-ZÅÄÖ])/g, '$1\n');
}

const isHttpUrl = (s: unknown): s is string => {
    if (typeof s !== 'string' || !s) return false;
    try {
        const u = new URL(s);
        return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
        return false;
    }
};

/**
 * Utlänken bakom ANMÄL/BOKA: kortets `url` ur /api/event när den finns (för
 * Ticketmaster är det vår affiliate-redirect — den får INTE tappas bort till
 * förmån för den rena ticketmaster.se-adressen i id:t), annars id:t självt —
 * url ÄR primärnyckeln för skrapade event. Bara http(s) släpps igenom;
 * användarskapade id:n är inga URL:er och ger null (ingen knapp).
 */
export function eventOutlink(id: string, url?: string | null): string | null {
    if (isHttpUrl(url)) return url;
    if (isHttpUrl(id)) return id;
    return null;
}

/**
 * Beskrivningen att visa: den LÄNGSTA kända texten. Stadssidans server-
 * renderade text är kapad vid ~300 tecken (schema.org-trimmen) och API:ts är
 * hel — men API:t kan också sakna texten helt, och då ska den kapade stå kvar.
 */
export function pickDescription(...candidates: (string | null | undefined)[]): string | null {
    let best: string | null = null;
    for (const c of candidates) {
        const t = typeof c === 'string' ? c.trim() : '';
        if (t && (!best || t.length > best.length)) best = t;
    }
    return best;
}

/** Vad beskrivningsstycket visar: texten, "hämtar" medan API-svaret väntas
 *  (pending), annars "ingen beskrivning". */
export function descriptionText(text: string | null, pending: boolean): string {
    if (text) return withRecoveredLineBreaks(text);
    return pending ? 'Hämtar beskrivning…' : 'Ingen beskrivning tillgänglig.';
}

/**
 * Vanligt vänsterklick utan modifierare — DET klicket fäller ut raden på
 * stadssidan. Cmd/ctrl/shift/alt-klick (ny flik/fönster/nedladdning) släpps
 * igenom till radens riktiga länk (kartan) precis som förut; mittenklick
 * avfyrar inget click-event alls och behöver ingen särbehandling.
 */
export function isPlainClick(ev: {
    button?: number;
    metaKey?: boolean;
    ctrlKey?: boolean;
    shiftKey?: boolean;
    altKey?: boolean;
}): boolean {
    return (ev.button ?? 0) === 0 && !ev.metaKey && !ev.ctrlKey && !ev.shiftKey && !ev.altKey;
}

/**
 * Toppnav + klistrad dagrubrik: så många px från fönstrets överkant ska en
 * rad hamna när den lyfts fram (samma 120 som EventExpanded räknar med).
 */
export const EXPAND_ANCHOR_HEADER_PX = 120;

/**
 * Scrollkompensation när det utfällda eventet byts (DayFilteredList).
 *
 * Fälls rad A:s (jättelånga) panel ihop OVANFÖR raden B man just klickade på
 * rycker B upp lika många px som panelen var hög, medan skärmen står kvar —
 * långt ner i listan, utan att B syns (Josef 2/9). Regeln: raden man
 * klickade på ska stå på SAMMA plats på skärmen efter DOM-uppdateringen.
 * Returnerar antalet px att scrolla (window.scrollBy).
 *
 * Undantaget är att STÄNGA en rad man scrollat djupt ner i (dess topp ligger
 * ovanför naven): att hålla den kvar där uppe hade visat raderna långt under
 * den. Då lyfts raden i stället fram strax under naven (headerPx).
 */
export function anchorScrollDelta(
    oldTop: number,
    newTop: number,
    closed: boolean,
    headerPx: number = EXPAND_ANCHOR_HEADER_PX,
): number {
    const target = closed && oldTop < headerPx ? headerPx : oldTop;
    const delta = newTop - target;
    return Math.abs(delta) < 1 ? 0 : delta;
}

/**
 * Värdens favicon ur utlänkens domän — DuckDuckGos ikon-tjänst, samma som
 * kartkortets Värd-rad (bodde som lokal funktion i LinkEventCard t.o.m. 2/9).
 * null när url:en inte går att tolka (användarskapade id:n).
 */
export function hostFaviconUrl(url: string | null | undefined): string | null {
    if (!url) return null;
    try {
        return `https://icons.duckduckgo.com/ip3/${new URL(url).hostname}.ico`;
    } catch {
        return null;
    }
}
