/**
 * ticketSources.ts — biljettsystemen vi litar på.
 *
 * Ticketmaster, Tickster, Billetto och Nortic är KURATERADE: någon har lagt
 * upp eventet, satt ett pris och släppt biljetter. Ett cookie-banner eller en
 * sökresultatsida tar sig inte in i ett biljettsystem. Att låta en lokal LLM
 * junk-döma dem är därför fel arkitektur — och den gör det: 270
 * Ticketmaster-event var junk-dömda med HÖG konfidens 2026-09-01, däribland
 * "ASKEPOT – The Musical" på Operaen i København och "Orgelsommer i Oslo
 * domkirke". 697 framtida biljettevent låg dolda.
 *
 * SCOPET ÄR NORDEN, inte Sverige (ägarbeslut 1/9, bekräftar 2026-07-02):
 * NO/DK-eventen bär affiliatelänkar vi tjänar pengar på och SKA visas.
 * Se [[impact-ticketmaster-affiliate-2026-07-28]].
 */

/** Kuraterat biljettsystem — får aldrig auto-döljas av audit-verdikt. */
export function isTrustedTicketSource(url: string): boolean {
    return /ticketmaster|tickster|billetto|nortic|universe\.com/i.test(url);
}

/**
 * Affiliate-wrappad länk som ger provision (Impact-kampanjerna, live sedan
 * 2026-08-31). Den nakna ticketmaster.se/dk/no-länken ger INGENTING.
 *
 * Används av dubblettvalet: när samma event finns från flera källor är det
 * affiliatelänken som ska överleva. Mamma Mia 3/9 hade både affiliate-URL:en
 * och ticketmaster.se dolda medan visitstockholm.com stod kvar — klicket gick
 * dit och provisionen uteblev.
 */
export function isAffiliateLink(url: string): boolean {
    return /evyy\.net|impactradius|prf\.hn|\.sjv\.io/i.test(url);
}
