/**
 * Värdetikett för eventkortet. Kartan laddar i lager: destinations (utan
 * värd) ritar markörerna först, cards (med värd) landar sekunder senare.
 * Ett kort som öppnats däremellan stod med "Okänd" — fast aggregatet bär
 * värd på 100 % av eventen (revisionen 2026-09-03). Faller därför tillbaka
 * på källans domän ("svenskakyrkan.se", "Facebook") tills värden mergats;
 * "Okänd" bara när inte ens en länk finns.
 */
export function hostLabelFor(hostName: string | null | undefined, url: string | null | undefined): string {
    const h = (hostName ?? '').trim();
    if (h) return h;
    const u = (url ?? '').trim();
    if (!u) return 'Okänd';
    try {
        const host = new URL(u).hostname.replace(/^(?:www|m|mobile)\./i, '');
        if (!host) return 'Okänd';
        if (/(^|\.)facebook\.com$/i.test(host)) return 'Facebook';
        if (/(^|\.)instagram\.com$/i.test(host)) return 'Instagram';
        return host;
    } catch {
        return 'Okänd';
    }
}
