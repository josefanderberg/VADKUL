/**
 * Vakt för FB-kedjans sista geokodningsutväg: ortens mittpunkt.
 *
 * När lokalen inte går att geokoda i Sverige placeras eventet på ortens
 * centroid — rimligt för "Folkets Hus" i ett svenskt event, men FB-stadssöket
 * är fuzzy och ger träffar från hela världen (Sala 2026-09-11: rumänska "Sala
 * Luceafarul", italienska "Sala Rotonda", litauiska "SALA Festivalis" och norska
 * "TRENING I SAL" låg alla på Salas mittpunkt; "Bergen" hamnade i Berg, "Faro" på
 * Fårö, lettiska "MALA" i Malå). Vakten avgör om gissningen får göras.
 *
 * Avvisar när:
 *  1. texten är på främmande språk och ingen entydigt svensk ort nämns,
 *  2. texten är norsk/dansk och ingen svensk ort nämns (grannlandsevent med
 *     riktig adress geokodas vanligt och når aldrig hit),
 *  3. orten kom från sökordet men texten inte nämner den exakt (fuzzy-träff),
 *  4. orten är tvetydig (Sala, Mora …), kom från sökordet och texten är engelsk.
 */
import { guessEventLanguage, mentionsPlace } from '../../utils/eventLanguage';
import { AMBIGUOUS_PLACE_NAMES, mentionsSwedishPlace } from '../../utils/swedishPlaces';

export interface CentroidGuardInput {
    /** Orten vars mittpunkt eventet skulle få. */
    city: string;
    /** true = orten kom från FB-stadssökets sökord, inte från eventets egen text/sida. */
    fromSearch: boolean;
    title: string;
    address: string;
    description: string;
}

/** Skäl att avvisa ortsgissningen, eller null om den får göras. */
export function centroidFallbackRejection(input: CentroidGuardInput): string | null {
    const text = [input.title, input.address, input.description].filter(Boolean).join('\n');
    const lang = guessEventLanguage(text);

    if (lang.verdict === 'foreign' && !mentionsSwedishPlace(text)) {
        return `främmande språk (${lang.lang ?? '?'})`;
    }
    if (lang.verdict === 'nordic' && !mentionsSwedishPlace(text)) {
        return 'norsk/dansk text utan svensk ort';
    }
    if (input.fromSearch && !mentionsPlace(text, input.city)) {
        return `sökträffen nämner inte ${input.city}`;
    }
    if (input.fromSearch && AMBIGUOUS_PLACE_NAMES.has(input.city) && lang.verdict === 'en') {
        return `${input.city} är tvetydigt och texten är engelsk`;
    }
    return null;
}

/** En sparad rad ur link_events — det nattvakten ser. */
export interface StoredEventRow {
    url: string;
    title?: string | null;
    locationName?: string | null;
    extractedAddress?: string | null;
    description?: string | null;
    geoPrecision?: string | null;
    lat?: number | null;
    lng?: number | null;
}

// Positioner som är gissningar (inte eventets egen adress/koordinat).
const GUESSED_PRECISION = new Set(['stad-centroid', 'ort-centroid', '']);

/**
 * Nattvaktens dom för REDAN sparade FB-event (scripts/hide-foreign-misclassified):
 * samma regler som centroidFallbackRejection, för allt som slank in innan
 * vakten fanns eller via senare steg (LLM-berikningen placerade t.ex. "BEBE
 * FEST" från Bukarest på Stockholms mittpunkt). Bara FB-event med GISSAD
 * position — en exakt svensk adress vinner över språket (polska mässor,
 * rumänska sagostunder i Sverige), och andra källor rörs aldrig.
 * Returnerar skäl att dölja, eller null.
 */
export function storedForeignFbReason(row: StoredEventRow): string | null {
    if (!/facebook\.com\/events\//.test(row.url)) return null;
    const onNullIsland = Math.abs(row.lat ?? 0) < 0.01 && Math.abs(row.lng ?? 0) < 0.01;
    const precision = row.geoPrecision ?? '';
    if (!onNullIsland && !GUESSED_PRECISION.has(precision)) return null;

    const text = [row.title, row.locationName, row.extractedAddress, row.description].filter(Boolean).join('\n');
    const lang = guessEventLanguage(text);
    if (lang.verdict === 'foreign' && !mentionsSwedishPlace(text)) {
        return `främmande språk (${lang.lang ?? '?'}) på gissad position`;
    }
    // Norska/danska: bara på SVENSK stadsmittpunkt (FB-fallbacken använder
    // enbart svenska orter). Grannlandsevent på riktiga NO/DK-platser är äkta.
    if (precision === 'stad-centroid' && lang.verdict === 'nordic' && !mentionsSwedishPlace(text)) {
        return 'norsk/dansk text på svensk ortsmittpunkt';
    }
    return null;
}
