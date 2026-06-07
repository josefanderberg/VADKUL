// Normaliserar pris-strängar från scrapern till en konsistent etikett.
// Scrapern levererar bara råtext från källornas sidor, så vi möter ett brokigt
// fält: "Fri entré", "Avgiftsfritt", "konstnadsfritt" (typo), "Gratis", "30kr",
// "160:-", "40 SEK", "695 kr", "20-50". null = inget pris att visa (dölj chip).

const FREE_PATTERNS = /^(gratis|fri(\s+entr[eé])?|avgiftsfritt|kostnadsfritt|konstnadsfritt|free)$/i;

export function normalizePriceLabel(price: number | string | undefined | null): string | null {
    if (price === undefined || price === null || price === '') return null;
    const s = String(price).trim();
    if (!s) return null;

    if (s === '0' || FREE_PATTERNS.test(s)) return 'Gratis';

    // "160:-" → "160 kr" (svensk valutanotation utan decimaler).
    const dashOnly = s.match(/^(\d+(?:[.,]\d+)?)\s*:?-$/);
    if (dashOnly) return `${dashOnly[1]} kr`;

    // Rena tal / intervall: "40", "20-50", "12,50".
    if (/^\d+(?:[.,]\d+)?(?:\s*[–-]\s*\d+(?:[.,]\d+)?)?$/.test(s)) return `${s} kr`;

    // "30kr" (saknar mellanslag) eller "40 SEK" → "30 kr" / "40 kr".
    const numWithCurrency = s.match(/^(\d+(?:[.,]\d+)?(?:\s*[–-]\s*\d+(?:[.,]\d+)?)?)\s*(kr|sek|:-|:−)$/i);
    if (numWithCurrency) return `${numWithCurrency[1]} kr`;

    return s;
}
