/**
 * hostFallback.ts — värdnamn ur FB-sidans ANDRA ställen när DOM-instrumentet
 * (host.ts: "Evenemang av"-länken) inte hittar något.
 *
 * Revisionen 2026-09-03: 679 av 1 685 FB-event hade värden "Facebook" —
 * instrumentets fallback när triggern saknas. Utloggat renderar FB värden
 * olika beroende på sidformat (sida/grupp/person, ny/gammal layout), men
 * namnet finns nästan alltid i og:description ("Evenemang av X · …") eller
 * i den inbäddade Relay-JSON:en (event_creator/hosts/owner). Rena
 * strängfunktioner, testade i hostFallback.test.ts.
 */

/** Generiska värdar = "vi vet inte": instrumentets fallback, tomt, "Okänd". */
export function isGenericHost(name: string | null | undefined): boolean {
    const n = (name ?? '').trim().toLowerCase();
    return !n || n === 'facebook' || n === 'okänd' || n === 'unknown' || n === 'om';
}

/** Tvätta bort FB-svansar som ibland följer med namnet. */
export function cleanHostName(raw: string): string {
    return raw
        .replace(/\\\//g, '/')
        .replace(/\\u([0-9a-f]{4})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
        .replace(/(\d+)\s*tidigare evenemang.*/i, '')
        .replace(/\s*·\s*(?:Sida|Page|Grupp|Group).*/i, '')
        .replace(/\s*(?:Meddelande|WhatsApp)$/i, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function plausible(name: string): boolean {
    return name.length >= 2 && name.length <= 80 && !/[{}"<>]/.test(name) && !isGenericHost(name);
}

/**
 * "Evenemang av Ljungby Taekwon-do ITF · Torsdag 3 september …" → "Ljungby Taekwon-do ITF".
 * Tar bara texten fram till nästa avskiljare (·, radbryt, " på ", " i ").
 */
export function hostFromOgDescription(text: string | null | undefined): string | null {
    if (!text) return null;
    const m = text.match(/(?:^|[\n.·]\s*)(?:Evenemang av|Event by|Hosted by|Arrangeras av|Arrangör:?)\s+([^·\n]{2,100}?)(?=\s*(?:·|\n|$|\s[-–]\s|,\s*(?:på|on|i)\s))/i);
    if (!m) return null;
    const name = cleanHostName(m[1]);
    return plausible(name) ? name : null;
}

/**
 * Relay-JSON i sidans <script>-block. Nycklarna varierar med layout —
 * prova de kända i pålitlighetsordning; första rimliga träffen vinner.
 */
const JSON_HOST_PATTERNS: RegExp[] = [
    /"event_creator"\s*:\s*\{[^{}]{0,200}?"name"\s*:\s*"([^"]{2,100})"/,
    /"event_hosts"\s*:\s*\[\s*\{[^{}]{0,200}?"name"\s*:\s*"([^"]{2,100})"/,
    /"hosts"\s*:\s*\[\s*\{[^{}]{0,200}?"name"\s*:\s*"([^"]{2,100})"/,
    /"eventHosts"\s*:\s*\[\s*\{[^{}]{0,200}?"name"\s*:\s*"([^"]{2,100})"/,
    /"host_name"\s*:\s*"([^"]{2,100})"/,
    /"owner"\s*:\s*\{\s*"__typename"\s*:\s*"(?:Page|User|Group)"[^{}]{0,200}?"name"\s*:\s*"([^"]{2,100})"/,
];

export function hostFromPageJson(html: string | null | undefined): string | null {
    if (!html) return null;
    for (const re of JSON_HOST_PATTERNS) {
        const m = html.match(re);
        if (!m) continue;
        const name = cleanHostName(m[1]);
        if (plausible(name)) return name;
    }
    return null;
}
