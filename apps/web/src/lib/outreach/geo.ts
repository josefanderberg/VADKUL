// lib/outreach/geo.ts
//
// Ort ur ett facebookgruppnamn: "Vad händer i Kvänum, Vara, Skara med omnejd"
// → { name: 'Kvänum', lat: 58.28, lng: 13.18, confidence: 'gissad' }.
//
// Varför detta behövs: import-outreach-md.ts sätter aldrig lat/lng för de
// grupper som saknar egen stadssida ("Ort ur namnet är opålitligt"). Följden
// är att coordForContact() returnerar null för ~58 av 85 grupper, vilket i sin
// tur gör att eventSupplyForContact() ger undefined och scoring.ts faller
// tillbaka på 0.3 — två tredjedelar av kön rankas alltså på en gissning, och
// eventPicker kan inte plocka lokala event åt dem.
//
// Ort ur namnet ÄR opålitligt i största allmänhet. Men det här är inte
// godtyckliga namn utan 85 kända rader ur facebook-grupplista.md, och
// mönstren i dem är få. Därför: parsa det som går, slå upp exakt mot
// CITY_POINTS (291 orter), och FLAGGA allt som krävde en gissning så att
// ägaren kan rätta det i kartan i stället för att koordinaten tyst blir fel.
//
// Rent klient-säkert (ingen fs) — samma skäl som cityPoints.ts.

import { CITY_POINTS, findCityPoint, type CityPoint } from '@/utils/cityPoints';

export type GeoConfidence = 'exakt' | 'gissad';

export interface GeoHit {
    /** Ortnamnet vi landade på — INTE gruppnamnet. */
    name: string;
    lat: number;
    lng: number;
    /** 'gissad' ⇒ visa streckad kant i kartan och be ägaren titta på den. */
    confidence: GeoConfidence;
    /** Textfragmentet vi slog upp, för felsökning i --dry-run. */
    matchedOn: string;
}

/**
 * Orter, stadsdelar och landskap som INTE finns i CITY_POINTS men som
 * förekommer i gruppnamnen. Handsatta koordinater, 2 decimaler ≈ ±0,5 km —
 * samma precision som CITY_POINTS och gott nog för en 25 km-radie.
 *
 * Stadsdelarna pekar på stadsdelens egen mittpunkt, inte på stadskärnan:
 * "Vad händer i Frölunda" ska ranka Frölunda-event högst, och eventPicker
 * väger ändå in 8 km-regeln ovanpå radien.
 *
 * Landskap/regioner (Värmland, Västmanland, Västra Götaland, Österlen) pekar
 * på residensstaden respektive områdets mitt. De flaggas alltid 'gissad' —
 * en region ÄR inte en punkt, och radien ljuger mer där än någon annanstans.
 */
const EXTRA_PLACES: Record<string, CityPoint & { region?: true }> = {
    /* Göteborgs stadsdelar */
    majorna: { name: 'Majorna', lat: 57.69, lng: 11.92 },
    linne: { name: 'Linnéstaden', lat: 57.69, lng: 11.95 },
    kungsladugard: { name: 'Kungsladugård', lat: 57.69, lng: 11.91 },
    frolunda: { name: 'Västra Frölunda', lat: 57.65, lng: 11.91 },
    lundby: { name: 'Lundby', lat: 57.72, lng: 11.93 },
    hisingen: { name: 'Hisingen', lat: 57.73, lng: 11.93 },
    hogsbohojd: { name: 'Högsbohöjd', lat: 57.66, lng: 11.93 },

    /* Stockholms stadsdelar och förorter */
    sodermalm: { name: 'Södermalm', lat: 59.31, lng: 18.07 },
    ostermalm: { name: 'Östermalm', lat: 59.34, lng: 18.09 },
    skogas: { name: 'Skogås', lat: 59.22, lng: 18.13 },
    trangsund: { name: 'Trångsund', lat: 59.23, lng: 18.13 },
    lanna: { name: 'Länna', lat: 59.20, lng: 18.15 },

    /* Mindre orter och bygder utanför CITY_POINTS */
    tjorn: { name: 'Tjörn', lat: 58.00, lng: 11.55 },
    aker: { name: 'Åkers styckebruk', lat: 59.24, lng: 17.00 },
    torshalla: { name: 'Torshälla', lat: 59.42, lng: 16.48 },
    byske: { name: 'Byske', lat: 64.94, lng: 21.20 },
    harads: { name: 'Harads', lat: 66.08, lng: 20.96 },
    granna: { name: 'Gränna', lat: 58.03, lng: 14.46 },
    kvanum: { name: 'Kvänum', lat: 58.28, lng: 13.18 },
    kville: { name: 'Kville', lat: 58.63, lng: 11.38 },
    vaddo: { name: 'Väddö', lat: 59.97, lng: 18.80 },
    yxlan: { name: 'Yxlan', lat: 59.75, lng: 18.90 },
    dellenbygden: { name: 'Dellenbygden', lat: 61.80, lng: 16.57 },
    lister: { name: 'Listerlandet', lat: 56.03, lng: 14.50 },

    /* Landskap och regioner — alltid 'gissad' */
    gotland: { name: 'Gotland', lat: 57.64, lng: 18.30, region: true },
    varmland: { name: 'Värmland', lat: 59.38, lng: 13.50, region: true },
    vastmanland: { name: 'Västmanland', lat: 59.61, lng: 16.55, region: true },
    vastragotaland: { name: 'Västra Götaland', lat: 57.71, lng: 11.97, region: true },
    osterlen: { name: 'Österlen', lat: 55.56, lng: 14.28, region: true },
};

