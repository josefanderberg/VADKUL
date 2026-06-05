/**
 * /sitemap.xml — auto-genererad sitemap för Google.
 *
 * Inkluderar:
 *   - Root (/)
 *   - /events (alla städer)
 *   - /events/[stad] för varje stad i CITIES
 */

import { MetadataRoute } from 'next';
import { CITIES } from '@/lib/cityUtils';

const BASE = 'https://vadkul.se';

export default function sitemap(): MetadataRoute.Sitemap {
    const lastModified = new Date();
    const cityUrls = CITIES
        .filter((c, i, arr) => arr.findIndex(x => x.slug === c.slug) === i)
        .map(c => ({
            url: `${BASE}/events/${c.slug}`,
            lastModified,
            changeFrequency: 'daily' as const,
            priority: 0.8,
        }));

    return [
        { url: BASE, lastModified, changeFrequency: 'hourly', priority: 1.0 },
        { url: `${BASE}/events`, lastModified, changeFrequency: 'daily', priority: 0.9 },
        ...cityUrls,
    ];
}
