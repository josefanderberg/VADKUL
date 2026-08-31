/**
 * Svensk gatuadress-extraktion ur fritext.
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
/**
 * Ord som aldrig ingår i ett gatunamn, var som helst i frasen. Utan detta blev
 * biljettinformation adresser: "Biljettpris På plats 150" matchar mönstret
 * "två namnord + platsord + nummer" (kalmarlansmuseum.se 2026-08-30).
 */
const STOP_WORD_ANYWHERE =
    /(?:^|\s)(?:på|i|för|pris|biljettpris|entré|entre|kostnad|avgift|från|till|vid)(?=\s)/i;

/** Plocka första rimliga svenska gatuadressen ("Storgatan 12") ur en text. */
export function extractStreetAddress(text: string | null | undefined): string | null {
    if (!text) return null;
    const m = text.match(STREET_RE);
    if (!m) return null;
    const street = m[1].trim();
    if (street.includes(' ') && (STOP_FIRST_WORD.test(street) || STOP_WORD_ANYWHERE.test(street))) return null;
    const nr = m[2].trim();
    return `${street} ${nr}`;
}
