/**
 * junk.ts — FB-event som inte är event i Sverige: biljett-ÅTERFÖRSÄLJARE.
 *
 * Kvalitetsrevisionen 2026-09-03: 65 titlar slutade på " Tickets". Bakom
 * dem: "Laugh Seats" (22 event), "Ticket Deals", "Skånetrafiken biljett -
 * Sell/rent card" — sidor som skapar ett FB-event per artist-turnédatum
 * ("Ken Carson Tickets", "TLC Tickets") med amerikansk arena (Barclays
 * Center, Blossom Music Center) och säljtext. De slank förbi utlands-
 * filtret eftersom adressen inte kunde extraheras. Fever-eventen (guidade
 * turer i Stockholm) är riktiga upplevelser men bär samma "(Stockholm)
 * Tickets"-svans i titeln — de behålls, titeln städas.
 *
 * Ren modul, testad i junk.test.ts.
 */

/** Värdsidor som är rena biljettförsäljare/-resale — aldrig egna event. */
const RESELLER_HOST_RE = /^(?:ticket\s*deals?|laugh\s*seats|ticket(?:s)?\s*(?:hub|center|centre|market|resale|exchange)|cheap\s*tickets|viagogo|stubhub|seatgeek|vivid\s*seats|tickpick)\b|\b(?:sell\/rent|resale|återförsälj)/i;

/** Titel av typen "Artist Tickets" / "Artist  Tickets " (ren biljettannons). */
const TICKETS_TITLE_RE = /\s+tickets?\s*$/i;

/** Säljtext typisk för resale-sidor. */
const RESALE_TEXT_RE = /\b(?:get your tickets|tickets? (?:for sale|available|now on sale)|cheap(?:est)? tickets|buy tickets|resale|i have tickets)\b/i;

/** Platsen pekar på Sverige (", SE", "Sweden", svenskt postnummer). */
const SWEDISH_PLACE_RE = /\b(?:SE|Sverige|Sweden)\b|\b\d{3}\s?\d{2}\b/;

/**
 * Är eventet en biljettannons snarare än ett event?
 *  - värden är en känd återförsäljare, ELLER
 *  - titeln är "X Tickets" OCH texten är säljtext OCH platsen inte är svensk
 *    (Fever-turerna i Stockholm har både "Tickets"-titel och säljtext men en
 *    riktig Stockholmsadress — de är upplevelser, inte annonser).
 */
export function isResellerJunk(
    title: string,
    hostName: string | null | undefined,
    description: string | null | undefined,
    locationName?: string | null,
): boolean {
    const host = (hostName ?? '').trim();
    if (host && RESELLER_HOST_RE.test(host)) return true;
    if (TICKETS_TITLE_RE.test(title) && RESALE_TEXT_RE.test(description ?? '') && !SWEDISH_PLACE_RE.test(locationName ?? '')) return true;
    return false;
}

/**
 * Städa biljettsvansar ur FB-titlar: "Sailing Day Tour (Stockholm) Tickets"
 * → "Sailing Day Tour". Stads-parentesen tas bara när den sitter ihop med
 * Tickets-svansen (Fever-mönstret) — "(Stockholm)" mitt i en titel lämnas.
 */
export function cleanFacebookTitle(title: string): string {
    return title
        .replace(/\s*\((?:[^()]{2,30})\)\s+tickets?\s*$/i, '')
        .replace(TICKETS_TITLE_RE, '')
        .replace(/\s+/g, ' ')
        .trim() || title.trim();
}
