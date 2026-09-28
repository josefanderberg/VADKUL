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
    {
        // Kollektivet Livet (Stadsgårdsterminalen/gamla Birkaterminalen,
        // Stadsgårdsleden 19, Södermalm). TRE källor, TRE koordinater ~760 m
        // isär (rapport 10/9: samma konsert på två brickor "några hundra
        // meter ifrån"): egna sajten geokodades till Slussen (18.0712),
        // Nortic till Fotografiska-kvarteret (18.0846), Tickster nästan rätt.
        // Koordinat: OSM:s egen POI för scenen (node "Kollektivet Livet").
        names: [
            'Kollektivet Livet', 'Kollektivet Livet, Stockholm',
            'Kollektivet Livet Bar & Scen',
            'Kollektivet Livet (Lilla Scen)', 'Lilla Scen, Kollektivet Livet',
            'Kollektivet Livet (Stora scen)', 'Stora Scen, Kollektivet Livet',
            'Stora scen, Kollektivet Livet',
            'Kollektivet Livet (KL Terrassen)', 'KL Terrassen, Kollektivet Livet',
            'Hallen, Kollektivet Livet',
        ],
        city: 'Stockholm',
        lat: 59.31931,
        lng: 18.07831,
        note: 'Kollektivet Livet, Stadsgårdsleden 19 (OSM-POI) — rapport 10/9, tre källor spretade Slussen↔Fotografiska',
    },
    {
        // Kulturhuset Väven i Umeå. FB-rapport 25/9 (Skönsmon-gruppen, "event
        // 50 mil härifrån"): "Christoffer Nyqvist – Umeå, Väven" kom in via
        // Sundsvalls sök-kö, ankrades på Sundsvall och Nominatim hittade en
        // Väven-namne där (62.4067, 17.3348); "Program i Väven" (Vävens egen
        // programserie) låg samtidigt på Karlstads mittpunkt. Bara Umeå-huset
        // heter så. Koordinat: samma punkt som källornas korrekt geokodade
        // Väven-event ("Umeå, Väven" / "Väven, Vävenscenen, Umeå").
        names: ['Väven', 'Program i Väven'],
        city: 'Umeå',
        lat: 63.8256568,
        lng: 20.2630745,
        note: 'Kulturhuset Väven, Umeå — FB-rapport 25/9 (Skönsmon), "Väven" ur Sundsvalls-kön fick en namne i Sundsvall',
    },
    {
        // Isaberg Mountain Resort, Hestra. Visit Isabergsregionens "Plats"-fält
        // (28/9) geokodades till en punkt vid Kisa, 60 km bort.
        // Koordinat: OSM-noden "Isaberg Mountain Resort, Transporten, Hestra".
        names: ['Isaberg Mountain Resort'],
        city: 'Hestra',
        lat: 57.4349124,
        lng: 13.609752,
        note: 'Isaberg Mountain Resort, Hestra — OSM; Visit Isabergsregionen 28/9 hamnade vid Kisa',
    },
    {
        // Gislesalen i Musikskolan, Södra Storgatan 34, Gislaved. Visit Isaberg-
        // regionens platstext geokodades till Storgatan i Anderstorp (28/9).
        // Koordinat: Gislaveds Symfoniorkesters egen källkoordinat för salen.
        names: ['Gislesalen S Storgatan 34 Gislaved (Musikskolan)', 'Gislesalen, Musikskolan', 'Gislesalen'],
        city: 'Gislaved',
        lat: 57.29895,
        lng: 13.53051,
        note: 'Gislesalen/Musikskolan, Gislaved — orkesterns källkoordinat; Visit Isabergsregionen 28/9 hamnade i Anderstorp',
    },

    // ─── Hockeyarenor (28/9) ────────────────────────────────────────────────
    // stats.swehockey.se och sportality-ligorna ger BARA arenanamnet — ingen
    // ort, ingen koordinat. Sponsornamnen (Wibe Arena, VBO Arena, Coop
    // Norrbotten Arena …) finns inte i OSM, och utan ort kan runnern inte
    // stads-ankra frågan: 122 kommande SHL-/HockeyAllsvenskan-matcher låg på
    // 0,0 och syntes aldrig på kartan. Varje koordinat nedan är OSM-objektet
    // för hallen, korskollad mot HockeyAllsvenskans egna arenakoordinater
    // (hockeyallsvenskan.se/pages/matcher, homeTeam.arenaLatitude/-Longitude)
    // där laget spelar i HA — samstämmiga inom ~100 m.
    {
        names: ['Be-Ge Hockey Center', 'Be Ge Hockeycenter'],
        city: 'Oskarshamn',
        lat: 57.2637799,
        lng: 16.4361222,
        note: 'Be-Ge Hockey Center, Döderhultsvägen 5, Oskarshamn — OSM-nod 10144549589 + HA-ligans koordinat; swehockey-matcherna låg på 0,0 (28/9)',
    },
    {
        // Almtunas hemmahall. swehockey skriver "Gränby Ishallar A-hall",
        // HA-sajten "Gränby ishall".
        names: ['Gränby Ishallar A-hall', 'Gränby Ishallar', 'Gränby ishall'],
        city: 'Uppsala',
        lat: 59.8802371,
        lng: 17.6565848,
        note: 'Gränby ishallar, Råbyvägen 71, Uppsala — OSM-way 98822088 + HA-ligans koordinat; swehockey-matcherna låg på 0,0 (28/9)',
    },
    {
        // Mora IK:s hall — samma byggnad under flera sponsornamn: HA-sajten
        // säger venue "Wibe Arena" men teamArena "Smidjegrav Arena"; OSM
        // kallar den "Jalas Arena" (Hantverkaregatan).
        names: ['Wibe Arena', 'Smidjegrav Arena'],
        city: 'Mora',
        lat: 61.0069827,
        lng: 14.5308656,
        note: 'Wibe Arena (f.d. Smidjegrav/Jalas Arena), Hantverkaregatan 31, Mora — OSM-relation 15514912 + HA-ligans koordinat; låg på 0,0 (28/9)',
    },
    {
        // Luleå HF:s hall i Bergviken (gamla Delfinen). OSM: "Coop Arena";
        // Nominatim hittar inte "Coop Norrbotten Arena" och ett nearCity-
        // uppslag i Skellefteå-kön gav Skellefteås ortcentroid.
        names: ['Coop Norrbotten Arena'],
        city: 'Luleå',
        lat: 65.5978683,
        lng: 22.1482751,
        note: 'Coop Norrbotten Arena, Delfingatan/Bergviken, Luleå — OSM-way 155814842 ("Coop Arena"); SHL/SDHL-matcherna låg på 0,0 (28/9)',
    },
    {
        names: ['VBO Arena', 'Vimmerby Ishall'],
        city: 'Vimmerby',
        lat: 57.671908,
        lng: 15.8715516,
        note: 'VBO Arena (OSM "Vimmerby Ishall"), Kungsgatan 52, Vimmerby — OSM-way 268022311 + HA-ligans koordinat; låg på 0,0 (28/9)',
    },
    {
        names: ['Hägglunds Arena'],
        city: 'Örnsköldsvik',
        lat: 63.283881,
        lng: 18.7249665,
        note: 'Hägglunds Arena, Viktoriaesplanaden 1, Örnsköldsvik — OSM-way 93485452 + HA-ligans koordinat; swehockey-matcherna låg på 0,0 (28/9)',
    },
    {
        names: ['Hatstore Arena'],
        city: 'Kalmar',
        lat: 56.6681999,
        lng: 16.347558,
        note: 'Hatstore Arena, Kalmar — OSM-way 875517753 (ice_rink) + HA-ligans koordinat; swehockey-matcherna låg på 0,0 (28/9)',
    },
    {
        names: ['Visby Ishall'],
        city: 'Visby',
        lat: 57.6262402,
        lng: 18.329611,
        note: 'Visby ishall, Rävhagen, Visby — OSM-way 9357257 + HA-ligans koordinat; swehockey-matcherna låg på 0,0 (28/9)',
    },
    {
        // SDE Hockeys hemmahall (SDHL).
        names: ['Enebybergs Ishall', 'Enebybergshallen'],
        city: 'Danderyd',
        lat: 59.4253473,
        lng: 18.0277713,
        note: 'Enebybergshallen (sport=ice_hockey), Enebybergs IP, Danderyd — OSM-way 20907879; SDHL-matchen låg på 0,0 (28/9)',
    },
    {
        // "Östersund Arena Hall A" (swehockey) geokodades till en ortcentroid
        // 4,5 km söder om hallen; HA-sajtens "Östersund Arena" låg redan rätt.
        names: ['Östersund Arena Hall A', 'Östersund Arena'],
        city: 'Östersund',
        lat: 63.196044,
        lng: 14.6609381,
        note: 'Östersund Arena, Lugnvik, Östersund — OSM-way 451773679 + HA-ligans koordinat; swehockey-namnet låg på ortcentroiden (28/9)',
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
