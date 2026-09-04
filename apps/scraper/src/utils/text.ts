/**
 * Textnormalisering som delas av engines — håll källspecifika regex i respektive
 * engine, men HTML-strippen av beskrivningar är identisk överallt.
 */

/**
 * Namngivna HTML-entiteter → tecken. Täcker svenska + de vanligaste västeuropeiska
 * och typografiska. OBS skiftlägeskänsligt (entitetsnamn ÄR skiftlägeskänsliga:
 * &auml; = ä, &Auml; = Ä).
 *
 * Bakgrund: cleanDescription ersatte förr ALLA entiteter med mellanslag —
 * "K&auml;rlek" blev "K rlek" och å/ä/ö försvann ur beskrivningarna på webben
 * (rapporterat 2026-07-09). Andra vägar (wp-rest) strippade taggar utan att
 * avkoda alls, så "&auml;" syntes rått. Nu avkodar ALLA vägar via decodeHtmlEntities.
 */
const NAMED_ENTITIES: Record<string, string> = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', shy: '',
    auml: 'ä', ouml: 'ö', aring: 'å', Auml: 'Ä', Ouml: 'Ö', Aring: 'Å',
    eacute: 'é', Eacute: 'É', egrave: 'è', Egrave: 'È', agrave: 'à', Agrave: 'À',
    uuml: 'ü', Uuml: 'Ü', euml: 'ë', iuml: 'ï',
    oslash: 'ø', Oslash: 'Ø', aelig: 'æ', AElig: 'Æ',
    ccedil: 'ç', Ccedil: 'Ç', ntilde: 'ñ', Ntilde: 'Ñ',
    ndash: '–', mdash: '—', hellip: '…',
    rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“',
    sbquo: '‚', bdquo: '„', prime: '′', Prime: '″',
    laquo: '«', raquo: '»', middot: '·', bull: '•', dagger: '†',
    sect: '§', para: '¶', deg: '°', plusmn: '±', frac12: '½', times: '×',
    copy: '©', reg: '®', trade: '™', euro: '€', pound: '£', cent: '¢',
};

/** Kodpunkt → tecken, med vakt mot ogiltiga värden (kastar annars RangeError). */
function fromCodePointSafe(cp: number): string {
    return Number.isFinite(cp) && cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : ' ';
}

/**
 * Avkoda HTML-entiteter: numeriska (&#229; / &#xE5;) + namngivna (tabellen ovan).
 * Körs TVÅ varv — WordPress m.fl. dubbelkodar ofta ("&amp;auml;" ska bli "ä",
 * inte "&auml;"). Okända namngivna entiteter lämnas orörda (synligt > borttappat).
 */
