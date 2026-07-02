import type { MetadataRoute } from 'next';
import { readFile } from 'fs/promises';
import path from 'path';

// Genereras vid build och ersätter den gamla handskrivna public/sitemap.xml.
// Bara riktiga, indexerbara sidor hör hemma här — kartans ?event=-djuplänkar
// renderar samma sida och skulle bara ge duplicerat innehåll. När stads-/
// kategorisidorna byggs är det HÄR de ska listas.
export const dynamic = 'force-static';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    // Event-datat stämplas om vid varje skrapning — bra proxy för när kartan
    // senast fick nytt innehåll.
    let eventsUpdatedAt = new Date();
    try {
        const raw = await readFile(
            path.join(process.cwd(), 'public', 'events-cards.json'),
            'utf8',
        );
        const parsed = JSON.parse(raw) as { updatedAt?: string };
        if (parsed.updatedAt) eventsUpdatedAt = new Date(parsed.updatedAt);
    } catch {
        // Saknas filen vid build använder vi byggtiden.
    }

    return [
        {
            url: 'https://vadkul.se',
            lastModified: eventsUpdatedAt,
            changeFrequency: 'hourly',
            priority: 1,
        },
        {
            url: 'https://vadkul.se/integritet',
            lastModified: new Date('2026-06-01'),
            changeFrequency: 'monthly',
            priority: 0.3,
        },
    ];
}
