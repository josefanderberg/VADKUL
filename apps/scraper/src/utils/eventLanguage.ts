/**
 * Grov språkgissning för eventtext — skiljer svenska och engelska (hör hemma
 * på kartan) från främmande språk och från norska/danska.
 *
 * Varför (Sala 2026-09-11): FB-stadssöket (`/events/search/?q=<ort>`) är fuzzy
 * och ger träffar från hela världen när ortnamnet också är ett ord eller en
 * ort utomlands — "Sala" (sal på spanska/italienska/rumänska, ö på
 * litauiska), "Vara" (Tabăra de Vară, Pico da Vara), "Boden" (tyska: mark),
 * "Mora", "Berg" → Bergen, "Fårö" → Faro, "Malå" → Mala. När lokalen inte gick
 * att geokoda i Sverige hamnade de på ortens mittpunkt: 3 av 7 event i
 * morgondagens Sala var rumänska/italienska/litauiska.
 *
 * Språket ensamt säger INTE var ett event äger rum — sverigefinska, polska och
 * arabiska föreningsevent i Sverige är legitima. Därför används domen bara där
 * platsen redan är en gissning (stads-/ortscentroid), och därför räknas finska
 * och icke-latinsk skrift aldrig som främmande här. Grannspråken får en egen
 * dom ('nordic') som anroparen väger mot om texten nämner en svensk ort
 * ("Udflugt til Lund" och norsk yogahelg i Strømstad är äkta).
 */

export type LanguageVerdict = 'sv' | 'en' | 'nordic' | 'foreign' | 'unknown';

export interface LanguageGuess {
    verdict: LanguageVerdict;
    sv: number;
    en: number;
    nordic: number;
    foreign: number;
    /** Troligaste främmande språket när verdict är 'foreign' (för loggar). */
    lang?: string;
}

const words = (s: string) => s.split(' ');

// Ord som bara svenska har (inte norska/danska/engelska). Delade skandinaviska
// ord (som, med, på, det, vi, har, kan …) räknas inte åt något håll.
const SV_ONLY = new Set(words(
    'och inte jag vad hur också någon några mycket välkommen välkomna anmälan till är från mellan där här när alla för ska '
    + 'kväll måndag tisdag lördag söndag även sedan dessa detta våra hälsar biljetter entré tillsammans hej anmäl gärna '
    + 'kommun församling kyrka träff barnen föreningen'));

const EN = new Set(words(
    'the and of with is are you we our your this will be from join us tickets that by or more new get come see not have '
    + 'has was there what where when which who an at on to'));

// Norska/danska ord som svenska inte har.
const NORDIC_ONLY = new Set(words(
    'og ikke ikkje jeg eg hva hvordan hvad også kun nå etter mellom mellem hver noen nogen veldig velkommen velkomne '
    + 'påmelding tilmelding til fra er alle skal bare hvor hvis være vært lørdag søndag mandag tirsdag tysdag gjennom '
    + 'hjertelig deg dere jer meg kirke kirken'));