/** Samma normalisering som cityPoints.ts sökrutan använder. */
const key = (s: string) =>
    s.toLowerCase()
        .replace(/[åä]/g, 'a')
        .replace(/ö/g, 'o')
        .replace(/[éè]/g, 'e')
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]/g, '');

/**
 * Mönstren som faktiskt förekommer i facebook-grupplista.md, mest specifika
 * först. Grupp 1 i varje uttryck är ortfragmentet.
 *
 * Ordningen spelar roll: "Halmstad - Vad händer i stan med omnejd" måste
 * träffa ORT-FÖRST-mönstret innan "vad händer i"-mönstret hinner plocka
 * "stan".
 */
const PATTERNS: RegExp[] = [
    // "Halmstad - Vad händer i stan", "Norrtälje - Vad händer på byn"
    /^(.+?)\s*[-–—]\s*vad händer\b/i,
    // "Tjörn vad händer", "Åstorp, vad händer på byn", "Älmhultsbor, vad händer"
    /^(.+?),?\s+vad händer\b/i,
    // "Vad händer i X", "Vad Händer På X", "Vad som händer i X",
    // "Du vet vad som händer i X"
    /\bvad (?:som )?händer\s+(?:i|på)\s+(.+)$/i,
    // "Det händer i X", "Händer i X", "Händer i Karlstad-Tipsa om..."
    /\bhänder\s+(?:i|på)\s+(.+)$/i,
    // "Evenemang på Gotland"
    /^evenemang\s+(?:i|på)\s+(.+)$/i,
    // "På gång i Värmland - Vi tipsar om..."
    /^på gång\s+(?:i|på)\s+(.+)$/i,
    // "Vi som älskar Gotland"
    /^vi som älskar\s+(.+)$/i,
];

/** Suffix som aldrig är en del av ortnamnet. */
const TAIL_NOISE = [
    /\bmed omnejd\b.*$/i,
    /\boch omnejd\b.*$/i,
    /\bmed omgivning(?:ar)?\b.*$/i,
    /\bnöjen\s*&?\s*event\b.*$/i,
    /\bbara bilder\b.*$/i,
    /\btipsa om.*$/i,
    /\bvi tipsar om.*$/i,
    /\b\d+[.,]\d+\s*$/,        // "Kungsör 2.0"
    /\bi stan\b.*$/i,
    /\bpå byn\b.*$/i,
];

/** Riktningsord framför ortnamnet ("östra Göteborg"). */
const DIRECTION = /^(?:norra|södra|östra|västra|inre|yttre|gamla|nya)\s+/i;

/** Kommun-ändelser, inklusive genitiv: "Gagnefs kommun" → "Gagnef". */
const KOMMUN = /\s*(?:s)?\s*kommun(?:en)?\b.*$/i;

