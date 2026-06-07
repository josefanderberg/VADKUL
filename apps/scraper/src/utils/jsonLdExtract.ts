/**
 * Delade hjälpare för att plocka fält ur schema.org JSON-LD på event-sidor.
 * Används av eventbrite + eventim (och kan återanvändas av fler scrapers).
 *
 * Robusthet: hanterar JSON-LD som top-level array, @graph-array, enskilt objekt,
 * och @type som array eller subtyp (MusicEvent, TheaterEvent, …).
 */

/**
 * Trimmar meningslösa noll-decimaler i alla tal i en sträng.
 *   "605.0" → "605", "605.00" → "605", "100.0–250.0 kr" → "100–250 kr"
 *   "605.50" → "605.50" (bevaras), "605.05" → "605.05" (bevaras)
 */
export function trimZeroDecimals(s: string): string {
    return s.replace(/(\d)\.0+(?!\d)/g, '$1');
}

/** Normalisera pris ur ett schema.org `offers`-fält (objekt eller array). */
export function extractOffersPrice(offers: unknown): string {
    if (!offers) return '';
    const list = Array.isArray(offers) ? offers : [offers];
    for (const o of list) {
        if (!o || typeof o !== 'object') continue;
        const off = o as Record<string, unknown>;

        // priceRange ("100–250 kr") vinner om den finns som färdig sträng
        if (typeof off.priceRange === 'string' && off.priceRange.trim()) {
            return trimZeroDecimals(off.priceRange.trim());
        }

        const spec = off.priceSpecification as Record<string, unknown> | undefined;
        const cand =
            off.price ??
            off.lowPrice ??
            (spec ? spec.price : undefined);

        if (cand !== undefined && cand !== null && String(cand).trim() !== '') {
            const val = trimZeroDecimals(String(cand).trim());
            if (val === '0') return 'Gratis';
            // Redan formaterat med valuta? Lämna som det är.
            if (/kr|sek|\$|€|gratis|fri/i.test(val)) return val;
            const cur = (off.priceCurrency as string) || (spec?.priceCurrency as string) || 'SEK';
            return cur === 'SEK' ? `${val} kr` : `${val} ${cur}`;
        }
    }
    return '';
}

/**
 * Plockar description + price ur första Event-noden i JSON-LD i en HTML-sträng.
 * Returnerar tomma strängar om inget hittas.
 */
export function extractEventFromHtml(html: string): { description: string; price: string } {
    const scripts = [...html.matchAll(
        /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
    )].map(m => m[1]);

    for (const raw of scripts) {
        let data: unknown;
        try { data = JSON.parse(raw.trim()); } catch { continue; }

        const candidates: any[] = Array.isArray(data)
            ? data
            : Array.isArray((data as any)?.['@graph'])
                ? (data as any)['@graph']
                : [data];

        const evt = candidates.find((x: any) => {
            const t = x?.['@type'];
            return t === 'Event'
                || (Array.isArray(t) && t.includes('Event'))
                || /Event$/i.test(String(t ?? ''));   // MusicEvent, TheaterEvent, …
        });

        if (evt) {
            const description = evt.description ? String(evt.description).trim() : '';
            const price = extractOffersPrice(evt.offers);
            if (description || price) return { description, price };
        }
    }
    return { description: '', price: '' };
}