export function decodeHtmlEntities(s: string): string {
    let out = s;
    for (let i = 0; i < 2 && out.includes('&'); i++) {
        out = out
            .replace(/&#x([0-9a-f]+);/gi, (_, h) => fromCodePointSafe(parseInt(h, 16)))
            .replace(/&#(\d+);/g, (_, d) => fromCodePointSafe(parseInt(d, 10)))
            .replace(/&([a-zA-Z][a-zA-Z0-9]{1,30});/g, (m, name) => NAMED_ENTITIES[name] ?? m);
    }
    return out;
}

/**
 * Standardtak för beskrivningar ur engines. Höjt 500 → 1500 (2026-09-03):
 * kvalitetsrevisionen visade 1 509 beskrivningar kapade EXAKT vid 500 tecken
 * (Svenska kyrkan 315, Nortic 441, PRO 184, Hembygd 102, Rotary 98) — mitt i
 * ett ord, utan markering. Webben visar hela texten i kortet, och FB-
 * beskrivningar har hela tiden fått vara upp till ~6 000 tecken utan problem.
 * Descriptions-lagret växer med uppskattningsvis 0,5–1 MB rått (gzip: en
 * bråkdel) — godtagbart mot att var 25:e beskrivning slutade mitt i ett ord.
 */
export const DEFAULT_DESCRIPTION_MAX = 1500;

/**
 * Klipp `s` till högst `max` tecken vid en NATURLIG gräns — i första hand
 * sista meningsslutet (. ! ?) i den bakre halvan, annars sista ordgränsen —
 * och markera klippet med "…". Aldrig mitt i ett ord, och aldrig mellan
 * halvorna i ett surrogatpar (emoji) — det var så "🎉" blev "�" i JSON:en.
 * Text som redan ryms returneras orörd.
 */
export function truncateAtBoundary(s: string, max: number): string {
    if (max <= 0) return '';
    if (s.length <= max) return s;
    const room = max - 1;                        // plats för "…"
    let head = s.slice(0, room);
    if (/[\uD800-\uDBFF]$/.test(head)) head = head.slice(0, -1);   // halvt emoji
    const minKeep = Math.floor(room * 0.5);

    // 1) Sista meningsslutet följt av whitespace i den bakre halvan → hel mening.
    //    Söks i hela strängen (lookahead behöver tecknet EFTER klippet) men
    //    bara träffar som ryms i head räknas.
    let cut = -1;
    const sentenceEnd = /[.!?](?=\s)/g;
    let m: RegExpExecArray | null;
    while ((m = sentenceEnd.exec(s)) !== null && m.index < head.length) {
        if (m.index >= minKeep) cut = m.index + 1;
    }
    if (cut > 0) return head.slice(0, cut).trimEnd();

    // 2) Annars sista ordgränsen: klippet landar exakt på en (nästa tecken är
    //    whitespace) eller så backar vi till sista mellanslaget/radbrytet.
    let base: string;
    if (/\s/.test(s.charAt(head.length))) {
        base = head;
    } else {
        const ws = Math.max(head.lastIndexOf(' '), head.lastIndexOf('\n'));
        base = ws >= minKeep ? head.slice(0, ws) : head;
    }
    return base.replace(/[\s,;:–\-(]+$/, '') + '…';
}

/**
 * Normalisera beskrivnings-HTML från en källa: gör blockslut/<br> till
 * radbrytningar, strippa övriga taggar, AVKODA entities (förr: ersattes med
 * mellanslag → å/ä/ö försvann), ta bort WP-excerpt-rester ("[…]"), kollapsa
 * whitespace — men BEHÅLL radbrytningarna (förr: allt blev ETT stycke,
 * rapporterat 2026-07-11; webben visar beskrivningar med whitespace-pre-wrap
 * så \n renderas). Ersättningstecken (U+FFFD) och ensamma surrogathalvor —
 * spår av trasig kodning, aldrig läsbar text — plockas bort. Klipp längden
 * sist, vid ordgräns (truncateAtBoundary), aldrig mitt i ett ord.
 */
export function cleanDescription(raw: unknown, maxLen = DEFAULT_DESCRIPTION_MAX): string {
    const text = decodeHtmlEntities(
        (raw ?? '')
            .toString()
            // Radbrytande taggar → \n så styckena överlever tag-strippen.
            .replace(/<(?:br|\/p|\/div|\/li|\/tr|\/h[1-6])[^>]*>/gi, '\n')
            .replace(/<[^>]+>/g, ' '),
    )
        .replace(/\[…\]|\[\.\.\.\]/g, '')
        // Länktext som följt med ur listkort/utdrag: "… Läs mer »", "Read more".
        .replace(/\s*(?:läs mer|read more|visa mer|see more)(?:\s+här)?\s*[»›→…]*\s*$/i, '')
        .replace(/�/g, '')
        .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '')
        .replace(/[^\S\n]+/g, ' ')   // kollapsa whitespace, men inte \n
        .replace(/ ?\n ?/g, '\n')    // inga hängande mellanslag runt radbryt
        .replace(/\n{3,}/g, '\n\n')  // max en tomrad i följd
        .trim();
    return truncateAtBoundary(text, maxLen);
}

/**
 * Sanera ett platsnamn från käll-skräp innan lagring/geokodning (25/8):
 * "Ljung slott (Öppnas i ett nytt fönster)" → "Ljung slott",
 * "Storgatan 5, 632 20 Eskilstuna, Sweden" → "Storgatan 5, 632 20 Eskilstuna".
 * Rör INTE informativa delar — bara kända UI-/exportrester.
 */
export function cleanLocationName(raw: unknown): string {
    return decodeHtmlEntities((raw ?? '').toString())
        .replace(/\s*\((?:Öppnas i (?:ett )?nytt fönster|Extern länk|Opens in (?:a )?new window)\)?/gi, '')
        // Ihopklistrade metadatafält ur vissa besökssajter ("Uppsala Arrangör: X Webbsida: …")
        .replace(/\s+(Arrangör|Webbsida|Telefon|E-post):\s.*$/i, '')
        .replace(/,\s*(Sweden|Sverige)\s*$/i, '')
        .replace(/\s+/g, ' ')
        .replace(/\s*,\s*/g, ', ')
        .replace(/^[,\s]+|[,\s]+$/g, '')
        .trim();
}
