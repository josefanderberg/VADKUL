/**
 * venueFixes.ts — manuellt VERIFIERADE koordinater för platser som geokodats
 * fel (buggrapporter). Nattkedjan kör apply-venue-fixes.ts som idempotent:
 *   1. upsertar varje namn i known_venues (→ kandidat 0 i geocodeVenueSweden,
 *      så FRAMTIDA event på platsen geokodas rätt direkt),
 *   2. rensar geocode_cache-rader som matchar namnen (90-dagars felträffar
 *      annars kvar och vinner över nya uppslag i no-nearCity-vägen),
 *   3. flyttar BEFINTLIGA framtida event vars locationName matchar exakt
 *      (SQLite + Firestore via stamped).
 *
 * Det här är rätt hem för "kartnålen står i skogen"-rapporter — samma klass
 * som PARISH_CITY_ALIAS i repair-misplaced-geo (Sundsvall-tråden 6/8), men
 * för enskilda venues: en rad här i stället för ett oneoff-skript per rapport.
 * Koordinaten ska vara KONTROLLERAD mot källa (sajt/karta), inte gissad.
 */

export interface VenueFix {
    /** locationName-värden som hör till platsen — matchas EXAKT (trim +
     *  case-okänsligt). Exakt, inte substring: "Saga" får inte suga åt sig
     *  landets alla Saga-biografer. */
    names: string[];
    /** Stad för known_venues-radens cross-city-skydd. */
    city: string;
    lat: number;
    lng: number;
    /** Varifrån koordinaten kommer + vilken rapport som föranledde fixen. */
    note: string;
}

export const VENUE_FIXES: VenueFix[] = [
    {
        // Biografen Bio 3:an i Småstaden-gallerian, Hamngatan 52, Piteå.
        // Tre salonger (Saga/Röda Kvarn/Metropol) — samma byggnad, men
        // Tickster-eventen geokodades åt tre håll: Saga → en namne i skogen
        // 12 km SV om stan, Metropol → stadscentroiden, Röda Kvarn → en
        // tredje punkt. Rapport 27/8 ("salongen Saga ligger i skogen").
        // Koordinat: Småstaden/Hamngatan 52 (biograf-registerposter).
        names: ['Saga - Bio 3:an', 'Röda Kvarn - Bio 3:an', 'Metropol - Bio 3:an', 'Bio 3:an'],
        city: 'Piteå',
        lat: 65.32058,
        lng: 21.47594,
        note: 'Bio 3:an, Hamngatan 52 (Småstaden), Piteå — rapport 27/8, Saga-salongen låg i skogen',
    },
];

/** Exakt (trim + case-okänslig) matchning av ett locationName mot fixarna. */
export function matchVenueFix(locationName: string | null | undefined, fixes: VenueFix[] = VENUE_FIXES): VenueFix | null {
    const needle = (locationName ?? '').trim().toLowerCase();
    if (!needle) return null;
    for (const fix of fixes) {
        if (fix.names.some(n => n.trim().toLowerCase() === needle)) return fix;
    }
    return null;
}

/**
 * SKRIVVÄGSVAKTEN: tvinga verifierade koordinater på ett event vars
 * locationName matchar en fix — källkoordinater (Ticksters spretande
 * salongspunkter) och geokodningsträffar (Saga-namnen i skogen) räknas
 * inte när platsen är manuellt verifierad. Anropas CENTRALT i dbHelper
 * (addEventToDb + addEventsBatch, samma mönster som sanitizeEndDate) så
 * regeln gäller ALLA skrapare och kan inte glömmas i en ny källa.
 * Muterar eventet; returnerar true när koordinaterna sattes.
 */
export function applyVenueFixInPlace(
    e: { locationName?: string | null; lat?: number; lng?: number; isLocationVerified?: boolean; geoPrecision?: string },
    fixes: VenueFix[] = VENUE_FIXES,
): boolean {
    const fix = matchVenueFix(e.locationName, fixes);
    if (!fix) return false;
    e.lat = fix.lat;
    e.lng = fix.lng;
    e.isLocationVerified = true;
    e.geoPrecision = 'poi';
    return true;
}
