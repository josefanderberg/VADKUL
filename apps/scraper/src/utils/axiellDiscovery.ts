/**
 * Ren logik för Axiell-tenant-discovery (svepet över kommunbiblioteken) —
 * nätverksdelen bor i scripts/discover-axiell.ts. Bakgrund: ~250/290 kommuner
 * kör Axiell Arena Nova men AXIELL_TENANTS täcker bara en bråkdel; luckan
 * upptäcktes 27/9 via ForFun-jämförelsen (Eskilstuna/Strängnäs bibliotek
 * saknades trots att Nyköpings ensamt ger ~84 familjeevent).
 *
 * Discovery-metoden (registry-notes): get-calendar-config-endpointen är 403
 * sedan sommaren, så customerId sniffas ur browserns api.axiell.com-anrop
 * när kalendersidan laddas (samma metod som rundan 2/7, då via ett
 * scratchpad-skript som aldrig kom in i repot — därav den här modulen).
 */

import type { AxiellTenant } from '../scrapers/bibliotek';
import type { Kommun } from '../sources/data/kommuner';

/** "eskilstuna.se" → "eskilstuna" (stammen som bibliotekshostarna byggs av). */
export function kommunStem(domain: string): string {
    return domain.replace(/\.(se|com|nu)$/, '');
}

/** Kandidat-adresser för kommunens bibliotekskalender, i provordning.
 *  Mönstren ur den befintliga tenant-listan: bibliotek.<stem>.se (vanligast)
 *  och bibliotek<stem>.se (Uppsala-varianten). Konsortier med egna namn
 *  (gotabiblioteken.se …) går inte att härleda — de kräver manuell recon. */
export function candidateUrls(kommun: Kommun): string[] {
    const stem = kommunStem(kommun.domain);
    return [
        `https://bibliotek.${stem}.se/evenemang`,
        `https://bibliotek${stem}.se/evenemang`,
    ];
}

/** Är kommunen redan täckt av en tenant? Host-stammen, cityHint eller
 *  konsortiets stadslista räknas. Konsortiernas orter är tätorter snarare än
 *  kommunnamn, så enstaka täckta kommuner slinker igenom — svepet re-probar
 *  dem bara, och customerId-dedupen (isKnownCustomerId) stoppar dubbletter. */
export function isKommunCovered(kommun: Kommun, tenants: readonly AxiellTenant[]): boolean {
    const stem = kommunStem(kommun.domain);
    return tenants.some(t =>
        new URL(t.eventsUrl).hostname.includes(stem)
        || t.cityHint === kommun.name
        || (t.cities?.includes(kommun.name) ?? false));
}

/** Kommunerna som saknar tenant — svepets arbetslista. */
export function uncoveredKommuner(kommuner: readonly Kommun[], tenants: readonly AxiellTenant[]): Kommun[] {
    return kommuner.filter(k => !isKommunCovered(k, tenants));
}

/** customerId ur ett sniffat api.axiell.com-anrop, annars null. */
export function customerIdFromUrl(url: string): string | null {
    const m = url.match(/api\.axiell\.com\/event\/api\/customers\/([0-9a-f]{24})\//);
    return m ? m[1] : null;
}

export function isKnownCustomerId(customerId: string, tenants: readonly AxiellTenant[]): boolean {
    return tenants.some(t => t.customerId === customerId);
}

/** Färdig AXIELL_TENANTS-rad att klistra in i scrapers/bibliotek.ts. */
export function formatTenantRow(f: { kommun: Kommun; customerId: string; eventsUrl: string }): string {
    const stem = kommunStem(f.kommun.domain);
    const url = f.eventsUrl.replace(/\/$/, '');
    return `    { id: '${stem}', customerId: '${f.customerId}', eventsUrl: '${url}', name: '${f.kommun.name}s bibliotek', cityHint: '${f.kommun.name}' },`;
}
