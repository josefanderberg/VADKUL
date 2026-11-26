/**
 * Ankarstad för FB-kedjans venue-geokodning.
 *
 * Kontextstaden kommer från sök-kön/sidbevakningen — den säger var vi LETADE,
 * inte var eventet ÄR. FB korspostar friskt (delningar i stadsgrupper, fuzzy
 * sök), så turnéshower dyker upp i fel städers köer: Skönsmon-rapporten 25/9
 * ("event 50 mil härifrån") var "Christoffer Nyqvist – Umeå, Väven" ur
 * Sundsvalls-kön — kedjan ankrade "Väven" på Sundsvall och Nominatim hittade
 * lydigt en namne där. Samma natt låg ~25 FB-event i fel stad av samma skäl
 * (Betnér/Skellefteå i Karlstad, Månegarm/Umeå i Stockholm, Palladium/Malmö i
 * Västerås …).
 *
 * Samma princip som centroidGuard regel 3: sökordets ort är bara en gissning —
 * eventets EGEN text väger tyngre. Override:a kontextstaden bara när allt håller:
 *   1. kontextstaden nämns INTE någonstans i titel/adress/beskrivning
 *      (nämns den är kontexten bekräftad — hemmalagets stad, avresestaden …),
 *   2. adressen eller titeln nämner exakt EN annan känd stad
 *      (två olika, "Buss Göteborg–Malmö", är tvetydigt → rör inget).
 * Adressen väger tyngre än titeln: "Härnösands Riksteaterförening" slår
 * gästspelstiteln "… – Piteå Kammaropera" — gästspelet ÄR i Härnösand.
 *
 * Ett SVAGT bevis (staden nämns bara i titeln) får aldrig nå centroid-
 * fallbacken: det vinner bara med en specifik träff (poi/gata), annars körs
 * ordinarie kedja med kontextstaden ("SCA Arena" + bortalagstiteln "… –
 * Skellefteå AIK" får inte flytta hemmamatchen till Skellefteås mittpunkt).
 *
 * Ett STARKT bevis (lokalnamnet nämner orten, eller ett helt titelsegment är
 * orten) får vinna med en mittpunkt när köns kedja bara gav köns mittpunkt
 * (#291: "Medborgarhuset i Säffle" ur Uppsala-kön låg mitt i Uppsala). Köns
 * mittpunkt är en ren gissning; textens ort är eventets egen uppgift. Se
 * preferTextHit för exakt när.
 */

import { cityMentioned, findKnownCities } from '../../utils/cityInText';
import { postalTown } from '../../utils/swedishAddress';
import { isPlaceName, isAmbiguousTownName, uniqueTatortNamesForScan, lookupTownRow } from '../../utils/sqliteHelper';
import { precisionRank } from '../../utils/geocodeChain';
import type { GeoHit } from '../../utils/venueCoordinates';

/**
 * Ankarstaden för adressens geokodning: postorten när adressen har ett
 * svenskt postnummer och orten finns i SCB-registret, annars kontextstaden.
 * Postorten är eventets egen uppgift; köns stad bara var vi letade. Mölnlycke
 * ur Uppsala-kön, Karlskoga ur Eskilstunas och Delsbo ur Hudiksvalls hamnade
 * alla i köns stad (#247, platsgranskningen 15/11). isPlace injiceras för test.
 */
export function addressAnchorCity(
    address: string, contextCity: string | null | undefined,
    isPlace: (name: string) => boolean = isPlaceName,
): string | undefined {
    const town = postalTown(address);
    if (town && isPlace(town)) return town;
    return contextCity || undefined;
}

export interface AnchorCityInput {
    /** Staden från sök-kön/sidbevakningen (source.city) — kan saknas. */
    contextCity: string | null | undefined;
    title: string;
    /** Extraherad adress/platssträng från eventsidan. */
    address: string;
    description: string;
}

/**
 * Hur starkt eventets egen text pekar ut orten (#291).
 *   'stark'  adressen nämner orten och eventet bekräftar den ("Medborgarhuset
 *            i Säffle"; "Forumteatern Köping" + titeln "… | Köping"), eller
 *            ett helt titelsegment ÄR orten ("Viktor Norén | Julturné |
 *            Säffle"). Får vinna även med en mittpunkt när köns kedja inte
 *            hittar lokalen — se preferTextHit.
 *   'svag'   orten nämns bara någonstans i titeln ("… – Skellefteå AIK"),
 *            eller lokalnamnet bara bär ett ortnamn ("Nordanå teatern"):
 *            vinner bara med en specifik träff (poi/gata), som förut.
 */
export interface AnchorEvidence {
    city: string;
    strength: 'stark' | 'svag';
    from: 'adress' | 'titel';
}

