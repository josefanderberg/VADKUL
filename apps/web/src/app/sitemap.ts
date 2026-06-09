/**
 * /sitemap.xml — auto-genererad sitemap för Google.
 *
 * Inkluderar:
 *   - Root (/) — kart-vyn (v2). De gamla /events-[stad]-SEO-sidorna är
 *     avvecklade (flyttade till _disabled-routes), så de listas inte längre.
 */

import { MetadataRoute } from 'next';

const BASE = 'https://vadkul.se';

export default function sitemap(): MetadataRoute.Sitemap {
    const lastModified = new Date();
    return [
        { url: BASE, lastModified, changeFrequency: 'hourly', priority: 1.0 },
    ];
}
