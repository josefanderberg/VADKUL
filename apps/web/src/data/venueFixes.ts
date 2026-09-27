// SPEGLAD från apps/scraper/src/data/venueFixes.ts — lägger du till en fix
// där ska raden in HÄR också (webben kan inte importera över appgränsen).
// Webbens exemplar driver LÄS-VAKTEN i /api/events/[layer]: minins
// re-aggregat kan bära gamla koordinater tills dess SQLite synkat
// (Piteå 5/9 — skogen återkom efter varje ombygge), så verifierade
// koordinater tvingas även vid UTLÄMNING. När pipelinen är läkt är vakten
// en no-op.

export interface VenueFix {
    /** locationName-värden som hör till platsen — matchas EXAKT (trim +
     *  case-okänsligt). Exakt, inte substring: "Saga" får inte suga åt sig
     *  landets alla Saga-biografer. */
    names: string[];
    city: string;
    lat: number;
    lng: number;
    note: string;
}

export const VENUE_FIXES: VenueFix[] = [
    {
        names: ['Saga - Bio 3:an', 'Röda Kvarn - Bio 3:an', 'Metropol - Bio 3:an', 'Bio 3:an'],
        city: 'Piteå',
        lat: 65.32058,
        lng: 21.47594,
        note: 'Bio 3:an, Hamngatan 52 (Småstaden), Piteå — rapport 27/8, Saga-salongen låg i skogen',
    },
    {
        // Speglar scraper-raden 10/9 (saknades här tills 25/9).
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
        // Kulturhuset Väven i Umeå. FB-rapport 25/9 (Skönsmon-gruppen): "Väven"
        // ur Sundsvalls sök-kö geokodades till en namne i Sundsvall (62.4067,
        // 17.3348) och "Program i Väven" till Karlstads mittpunkt. Bara
        // Umeå-huset heter så.
        names: ['Väven', 'Program i Väven'],
        city: 'Umeå',
        lat: 63.8256568,
        lng: 20.2630745,
        note: 'Kulturhuset Väven, Umeå — FB-rapport 25/9 (Skönsmon), "Väven" ur Sundsvalls-kön fick en namne i Sundsvall',
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

/** Tvinga verifierade koordinater på ett event vars locationName matchar en
 *  fix. Muterar eventet; returnerar true när koordinaterna sattes. */
export function applyVenueFixInPlace(
    e: { locationName?: string | null; lat?: number; lng?: number },
    fixes: VenueFix[] = VENUE_FIXES,
): boolean {
    const fix = matchVenueFix(e.locationName, fixes);
    if (!fix) return false;
    e.lat = fix.lat;
    e.lng = fix.lng;
    return true;
}
