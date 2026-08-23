/**
 * normalizeEvent.ts — CENTRAL städning av RawEvent innan geokodning/spar.
 *
 * Revisionen 2026-08-20 (31 915 framtida event) visade att varje engine
 * städade själv — och några missade: wp-rest lämnade &amp;/&#8217; i 180+
 * beskrivningar (Visit Piteå/Östersund), Visit Helsingborg lämnade <p>-taggar,
 * Jokkmokk lade vägbeskrivningar med radbrytningar i platsnamnet, Facebook
 * sparade sidfoten ("Integritet · Användarvillkor …") som beskrivning och
 * Tickster-titlar bär arrangörens "11/9 TITEL | VENUE"-prefix/suffix.
 * Runnern kör detta för ALLA engines så ingen behöver komma ihåg det.
 *
 * Ren modul (ingen I/O) — testad i normalizeEvent.test.ts.
 */

import { RawEvent } from '../sources/types';
import { decodeHtmlEntities, cleanDescription } from './text';

/** Beskrivningar som egentligen är sajt-chrome (FB-sidfot m.fl.) → töm. */
const JUNK_DESCRIPTION = [
    /^\s*Integritet\s*[·•]?\s*(?:\n\s*)?·?\s*Användarvillkor/i,   // Facebook-sidfot
    /^\s*Hoppa till huvudinnehåll/i,
    /^\s*(?:Vi använder|Denna webbplats använder) cookies/i,
];

const MAX_DESCRIPTION = 12000;  // bara städning — engines bestämmer själva längd (max i DB ~9.7k)
const MAX_LOCATION = 120;

function collapse(s: string): string {
    return s.replace(/\s+/g, ' ').trim();
}

/**
 * Titel: avkoda, strippa taggar, kollapsa whitespace. Arrangörs-prefix med
 * datum ("11/9 SHREK RAVE") bort — datumet bor i time-fältet. Trailing
 * " | X" / " – X" bort när X är venue/stad/värd (Tickster/FB-vana), annars
 * lämnas det (kan vara del av titeln: "Ah! Kosmos & Hainbach | Fasching").
 */
export function normalizeTitle(title: string, ctx: { venueName?: string; city?: string; hostName?: string } = {}): string {
    let t = collapse(decodeHtmlEntities(String(title ?? '')).replace(/<[^>]+>/g, ' '));
    t = t.replace(/^\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\s*[-–:]?\s+(?=\S)/, '');
    const tail = t.match(/^(.*\S)\s+[|–-]\s+([^|–-]{2,60})$/);
    if (tail) {
        const suffix = tail[2].trim().toLowerCase();
        const known = [ctx.venueName, ctx.city, ctx.hostName]
            .filter((x): x is string => !!x && x.length >= 3)
            .map((x) => x.toLowerCase());
        if (known.some((k) => suffix === k || suffix.includes(k) || k.includes(suffix))) t = tail[1].trim();
    }
    return t;
}

/** Beskrivning: cleanDescription (taggar → \n, entiteter, whitespace) + chrome-spärr. */
export function normalizeDescription(description: unknown): string {
    const d = cleanDescription(description, MAX_DESCRIPTION);
    if (!d) return '';
    if (JUNK_DESCRIPTION.some((re) => re.test(d))) return '';
    return d;
}

/**
 * Platsnamn: avkoda, första raden = venue; övriga rader (vägbeskrivning,
 * postadress, telefon) → address om tom, så geokodningen får nytta av dem
 * i stället för att de skräpar ner kartkortet. Cap 120 tecken.
 */
export function normalizeLocation(venueName: string | undefined, address: string | undefined): { venueName?: string; address?: string } {
    if (!venueName) return { venueName, address };
    const decoded = decodeHtmlEntities(String(venueName)).replace(/<[^>]+>/g, ' ');
    const lines = decoded.split(/\r?\n/).map(collapse).filter(Boolean);
    if (lines.length === 0) return { venueName: undefined, address };
    let venue = lines[0];
    let addr = address;
    if (lines.length > 1 && !addr) {
        // Rester som inte är telefon/mejl → adresskandidat
        const rest = lines.slice(1).filter((l) => !/^\+?\d[\d\s-]{6,}$|@/.test(l)).join(', ');
        if (rest) addr = rest.slice(0, 200);
    }
    if (venue.length > MAX_LOCATION) {
        const cut = venue.slice(0, MAX_LOCATION).lastIndexOf(',');
        venue = (cut > 20 ? venue.slice(0, cut) : venue.slice(0, MAX_LOCATION)).trim();
    }
    return { venueName: venue, address: addr };
}

/** Applicera allt på ett RawEvent (muterar). Returnerar eventet för kedjning. */
export function normalizeRawEvent(e: RawEvent, hostName?: string): RawEvent {
    const loc = normalizeLocation(e.venueName, e.address);
    e.venueName = loc.venueName;
    e.address = loc.address;
    if (e.city) e.city = collapse(decodeHtmlEntities(e.city));
    e.title = normalizeTitle(e.title, { venueName: e.venueName, city: e.city, hostName: e.hostName ?? hostName });
    e.description = normalizeDescription(e.description) || undefined;
    return e;
}