/** Ortsuppslag mot SCB-registret — injiceras i test (ingen riktig DB där). */
export interface PlaceLookup {
    /** Entydiga tätortsnamn (≥5 tecken) som kan stå i fritext, längsta först. */
    scanNames: () => string[];
    /** Är strängen i sin helhet en entydig ort (tätort eller kommun)? */
    isTown: (name: string) => boolean;
}

/**
 * Små tätorter delar namn med stadsdelar och platser på annat håll: "Front
 * Lindholmen" (Göteborg) mot Lindholmen i Vallentuna, "Arena Moliden",
 * "Bokskogen i Torup" (Malmö) mot Torup i Hylte. Mätt 26/11 (#291): alla
 * riktiga fall låg över 2 000 invånare (Grängesberg 2 119 minst), alla
 * namnar under (Torup 1 268, Lindholmen 1 264, Furuvik 749). Kommunnamn och
 * centralorter räknas oavsett storlek.
 */
const MIN_TOWN_POPULATION = 2000;
function notableTown(name: string): boolean {
    const row = lookupTownRow(name);
    if (!row) return true;   // kommunnamn utan egen tätort (Nacka)
    return (row.bef ?? 0) >= MIN_TOWN_POPULATION || (row.kommun ?? '').toLowerCase() === name.toLowerCase();
}

// Filtret räknas om när registret laddas om (ny lista ur sqliteHelper).
let notableFrom: string[] | null = null;
let notableScanNames: string[] = [];
function notableTownNamesForScan(): string[] {
    const all = uniqueTatortNamesForScan();
    if (all !== notableFrom) { notableFrom = all; notableScanNames = all.filter(notableTown); }
    return notableScanNames;
}

const REGISTER_PLACES: PlaceLookup = {
    scanNames: notableTownNamesForScan,
    isTown: (n) => isPlaceName(n) && !isAmbiguousTownName(n) && !COUNTRY_NAMES.has(n.toLowerCase()) && notableTown(n),
};

/** Länder som också är svenska tätorter (Danmark i Uppsala): "…, 7160 Tørring, Danmark". */
const COUNTRY_NAMES = new Set(['danmark', 'norge', 'finland', 'sverige', 'island', 'tyskland', 'polen']);

/**
 * Registrets orter i en adress/ett lokalnamn. Samma vakter som stadslistans
 * cityMentioned: ordgräns, genitiv ("Köpings Kyrka"), väderstrecks-/storleks-
 * prefix ("Stora Kopparbergs kyrka" ligger i Falun, inte i Kopparberg) och
 * "Ort <siffra>" (byadress). Ett namn inuti ett längre träffat namn räknas
 * inte för sig. Namnet måste stå med versal som i registret: tätorter som
 * också är vanliga ord ("Lillstrimma hallen" → Hallen i Åre) faller då bort.
 */
export function registerTownsInText(text: string, places: PlaceLookup = REGISTER_PLACES): string[] {
    const t = text || '';
    if (t.length < 5) return [];
    const hits = places.scanNames().filter((n) =>
        !COUNTRY_NAMES.has(n.toLowerCase()) && t.includes(n) && cityMentioned(t, n));
    return hits.filter((n) => !hits.some((m) => m !== n && m.toLowerCase().includes(n.toLowerCase())));
}

