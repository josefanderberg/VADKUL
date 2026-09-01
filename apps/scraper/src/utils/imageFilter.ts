/**
 * Filter för scrapade eventbilder som INTE är eventbilder.
 *
 * Bakgrund (2026-08-30): kommunsajter sätter ofta sajtens logga som
 * generisk og:image på varje sida — Södertälje gav 152 event med
 * kommunloggan som "eventbild", Svedala 59, Ängelholm 39. Även
 * lazyload-platshållare (Mölndal: LazyloadWhitePx) och sajtvida
 * share-bilder (datocms shareimage) läckte in som coverImage.
 *
 * En logga/platshållare som eventbild är sämre än ingen bild alls:
 * stadssidan fylls av identiska loggor och kortet ser trasigt ut.
 * Hellre falla tillbaka på kortets bildlösa layout.
 */

/**
 * Tokens som pekar på logga/ikon/platshållare snarare än en riktig
 * eventbild. `logo` matchas bara när det INTE följs av andra bokstäver
 * än typ/type — annars fälls "Bologna", "logoped" m.fl.
 */
const JUNK_TOKEN = new RegExp(
    [
        'logo(?:typ(?:e)?)?(?=$|[^a-z])',  // sodertaljelogo.png, Logo_Svedala2.jpg, logotype.png
        'icon(?=$|[^a-z])',                // favicon-varianter, apple-touch-icon
        'favicon',
        'sprite',
        'placeholder',
        'lazyload',                        // LazyloadWhitePx_comp.png (Mölndal)
        'spacer',
        'avatar',
        'emoji',
        'shareimage|share-image|og-image-default|default-share', // sajtvida delningsbilder
        '(?:^|[^0-9])1x1(?:[^0-9]|$)',     // 1x1-pixlar
        'blank[-_]?px|whitepx|white[-_]px',
        'pixel\\.(?:png|gif|jpg)',
    ].join('|'),
    'i',
);

/**
 * True om bild-URL:en sannolikt är en logga, ikon eller platshållare —
 * dvs. ska INTE användas som coverImage. Matchar bara på URL:ens path
 * (inte query/host) så spårningsparametrar inte triggar i onödan.
 */
export function isLikelyLogoOrPlaceholderImage(url: string | undefined | null): boolean {
    if (!url) return false;
    let pathname = url;
    try {
        pathname = decodeURIComponent(new URL(url).pathname);
    } catch {
        pathname = url.split(/[?#]/)[0];
    }
    // SVG är i praktiken alltid logga/ikon i eventbild-sammanhang.
    if (/\.svg$/i.test(pathname)) return true;
    return JUNK_TOKEN.test(pathname);
}

/**
 * Reparerar PORT-MISMATCH från källsidor bakom proxy: "https://host:80/…"
 * (och spegelfallet "http://host:443/…") kan aldrig laddas — schema och port
 * pekar åt olika håll. Axiell-bibliotekens sajter (bibliotekuppsala.se m.fl.)
 * serverar sådana bild-URL:er i sin markup: 4 100+ bilder låg så 1/9, och
 * eftersom uploadEventImage:s fetch också fallerar på dem blev de kvar som
 * döda remote-URL:er i stället för att hamna i vår Storage.
 * Släpper bara den motsägelsefulla porten — allt annat lämnas orört.
 * Webben bär samma vakt (lib/deepLinkEventIndex.usableImageUrl) för data som
 * redan ligger i Firestore.
 */
export function normalizeImagePort(raw: string): string {
    try {
        const u = new URL(raw);
        if ((u.protocol === 'https:' && u.port === '80') || (u.protocol === 'http:' && u.port === '443')) {
            u.port = '';
            return u.toString();
        }
    } catch { /* ogiltig URL — lämna orörd, junk-/validitetsfiltren tar den */ }
    return raw;
}
