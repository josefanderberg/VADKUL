/**
 * Svensk gatuadress-extraktion ur fritext — plus postort (postalTown) och
 * platsblock rad för rad (placeFromLines).
 *
 * Två mönster:
 *   1. Sammansatt gatunamn — ETT versal-inlett ord som slutar på gatusuffix:
 *      "Storgatan 12", "Linnéallén 3", "Kungsträdgårdsgatan 8B"
 *   2. Fristående vägord efter 1–2 namnord:
 *      "Hilding Hjelmbergs väg 5", "Västra Esplanaden 9A"
 *
 * Vägnummer i löptext ("Följ väg 23 norrut") filtreras via stopplista på
 * ordet före vägordet.
 */

const COMPOUND_STREET =
    '[A-ZÅÄÖÉ][a-zåäöé\\-]{2,}' +
    '(?:gatan|gata|vägen|torget|platsen|allén|allé|gränden|gränd|stigen|leden|' +
    'esplanaden|promenaden|kajen|hamnen|backen|parken|terrassen|plan)';
const ROAD_WORD =
    '(?:[Vv]äg(?:en)?|[Gg]atan?|[Aa]llén?|[Gg]ränd(?:en)?|[Tt]org(?:et)?|' +
    '[Pp]lan|[Pp]lats(?:en)?|[Ee]splanad(?:en)?|[Ss]tig(?:en)?|[Ll]ed(?:en)?)';
const SEPARATE_STREET = `(?:[A-ZÅÄÖÉ][a-zåäöé\\-.]+\\s+){1,2}${ROAD_WORD}`;
const STREET_RE = new RegExp(
    `\\b(${COMPOUND_STREET}|${SEPARATE_STREET})\\s+(\\d{1,4}[A-Za-z]?)\\b`,
    'u',
);
const STOP_FIRST_WORD =
    /^(?:följ|längs|via|mot|från|till|ta|tag|kör|gå|vid|efter|innan|korsa|sväng|på|i|och|eller|samt|nära|intill|bakom|framför|genom|över|under)\s/i;

/** Plocka första rimliga svenska gatuadressen ("Storgatan 12") ur en text. */
export function extractStreetAddress(text: string | null | undefined): string | null {
    if (!text) return null;
    const m = text.match(STREET_RE);
    if (!m) return null;
    const street = m[1].trim();
    if (street.includes(' ') && STOP_FIRST_WORD.test(street)) return null;
    const nr = m[2].trim();
    return `${street} ${nr}`;
}

/** Postnummer (med valfritt "SE-") i början av en rad eller efter mellanslag/komma. */
const POSTAL_RE = /(?:^|[\s,]|SE-)\d{3}\s?\d{2}\s+([^\d,.;:()]{2,40})/;
const POSTAL_LINE_RE = /^(?:SE-)?\d{3}\s?\d{2}\s/;

/** "UMEÅ" → "Umeå", "DALS-ED" → "Dals-Ed"; text i blandat skiftläge lämnas orörd. */
function unshout(s: string): string {
    if (s !== s.toUpperCase() || s === s.toLowerCase()) return s;
    return s.toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (_m, sep: string, ch: string) => sep + ch.toUpperCase());
}

/**
 * Postorten ur en svensk adressrad: "…, 846 94 Vemdalen" → "Vemdalen",
 * "906 27  UMEÅ" → "Umeå" (postens versaler normaliseras), "55322 Jönköping."
 * → "Jönköping". null när raden saknar postnummer.
 */
export function postalTown(text: string | null | undefined): string | null {
    if (!text) return null;
    const m = text.match(POSTAL_RE);
    if (!m) return null;
    const town = m[1].replace(/\s+/g, ' ').trim();
    return /^\p{Lu}/u.test(town) ? unshout(town) : null;
}

/** Platshållare/online — ingen plats att kartlägga. */
const NO_PLACE_RE = /\b(?:online|digital\w*|distans|zoom|webben|meddelas|uppdateras|senare|nedan|tba)\b/i;

/**
 * Ett platsblock rad för rad (NBV:s "Om arrangemanget"-kort):
 *   ["Ersboda Folkets Hus, Byttgränd 13", "906 27  UMEÅ"]
 *   → venue "Ersboda Folkets Hus", adress "Ersboda Folkets Hus, Byttgränd 13", ort "Umeå".
 * Första segmentet är venue (ibland gatan själv: "Källgatan 11"), hela raden
 * adressen när den har flera segment — samma tolkning som splitIcsLocation.
 * Online-event och platshållare ("exakt plats uppdateras senare") ger ingen
 * plats. Utan postort lämnas adressen bort och en venue med husnummer också:
 * en gatuadress utan ort är tvetydig i en rikstäckande källa (Skolgatan 48
 * finns i många städer).
 */
export function placeFromLines(lines: string[]): { venueName?: string; address?: string; city?: string } {
    const clean = lines.map(l => (l || '').replace(/\s+/g, ' ').trim()).filter(Boolean);
    const city = clean.map(l => postalTown(l)).find((t): t is string => !!t);
    const placeLine = clean.find(l => !POSTAL_LINE_RE.test(l));
    if (!placeLine || NO_PLACE_RE.test(placeLine)) return city ? { city } : {};
    // "Adolf Mörners plan 2, 702 28 Örebro" — postnummer-segmentet är orten, inte adressen.
    const parts = placeLine.split(',').map(p => p.trim()).filter(p => p && !POSTAL_LINE_RE.test(p));
    const venueName = parts[0];
    if (!venueName || venueName.length > 80 || (!city && /\d/.test(venueName))) return city ? { city } : {};
    return {
        venueName,
        ...(city && parts.length > 1 ? { address: parts.join(', ') } : {}),
        ...(city ? { city } : {}),
    };
}
