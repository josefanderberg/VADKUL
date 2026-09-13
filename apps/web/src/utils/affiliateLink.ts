/**
 * affiliateLink — känner igen VÅRA affiliate-utlänkar (Impact-redirects som
 * pipelinen wrappar i utkanten vid aggregeringen, se apps/scraper/src/utils/
 * affiliateUrl.ts). Värdregexen är en KOPIA av AFFILIATE_REDIRECT_HOST där —
 * hålls i synk, precis som eventShareSlug-kopian i functions.
 *
 * Marknadsföringslagen kräver att länkar vi får provision på märks "Annons".
 * Den här utilen avgör NÄR märkningen visas — inget annat: länken i sig rörs
 * aldrig här (URL:en är primärnyckel och wrappas enbart i pipelinen).
 */
const AFFILIATE_REDIRECT_HOST = /\.(evyy\.net|sjv\.io|pxf\.io|7eer\.net|ojrq\.net|i\d+\.net|prf\.hn|go2cloud\.org)$/i;

export function isAffiliateUrl(raw: string | null | undefined): boolean {
    if (!raw) return false;
    try {
        const u = new URL(raw);
        if (AFFILIATE_REDIRECT_HOST.test(u.hostname)) return true;
        // Bältet: våra wrappade länkar bär alltid utm_medium=affiliate också
        // (sätts i publicUrl) — fångar en framtida redirect-domän som regexen
        // ovan inte känner till än.
        return u.searchParams.get('utm_medium') === 'affiliate';
    } catch {
        return false;
    }
}

/** Märkningstexten — EN källa så kartkortet och stadssidorna aldrig går isär. */
export const AFFILIATE_DISCLOSURE = 'Annons — biljettlänk från partner, VADKUL kan få provision vid köp.';
