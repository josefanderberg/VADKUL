/**
 * priceFromText.ts — plocka ENTRÉ-/DELTAGARPRIS ur fri beskrivningstext.
 *
 * Bakgrund (kvalitetsrevisionen 2026-09-03): 81 % av eventen saknar pris,
 * men i 900+ beskrivningar STÅR priset i texten ("Pris: 50 kr per person",
 * "Fri entré!", "Startavgift: 150 kr för vuxna, 50 kr för barn"). Facebook
 * har inget prisfält alls — där är texten enda källan (222 FB-event).
 *
 * Designval — PRECISION före täckning. Ett fel pris är värre än inget:
 *   - Belopp tas bara med PRISETIKETT ("Pris:", "Entré", "Biljett", "Avgift"…)
 *     eller per-person-form ("50 kr/person"). Ett naket "1020 kr" i löptext
 *     lämnas (kan vara vinstpott, insamling, hyra).
 *   - Gratis kräver en ENTRÉ-fras ("fri entré", "kostnadsfritt", "gratis
 *     inträde") eller etikett ("Pris: gratis"). "Gratis kaffe", "gratis buss"
 *     räknas inte — det är inte eventets pris. Villkorad gratis ("fri entré
 *     för barn under 12", "gratis för medlemmar") räknas inte heller.
 *   - Meningar med spärrord (vinst, lott, medlems-/serviceavgift, per år,
 *     tillkommer …) hoppas över helt. Ticksters "800 kr" är t.ex. deras egen
 *     serviceavgifts-text, inte biljettpriset.
 *   - Flera belopp i ett kort fönster efter etiketten → intervall "min–max kr"
 *     ("Pris 100 kr vuxna, 60 kr barn" → "60–100 kr"). Fönstret bryts vid
 *     "exkl/inkl/lunch/fika/därefter/varav" så tillägg inte klumpas in.
 *
 * Prioritet: uttrycklig FRI ENTRÉ (entrén är gratis, annat kan kosta) →
 * etiketterat belopp → övriga gratis-fraser → per person.
 *
 * Kalibrerad mot 2 585 event där källan hade eget pris: 93,5 % överens, och
 * merparten av resten var källans (LLM-satta) pris som var fel.
 *
 * Ren modul (ingen I/O). Utdata är samma format som engines levererar
 * ("150 kr", "150–250 kr", "från 150 kr", "Gratis") — webben normaliserar
 * vidare via priceLabel.ts.
 */

/** Unicode-ordgränser: JS \b är ASCII och missar "entré", "inträde", "kväll". */
const NB = '(?<!\\p{L})';   // inte föregånget av bokstav
const NA = '(?!\\p{L})';    // inte följt av bokstav

/** Etiketter som betyder "detta är vad det kostar att vara med" — med bestämd form ("Priset", "Entrén", "Startavgiften"). */
const LABEL = '(?:pris(?:er)?|entr[ée](?:avgift|pris)?|intr[äa]de(?:savgift)?|kostnad|avgift|deltagaravgift|anm[äa]lningsavgift|startavgift|kursavgift|biljett(?:er|pris)?|investering|kuvertpris|entrance|admission|price|tickets?|fee|cost)(?:en|et|erna|arna|na|n|t)?';

/** Ett belopp: "150", "1 195", "2.122", "12,50". */
const AMOUNT = '(\\d{1,3}(?:[ .]\\d{3})+|\\d+(?:,\\d{2})?)';
const CURRENCY = '(?:kr(?:onor)?|:-|sek|spänn)';

/** Spärrord: meningar där ett belopp INTE är eventets pris. */
const GUARD_RE = new RegExp(NB + '(?:\\d+:[ae]\\s+pris|första\\s*pris|andra\\s*pris|tredje\\s*pris|prisutdelning|pristagare|prissumma|priset\\s+går'
    + '|vinst|vinster|jackpot|pott(?:en)?|lott(?:er|eri)?|medlemsavgift|medlemskap|årsavgift|månadsavgift|terminsavgift|per\\s+år|årligen'
    + '|serviceavgift|bokningsavgift|expeditionsavgift|tillkommer|insaml|skänk|donera|gåva|bidrag|stipendi|hyra|hyr|lön'
    + '|budget|omsättning|värde|värd\\s+\\d|kostade|sålde|såld|intäkt|rabatt(?:kod)?|presentkort|swish(?:a|nummer)?\\s*:?\\s*\\d{6,})'
    + '|/\\s*år' + NA, 'iu');

