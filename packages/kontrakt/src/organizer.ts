/**
 * Arrangörssidornas adresser: vadkul.se/arrangor/<slug> (2026-09-29).
 *
 * Sluggen räknas UR ARRANGÖRSNAMNET (eventets hostName) och ingenting annat -
 * den får inte bero på vilka andra arrangörer som råkar finnas i datat. Då
 * räknar webben (sidan, eventkortets länk, stadssidornas chips) och
 * pipelinen (arrangörsregistret som studions mejlunderlag bygger på) fram
 * samma adress var för sig. Två arrangörer med samma namn (t.ex.
 * "Stadsbiblioteket" i flera städer) delar därmed sida - det är medvetet,
 * sidan listar deras event tillsammans med orterna utskrivna.
 *
 * Ändra aldrig slugifieringen utan att inse att utskickade länkar (mejl,
 * arrangörernas egna länkar till sin sida) då slutar fungera. Studion räknar
 * inte själv - den får adressen färdig från pipelinen (arrangorer-statistik
 * .json, fältet `sida`). Pipelinen har en KOPIA (apps/scraper/src/utils/
 * organizerPage.ts - ts-node kan inte läsa det här ESM-paketet) som ett test
 * där jämför mot originalet: ändra här först, synka sedan kopian.
 */

/** Biljettplattformar och aggregatorer = återförsäljare, inte arrangörer. */
export const ORGANIZER_PLATFORM_DOMAINS = /tickster|nortic|billetto|eventbrite|ticketmaster|kulturbiljetter|biljett|tickets\.|showtic|nolltvå|axs\.|dice\.fm|livenation|meetup\.com/i;

/** hostName-värden som är källans namn snarare än en arrangör. */
const GENERIC_HOSTS = new Set(['facebook', 'instagram', 'tickster', 'billetto', 'eventbrite', 'ticketmaster', 'meetup', 'okänd']);

/** Eventkällans domän utan www ("abf.se"), eller null för icke-URL:er. */
export function organizerDomain(url: string | null | undefined): string | null {
    if (!url) return null;
    try {
        return new URL(url).hostname.replace(/^www\./, '').toLowerCase() || null;
    } catch {
        return null;
    }
}

/** "Visit Linköping" -> "visit-linkoping". Tom sträng om namnet saknar bokstäver/siffror. */
export function organizerSlug(name: string): string {
    return name
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')   // å/ä -> a, ö -> o, é -> e
        .toLowerCase()
        .replace(/&/g, ' och ')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80)
        .replace(/-+$/, '');
}

/**
 * Är eventets hostName en riktig arrangör värd en sida? Nej för tomma/för
 * korta namn, källnamn ("Facebook", "Tickster") och event från
 * biljettplattformar (där hostName är plattformen eller en okänd säljare).
 */
export function isOrganizerCandidate(hostName: string | null | undefined, url: string | null | undefined): boolean {
    const host = (hostName ?? '').replace(/\s+/g, ' ').trim();
    if (host.length < 3 || GENERIC_HOSTS.has(host.toLowerCase())) return false;
    const domain = organizerDomain(url);
    if (!domain || ORGANIZER_PLATFORM_DOMAINS.test(domain)) return false;
    return organizerSlug(host).length >= 2;
}

/**
 * Opt-in-källorna (Svenska kyrkan, PRO, Korpen) är dolda som förval på kartan
 * och hålls därför borta från de utloggade SEO-ytorna - de får ingen
 * arrangörssida. Speglar värdnamnsreglerna i apps/web/src/utils/sources.ts
 * (SOURCE_DEFS, kartans filter); organizerPages.test.ts i webben vaktar att
 * de räknar lika.
 */
export function isOptInSourceUrl(url: string | null | undefined): boolean {
    let host: string;
    try {
        host = new URL(url ?? '').hostname.toLowerCase();
    } catch {
        return false;
    }
    return host.includes('svenskakyrkan') || host === 'pro.se' || host.endsWith('.pro.se') || host.includes('korpen');
}

/**
 * Arrangörssidans slug för ett event, eller null när eventet inte hör till
 * någon sida: källnamn/biljettplattformar (isOrganizerCandidate), event utan
 * URL-id (användarskapade - id:t är ett dokument-id) och opt-in-källorna.
 * EN regel för webben (sidan och länkarna) och pipelinen (arrangörsregistret),
 * så en länk aldrig pekar på en sida som inte finns.
 */
export function organizerPageSlug(hostName: string | null | undefined, eventUrl: string | null | undefined): string | null {
    if (!isOrganizerCandidate(hostName, eventUrl)) return null;
    if (isOptInSourceUrl(eventUrl)) return null;
    return organizerSlug(hostName!.replace(/\s+/g, ' ').trim()) || null;
}
