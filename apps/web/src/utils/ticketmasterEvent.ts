/**
 * Ticketmaster-event känns igen på värdnamnet i url/id. Sedan Impact-
 * godkännandet 27/8 är `url` i aggregatet vår affiliate-redirect
 * (ticketmaster.evyy.net) medan `id` är den rena ticketmaster.se-adressen —
 * äldre rader från redirect-eran kan bära evyy-formen även i id, därför
 * kollas båda. Ägarbeslut 1/9: TM-event får "Boka"-knapp i guld och
 * guld-bricka på kartan (samma kropp som boost, utan ⭐-badgen).
 */
const TM_HOST = /(^|\.)ticketmaster\.(se|com|dk|no|fi|de|nl|evyy\.net)$/i;

/**
 * Är länken en affiliate-redirect som ger provision (Impact, live 31/8)? Den
 * nakna ticketmaster.se-adressen ger INGENTING. Spegel av apps/scraper
 * utils/ticketSources.isAffiliateLink — ändras den ena ska den andra följa.
 */
export function isAffiliateUrl(url: string | null | undefined): boolean {
    return !!url && /evyy\.net|impactradius|prf\.hn|\.sjv\.io/i.test(url);
}

export function isTicketmasterEvent(e: { id?: string | null; url?: string | null } | null | undefined): boolean {
    if (!e) return false;
    for (const raw of [e.url, e.id]) {
        if (!raw) continue;
        try {
            if (TM_HOST.test(new URL(raw).hostname)) return true;
        } catch { /* userCreated-id:n är inga URL:er — hoppa */ }
    }
    return false;
}