/** Uttrycklig FRI ENTRÉ — entrén kostar inget, även om buffén gör det. */
const ENTRY_FREE_RE = new RegExp('(?:'
    + NB + '(?:fri|fritt|gratis)\\s+(?:entr[ée]|intr[äa]de|tillträde)' + NA
    + '|' + NB + '(?:entr[ée](?:n|avgift(?:en)?)?|intr[äa]de(?:t)?)\\s*[:=]?\\s*(?:är\\s+)?(?:gratis|fri(?:tt)?|kostnadsfri(?:tt)?)' + NA
    + '|' + NB + 'free\\s+(?:entry|entrance|admission)' + NA
    + '|' + NB + '(?:entrance|admission)\\s+is\\s+free' + NA
    + ')', 'iu');

/** Övriga gratis-fraser (deltagandet kostar inget). */
const FREE_RE = new RegExp('(?:'
    + NB + '(?:kostnadsfri(?:tt)?|avgiftsfri(?:tt)?)' + NA
    + '|' + NB + 'gratis\\s+(?:att\\s+delta(?:ga)?|för\\s+alla|deltagande)' + NA
    + '|' + NB + '(?:ingen|utan)\\s+(?:entr[ée](?:avgift)?|intr[äa]de|kostnad|avgift|deltagaravgift)' + NA
    + '|' + NB + '(?:det\\s+)?kostar\\s+(?:inget|ingenting)' + NA
    + '|' + NB + 'free\\s+(?:of\\s+charge|event)' + NA
    + '|' + NB + LABEL + '\\s*[:=]?\\s*(?:är\\s+)?(?:gratis|kostnadsfri(?:tt)?|0\\s*(?:kr|:-))' + NA
    + ')', 'iu');

/** "Gratis" som EGEN utsaga: hel rad/mening ("Gratis!", "Gratis. Ingen anmälan."). */
const FREE_STANDALONE_RE = /(?:^|\n|[.!?]\s+)(?:gratis|kostnadsfritt|fri entr[ée])\s*[!.]?(?=\s*(?:$|\n|[.!?]))/i;

/** Negationer som gör en gratis-fras ogiltig ("inte gratis", "ej kostnadsfritt"). */
const NEGATED_FREE_RE = new RegExp(NB + '(?:inte|ej|icke)\\s+(?:gratis|kostnadsfri(?:tt)?|fri\\s+entr[ée])' + NA, 'iu');

/**
 * Villkorad gratis — gäller inte alla, alltså inte eventets pris. Kontrolleras
 * på texten direkt EFTER frasen ("fri entré för barn under 12", "gratis
 * t.o.m. 18 år", "fri entré innan kl 22") …
 */
const CONDITIONAL_AFTER_RE = new RegExp('^[\\s,()]*(?:för\\s+(?:barn|bebis(?:ar)?|ungdom(?:ar)?|medlem(?:mar)?|student(?:er)?|pensionär(?:er)?|senior(?:er)?|dig\\s+(?:som|under)|alla\\s+under|personer\\s+under)'
    + '|under\\s+\\d|upp\\s+till\\s+\\d|t\\.?\\s?o\\.?\\s?m|till\\s+och\\s+med\\s+\\d|med\\s+(?:medlems|student|press)|vid\\s+uppvisande'
    + '|första\\s+(?:timmen|gången)|innan\\s+kl|före\\s+kl|fram\\s+till\\s+kl|efter\\s+kl|efter\\s+\\d)', 'iu');
/** … och strax FÖRE ("Bebisar har alltid fri entré", "medlemmar går in gratis"). */
const CONDITIONAL_BEFORE_RE = new RegExp('(?:barn|bebis|ungdom|medlem|student|pensionär|senior|under\\s+\\d+\\s*år|upp\\s+till\\s+\\d)[^.!?]{0,60}$', 'iu');

/** Tillägg som inte ska räknas in i prisintervallet efter en etikett. */
const WINDOW_CUT_RE = new RegExp(NB + '(?:exkl(?:usive|\\.)?|inkl(?:usive|\\.)?|lunch|fika|mat|kaffe|därefter|tillkommer|varav|var\\s+av|går\\s+till|rabatt)', 'iu');
/** Per-person-belopp som handlar om maten, inte deltagandet. */
const FOOD_RE = new RegExp(NB + '(?:mat|dryck|kaffe|kaka|fika|lunch|middag|buffé|smörgås|korv|våfflor|tårta|öl|vin)' + NA, 'iu');

function splitSentences(text: string): string[] {
    return text
        .split(/(?<=[.!?])\s+|\n+/)
        .map((s) => s.trim())
        .filter(Boolean);
}

function parseAmount(raw: string): number | null {
    const cleaned = raw.replace(/[ .](?=\d{3}\b)/g, '').replace(',', '.');
    const n = parseFloat(cleaned);
    if (!Number.isFinite(n) || n <= 0 || n > 20000) return null;
    return n;
}

function fmt(n: number): string {
    return Number.isInteger(n) ? String(n) : n.toFixed(2).replace('.', ',');
}