// Främmande (icke-nordiska, icke-engelska) funktionsord per språk. Ord som
// också är vanliga i svensk eventtext är MEDVETET borta: el (elbil), del (en
// del av), per (100 kr per person), alla, din, du, com (.com-länkar), pro (PRO),
// se, de, en, fiesta, hasta, die, care, em (kl 14 em), da, do, on.
const FOREIGN: Record<string, string[]> = {
    es: words('los las que con para por una muy nuestro nuestra más también está están será desde entrada sábado domingo viernes noche nosotros'),
    it: words('il di che della delle degli dei gli una sono anche nel nella sabato domenica venerdì serata ingresso tutta tutti tra siamo questo questa vi aspettiamo'),
    pt: words('não uma os dos das você vocês muito também'),
    ro: words('și în cu pentru este care pe spectacol ora septembrie octombrie cea sunt vă noi'),
    lt: words('ir yra kad su į kai jau labai mes jūs nėra vienas'),
    lv: words('un ar par uz kas mēs jūs būs'),
    pl: words('się jest nie dla oraz że sobota niedziela zapraszamy godz wstęp'),
    de: words('und der das mit für ist nicht auf ein eine wir zu im dem bei uhr sind wird noch'),
    fr: words('le les des et pour avec une est dans sur nous vous au aux ce cette'),
    nl: words('het een van voor met zijn niet ook naar bij wij jullie deze wordt onze uur zaterdag zondag welkom'),
    cs: words('jsou nebo také že který která které jsme bude'),
    hu: words('és az egy hogy nem meg már csak óra szombat vasárnap várunk szeretettel'),
};
const FOREIGN_WORD = new Map<string, string>();
for (const [lang, list] of Object.entries(FOREIGN)) {
    for (const w of list) {
        if (!SV_ONLY.has(w) && !EN.has(w) && !NORDIC_ONLY.has(w) && !FOREIGN_WORD.has(w)) FOREIGN_WORD.set(w, lang);
    }
}

// Bokstäver som svensk/engelsk text aldrig har (é/à/ü/á finns i café, à 100 kr
// och namn — därför inte med).
const FOREIGN_LETTERS = /[ñșțăâîėųūąęįčšžłśćńźżßçãõőűěřůāēīģķļņđ]/g;
const NORDIC_LETTERS = /[æø]/g;

/** Språkgissning för titel + beskrivning. Kort/tom text → 'unknown'. */
export function guessEventLanguage(text: string): LanguageGuess {
    const lower = (text || '').toLowerCase();
    const tokens = lower.match(/\p{L}+/gu) ?? [];
    let sv = 0, en = 0, nordic = 0, foreign = 0;
    const perLang: Record<string, number> = {};
    for (const t of tokens) {
        if (t.length < 2) continue;
        if (SV_ONLY.has(t)) sv++;
        else if (EN.has(t)) en++;
        else if (NORDIC_ONLY.has(t)) nordic++;
        else {
            const lang = FOREIGN_WORD.get(t);
            if (lang) { foreign++; perLang[lang] = (perLang[lang] ?? 0) + 1; }
        }
    }
    // Bokstäverna väger hälften — ett namn med č eller ø ska inte avgöra.
    foreign += Math.floor((lower.match(FOREIGN_LETTERS)?.length ?? 0) / 2);
    nordic += Math.floor((lower.match(NORDIC_LETTERS)?.length ?? 0) / 2);

    const lang = Object.entries(perLang).sort((a, b) => b[1] - a[1])[0]?.[0];
    const base = { sv, en, nordic, foreign };
    if (sv + en + nordic + foreign < 3) return { verdict: 'unknown', ...base };
    if (foreign >= 4 && foreign >= 2 * (sv + en + nordic)) return { verdict: 'foreign', ...base, lang };
    if (nordic >= 3 && nordic >= 2 * sv && nordic > en) return { verdict: 'nordic', ...base };
    if (sv >= 2 && sv >= en) return { verdict: 'sv', ...base };
    if (en >= 2) return { verdict: 'en', ...base };
    return { verdict: 'unknown', ...base };
}

/**
 * Nämner texten orten som eget ord? Norsk/dansk stavning normaliseras
 * (Strømstad → Strömstad), och svenskt genitiv-s räknas ("Salas
 * bygdedräkter"). Sammansättningar räknas INTE — "Bergen" är inte Berg och
 * "Faro" inte Fårö, det är just FB-sökets fuzzy-träffar vi vill skilja ut.
 */
export function mentionsPlace(text: string, place: string): boolean {
    if (!text || !place) return false;
    const norm = (s: string) => s.toLowerCase().replace(/ø/g, 'ö').replace(/æ/g, 'ä');
    const escaped = norm(place).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}s?(?![\\p{L}\\p{N}])`, 'u').test(norm(text));
}
