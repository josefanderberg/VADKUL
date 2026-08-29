// lib/outreach/visits.ts
//
// Sajtbesöks-räknaren: SiteVisitBeacon pingar /api/stats/visit en gång per
// webbläsare och dag → FieldValue.increment på outreachStats/siteVisits.
// Dagnyckeln räknas ALLTID i Europe/Stockholm — servern kör UTC i prod,
// och en UTC-nyckel skulle flytta kvällsbesöken till fel dygn.

export const VISITS_DOC = 'siteVisits';          // i collection 'outreachStats'
// Per-stad-räknaren (Josef 26/8): stadssidornas besök, ett dokument med
// cities.<slug>.total + cities.<slug>.days.<ÅÅÅÅ-MM-DD>. INTERN statistik —
// det publika läs-API:et (/api/stats/city-visits) och besökskolumnen på
// /evenemang togs bort 29/8 på ägarbeslut; siffrorna ska inte visas publikt.
export const CITY_VISITS_DOC = 'cityVisits';     // i collection 'outreachStats'

export function stockholmDayKey(ms: number): string {
    // sv-SE ger ISO-form: "2026-07-26"
    return new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'Europe/Stockholm', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date(ms));
}

/** De senaste `n` dagarnas nycklar (svensk tid), idag först. Besöksveckan är
 *  BAKÅTBLICKANDE (idag + 6 dagar bakåt) — till skillnad från eventens
 *  weekKeys i periods.ts som blickar framåt: besök kan inte ligga i framtiden. */
export function lastNDayKeys(n: number, nowMs: number): string[] {
    return Array.from({ length: n }, (_, i) => stockholmDayKey(nowMs - i * 86_400_000));
}