/** Emoji, flaggor, symboler och allt efter en varningstriangel. */
function stripDecoration(s: string): string {
    return s
        .replace(/⚠️?[\s\S]*$/u, ' ')                       // regelrutan i gruppnamnet
        .replace(/\([^)]*\)/g, ' ')                          // "(Söderhamns Nytt)", "(38,2t medl.)"
        .replace(/[\p{Extended_Pictographic}\p{Emoji_Presentation}️‍]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Plockar isär ortfragmentet till ett rent ortnamn.
 * Returnerar även om vi behövde gissa (flera orter, riktningsord, region).
 */
function trimPlace(fragment: string): { place: string; guessed: boolean } {
    let s = fragment.trim();
    let guessed = false;

    for (const re of TAIL_NOISE) s = s.replace(re, ' ');
    s = s.replace(/\s+/g, ' ').trim();

    // Flera orter i namnet ("Kvänum, Vara, Skara", "Åmål och Säffle",
    // "Landskrona och Kävlinge", "Sölvesborg och på Lister") → ta den första
    // och flagga. Den första är gruppens huvudort i samtliga fall i listan.
    const split = s.split(/\s*(?:,|\/|\boch\b|\bsamt\b)\s*/i);
    if (split.length > 1 && split[0].trim().length >= 2) {
        s = split[0];
        guessed = true;
    }

    s = s.replace(KOMMUN, ' ').replace(/\s+/g, ' ').trim();

    if (DIRECTION.test(s)) {
        s = s.replace(DIRECTION, '').trim();
        guessed = true;
    }

    // Avslutande skiljetecken: "Åker.", "Kungsbacka ?", "Stockholm!"
    s = s.replace(/[\s.,;:!?"'`´–—-]+$/u, '').trim();

    return { place: s, guessed };
}

/** Slår upp ett rent ortnamn i CITY_POINTS, sedan i EXTRA_PLACES. */
function lookup(place: string): { hit: CityPoint; guessed: boolean } | null {
    const exact = findCityPoint(place);
    if (exact) return { hit: exact, guessed: false };

    const extra = EXTRA_PLACES[key(place)];
    if (extra) return { hit: extra, guessed: extra.region === true };

    return null;
}

/**
 * Ort ur ett facebookgruppnamn, eller null om namnet inte går att tyda.
 *
 * null är ett HEDERLIGT svar — kontakten hamnar då i "saknar koordinat"-listan
 * i kartan och ägaren sätter den för hand. Att gissa vilt vore värre: en
 * felplacerad nål ser lika riktig ut som en rätt.
 */
export function cityFromGroupName(raw: string): GeoHit | null {
    const cleaned = stripDecoration(raw);
    if (!cleaned) return null;

    // Kandidater: varje mönster som träffar, i ordning. Vi testar alla och
    // tar första som faktiskt går att slå upp — så räddas "Vad händer i
    // Lundby (Hisingen)" även om parentesen redan strippats bort.
    const fragments: string[] = [];
    for (const re of PATTERNS) {
        const m = cleaned.match(re);
        if (m?.[1]) fragments.push(m[1]);
    }
    // Sista utvägen: hela namnet (fångar "Händer i Borås"-varianter som redan
    // matchat, men även rena ortnamn utan fras).
    fragments.push(cleaned);

    for (const fragment of fragments) {
        const { place, guessed } = trimPlace(fragment);
        if (place.length < 2) continue;

        const found = lookup(place);
        if (found) {
            return {
                name: found.hit.name,
                lat: found.hit.lat,
                lng: found.hit.lng,
                confidence: guessed || found.guessed ? 'gissad' : 'exakt',
                matchedOn: place,
            };
        }
    }

    return null;
}

/**
 * Alla orter vi kan geokoda till — CITY_POINTS plus stadsdelarna/regionerna.
 * Vitfläcksanalysen använder CITY_POINTS direkt; den här finns för att
 * kartans "saknar koordinat"-lista ska kunna erbjuda en rullista.
 */
export const ALL_PLACES: CityPoint[] = [
    ...CITY_POINTS,
    ...Object.values(EXTRA_PLACES).map(({ name, lat, lng }) => ({ name, lat, lng })),
];
