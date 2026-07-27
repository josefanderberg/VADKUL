// lib/outreach/visits.ts
//
// Sajtbesöks-räknaren: SiteVisitBeacon pingar /api/stats/visit en gång per
// webbläsare och dag → FieldValue.increment på outreachStats/siteVisits.
// Dagnyckeln räknas ALLTID i Europe/Stockholm — servern kör UTC i prod,
// och en UTC-nyckel skulle flytta kvällsbesöken till fel dygn.

export const VISITS_DOC = 'siteVisits';          // i collection 'outreachStats'

export function stockholmDayKey(ms: number): string {
    // sv-SE ger ISO-form: "2026-07-26"
    return new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'Europe/Stockholm', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date(ms));
}