function formatAmounts(amounts: number[], from: boolean): string {
    const uniq = [...new Set(amounts)].sort((a, b) => a - b);
    if (uniq.length === 0) return '';
    if (uniq.length === 1) return from ? `från ${fmt(uniq[0])} kr` : `${fmt(uniq[0])} kr`;
    return `${fmt(uniq[0])}–${fmt(uniq[uniq.length - 1])} kr`;
}

/** Alla belopp med valuta i en text ("150 kr", "50:-", "1 195 kronor"). */
function amountsIn(text: string): number[] {
    const re = new RegExp(`(?<![\\d,.])${AMOUNT}\\s*${CURRENCY}${NA}`, 'giu');
    const out: number[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
        const n = parseAmount(m[1]);
        if (n !== null) out.push(n);
    }
    return out;
}

const LABELLED_PRICE_RE = new RegExp(`${NB}${LABEL}${NA}[^.\\n]{0,40}?(?<![\\d,.])${AMOUNT}\\s*${CURRENCY}${NA}`, 'iu');
const PER_PERSON_RE = new RegExp(`(?<![\\d,.])${AMOUNT}\\s*${CURRENCY}\\s*(?:/|per)\\s*(?:person|pers|p\\.p|deltagare|st|barn|vuxen|biljett)${NA}`, 'iu');
const RANGE_RE = new RegExp(`${NB}${LABEL}${NA}[^.\\n]{0,30}?(?<![\\d,.])${AMOUNT}\\s*[-–/]\\s*${AMOUNT}\\s*${CURRENCY}${NA}`, 'iu');
const FROM_RE = /\b(?:från|fr\.|fr|from)\s+\d/i;

/** Gratis-fras i meningen som varken är negerad eller villkorad. */
function unconditionalFree(sentence: string, re: RegExp): boolean {
    if (NEGATED_FREE_RE.test(sentence)) return false;
    const m = sentence.match(re);
    if (!m || m.index === undefined) return false;
    if (CONDITIONAL_AFTER_RE.test(sentence.slice(m.index + m[0].length))) return false;
    if (CONDITIONAL_BEFORE_RE.test(sentence.slice(0, m.index))) return false;
    return true;
}

/**
 * Extrahera pris ur beskrivningstext. Returnerar null när inget SÄKERT pris
 * hittas — hellre tomt än fel (se filhuvudet).
 */
export function extractPriceFromText(text: string | null | undefined): string | null {
    if (!text) return null;
    const t = String(text).replace(/\u00a0/g, ' ');   // NBSP → vanligt mellanslag (annars missar \s)
    if (t.trim().length < 4) return null;
    const sentences = splitSentences(t);

    // 1) Uttrycklig fri entré ("Fri entré!", "Entré: gratis") — entrén kostar
    //    inget även om buffén gör det.
    for (const s of sentences) {
        if (unconditionalFree(s, ENTRY_FREE_RE)) return 'Gratis';
    }

    // 2) Etiketterat belopp ("Pris: 150 kr", "Entré 50:-", "Startavgift 150 kr vuxna, 50 kr barn").
    for (const s of sentences) {
        if (GUARD_RE.test(s)) continue;
        const range = s.match(RANGE_RE);
        if (range) {
            const a = parseAmount(range[1]);
            const b = parseAmount(range[2]);
            if (a !== null && b !== null) return formatAmounts([a, b], false);
        }
        const m = s.match(LABELLED_PRICE_RE);
        // "Kaffe och våffla serveras till ett pris av 60 kr" — matens pris, inte eventets.
        if (m && m.index !== undefined && !FOOD_RE.test(s.slice(Math.max(0, m.index - 60), m.index))) {
            // Belopp i ett kort fönster efter etiketten → intervall. Inte hela
            // meningen, och inte förbi tillägg ("exkl. lunch 99 kr").
            const after = s.slice(m.index + m[0].length, m.index + m[0].length + 60);
            const cutAt = after.search(WINDOW_CUT_RE);
            const amounts = amountsIn(m[0] + (cutAt >= 0 ? after.slice(0, cutAt) : after));
            if (amounts.length) return formatAmounts(amounts, FROM_RE.test(m[0]));
        }
    }

    // 3) Övriga gratis-fraser ("kostnadsfritt", "ingen avgift", "Pris: gratis") och "Gratis!" som egen utsaga.
    for (const s of sentences) {
        if (unconditionalFree(s, FREE_RE)) return 'Gratis';
    }
    if (!NEGATED_FREE_RE.test(t) && FREE_STANDALONE_RE.test(t)) return 'Gratis';

    // 4) Per-person-form utan etikett ("50 kr/person") — men inte matpriser.
    for (const s of sentences) {
        if (GUARD_RE.test(s) || FOOD_RE.test(s)) continue;
        const m = s.match(PER_PERSON_RE);
        if (m) {
            const n = parseAmount(m[1]);
            if (n !== null) return formatAmounts([n], false);
        }
    }

    return null;
}
