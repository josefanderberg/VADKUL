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
 * Normalisera beskrivnings-HTML från en källa: gör blockslut/<br> till
 * radbrytningar, strippa övriga taggar, AVKODA entities (förr: ersattes med
 * mellanslag → å/ä/ö försvann), ta bort WP-excerpt-rester ("[…]"), kollapsa
 * whitespace — men BEHÅLL radbrytningarna (förr: allt blev ETT stycke,
 * rapporterat 2026-07-11; webben visar beskrivningar med whitespace-pre-wrap
 * så \n renderas). Klipp längden sist.
 */
export function cleanDescription(raw: unknown, maxLen = 500): string {
    return decodeHtmlEntities(
        (raw ?? '')
            .toString()
            // Radbrytande taggar → \n så styckena överlever tag-strippen.
            .replace(/<(?:br|\/p|\/div|\/li|\/tr|\/h[1-6])[^>]*>/gi, '\n')
            .replace(/<[^>]+>/g, ' '),
    )
        .replace(/\[…\]|\[\.\.\.\]/g, '')
        .replace(/[^\S\n]+/g, ' ')   // kollapsa whitespace, men inte \n
        .replace(/ ?\n ?/g, '\n')    // inga hängande mellanslag runt radbryt
        .replace(/\n{3,}/g, '\n\n')  // max en tomrad i följd
        .trim()
        .slice(0, maxLen);
}
