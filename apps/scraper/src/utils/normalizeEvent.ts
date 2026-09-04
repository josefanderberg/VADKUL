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
import { decodeHtmlEntities, cleanDescription, truncateAtBoundary } from './text';
import { extractPriceFromText } from './priceFromText';

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
    // Inklistrad datumtext i början ("26 augusti 202626 augusti 2026Lunchwebbinarium"):
    // strippa upprepade "D månad [ÅÅÅÅ]"-prefix, även utan mellanslag efter.
    t = t.replace(/^(?:\d{1,2}\s+(?:januari|februari|mars|april|maj|juni|juli|augusti|september|oktober|november|december)(?:\s*20\d{2})?\s*[-–,]?\s*)+(?=\S)/i, '');
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

/** Ord som gör ett sifferlöst prisfält meningsfullt ("Fri entré", "Kollekt", "Det kostar inget"). */
const PRICE_WORD_RE = /(?:gratis|fri(?:tt)?(?!\p{L})|kostnadsfri|avgiftsfri|free|ingen\s+(?:avgift|kostnad|entr)|utan\s+(?:kostnad|avgift)|kostar\s+inget|självkostnad|frivillig|donation|gåva|ingår|kollekt|valfri|swish)/iu;
const MAX_PRICE_LEN = 60;

/**
 * Prisfält från källan: entiteter/taggar bort, skräp utan siffra och utan
 * gratis-ord ("P", "ordi", "Avgift", "kronor" — 29 st i revisionen 2026-09-03)
 * → tomt, och lång pristext ("Pris: 100 kr, Ungdom: 80 kr, barn: 60 kr.
 * Biljetter via …") → intervall via priceFromText, annars ordgräns-klipp.
 */
export function sanitizePriceField(price: unknown): string | undefined {
    const p = collapse(decodeHtmlEntities(String(price ?? '')).replace(/<[^>]+>/g, ' '));
    if (!p) return undefined;
    if (!/\d/.test(p) && !PRICE_WORD_RE.test(p)) return undefined;
    if (p.length > MAX_PRICE_LEN) return extractPriceFromText(p) ?? truncateAtBoundary(p, MAX_PRICE_LEN);
    return p;
}

/** Applicera allt på ett RawEvent (muterar). Returnerar eventet för kedjning. */
export function normalizeRawEvent(e: RawEvent, hostName?: string): RawEvent {
    const loc = normalizeLocation(e.venueName, e.address);
    e.venueName = loc.venueName;
    e.address = loc.address;
    if (e.city) e.city = collapse(decodeHtmlEntities(e.city));
    e.title = normalizeTitle(e.title, { venueName: e.venueName, city: e.city, hostName: e.hostName ?? hostName });
    e.description = normalizeDescription(e.description) || undefined;
    // Pris: källans strukturerade pris vinner (sanerat — skräp/långtext bort);
    // saknas det plockas ett SÄKERT pris ur beskrivningstexten (etiketterat
    // belopp / entré-fras — se priceFromText). 81 % av eventen saknade pris
    // fast det ofta stod i texten.
    e.price = sanitizePriceField(e.price);
    if (!e.price) {
        const fromText = extractPriceFromText(e.description);
        if (fromText) e.price = fromText;
    }
    return e;
}