/** "Medborgarhuset i Säffle", "Johanneskyrkan, Vännäs": adressen säger själv var. */
function locativeIn(address: string, town: string): boolean {
    const esc = town.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(?:(?:^|\\s)i\\s+|,\\s*)${esc}(?=$|[\\s,.)])`, 'iu').test(address || '');
}

/**
 * Titelns segment. Turnéarrangörerna skriver orten som eget segment:
 * "Viktor Norén | Julturné | Säffle", "Arne Alligator | Nacka | 15 november",
 * "Historia Nu I Malmö I 14 nov" (versalt I som avgränsare), "Al Pitcher •
 * 26/11 • Vänersborg". Komma och tankstreck avgränsar också ("Christoffer
 * Nyqvist – Umeå, Väven").
 */
export function titleSegments(title: string): string[] {
    return (title || '')
        .split(/\s*\|\s*|\s+[–—•·-]\s+|,\s+|\s+I\s+/)
        .map((s) => s.trim())
        .filter(Boolean);
}

/** Orter som utgör ett helt titelsegment (eller "… i <ort>" i slutet av ett). */
function townSegments(title: string, places: PlaceLookup): string[] {
    const out: string[] = [];
    for (const seg of titleSegments(title)) {
        const tail = /(?:^|\s)i\s+(\p{Lu}[\p{L}-]+)$/u.exec(seg)?.[1];
        for (const cand of [seg, tail]) {
            // ≥4 tecken: Vi, Ed, Ås, Vad är också vanliga ord.
            if (!cand || cand.length < 4 || /\d/.test(cand)) continue;
            if (places.isTown(cand)) { out.push(cand); break; }
        }
    }
    return out;
}

function dedupe(names: string[]): string[] {
    const seen = new Map<string, string>();
    for (const n of names) if (!seen.has(n.toLowerCase())) seen.set(n.toLowerCase(), n);
    return [...seen.values()];
}

/**
 * Orten ur eventets egen text som ska ersätta kontextstaden, och hur starkt
 * texten pekar ut den. null = ingen override.
 *
 * Kontextstadens 95 städer (SWEDISH_GEO_CITIES) räckte inte: Säffle, Köping,
 * Ludvika och Vara finns inte där, så Jubels julturné-event ur Uppsala-kön
 * föll till Uppsalas mittpunkt (#291). Adressen läses därför också mot
 * SCB-registret, och titelns segment prövas som hela ortnamn.
 */
export function anchorCityEvidence(
    input: AnchorCityInput, places: PlaceLookup = REGISTER_PLACES,
): AnchorEvidence | null {
    const context = (input.contextCity || '').trim();
    if (!context) return null;

    const ownText = [input.title, input.address, input.description].filter(Boolean).join('\n');
    if (cityMentioned(ownText, context)) return null;

    const notContext = (c: string) => c.toLowerCase() !== context.toLowerCase();

    // 1. Adressen. En entydig ort där är stark om eventet säger samma sak en
    //    gång till: titeln eller beskrivningen nämner orten, eller adressen
    //    säger själv "i Säffle"/", Vännäs". Ett lokalnamn som bara BÄR ett
    //    ortnamn ("Nordanå teatern" i Skellefteå, "Restaurang Stockholm") är
    //    svagt. Pekar adressen på två orter ("Marieholm, Gnosjö kommun") gäller
    //    gamla regeln: en ensam känd stad, svag.
    const address = input.address || '';
    const knownInAddress = findKnownCities(address).filter(notContext);
    const inAddress = dedupe([...knownInAddress, ...registerTownsInText(address, places)]).filter(notContext);
    if (inAddress.length === 1) {
        const city = inAddress[0];
        const corroborated = cityMentioned([input.title, input.description].filter(Boolean).join('\n'), city)
            || locativeIn(address, city);
        return { city, strength: corroborated ? 'stark' : 'svag', from: 'adress' };
    }
    if (knownInAddress.length === 1) return { city: knownInAddress[0], strength: 'svag', from: 'adress' };
    if (inAddress.length > 1) return null;

    // 2. Titeln: ett helt segment som är en ort.
    const segTowns = dedupe(townSegments(input.title || '', places)).filter(notContext);
    if (segTowns.length === 1) return { city: segTowns[0], strength: 'stark', from: 'titel' };
    if (segTowns.length > 1) return null;

    // 3. En känd stad som bara nämns i titeln. Bortalagstitlar ("Timrå IK –
    //    Skellefteå AIK") hamnar här, och därför är den svag.
    const inTitle = findKnownCities(input.title || '').filter(notContext);
    return inTitle.length === 1 ? { city: inTitle[0], strength: 'svag', from: 'titel' } : null;
}

/** Stad ur eventets egen text som ska ersätta kontextstaden, eller null. */
export function anchorCityOverride(input: AnchorCityInput, places?: PlaceLookup): string | null {
    return anchorCityEvidence(input, places)?.city ?? null;
}

/**
 * Ska träffen i textens ort vinna över ordinarie kedjans (ankrad på köns
 * stad)? Ren funktion.
 *
 *   - Specifik träff (poi/gata) i textens ort vinner alltid (som förut).
 *   - Svagt bevis: bara så.
 *   - Starkt bevis: vinner också med en mittpunkt, när köns kedja inte gav
 *     något bättre än en mittpunkt. "Medborgarhuset i Säffle" ur Uppsala-kön
 *     gav Uppsalas mittpunkt (#291). En lokal som kedjan faktiskt hittade
 *     ("SCA Arena" i köns stad) står kvar: en mittpunkt slår aldrig en lokal.
 */
export function preferTextHit(
    evidence: AnchorEvidence | null,
    textHit: GeoHit | null,
    ordinary: GeoHit | null,
): boolean {
    if (!evidence || !textHit) return false;
    if (textHit[2] === 'poi' || textHit[2] === 'gata') return true;
    if (evidence.strength !== 'stark') return false;
    return !ordinary || precisionRank(ordinary[2]) < 3;
}
