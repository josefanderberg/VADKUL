/**
 * Engångsinläsning: Storsjöyran 2026 (31 juli–1 aug) via wp/v2/artist +
 * speldagar-taxonomin. Artistsidorna saknar oftast datumtext (7/36 träffar för
 * sitemap-enginen) men REST:en bär dag-termen för alla 36.
 *
 * Kör:  npx ts-node src/scripts/oneoff-yran-2026.ts [--dry-run]
 *
 * Går genom runSource → ordinarie pipeline (dedup, klassificering, spara).
 * Koordinater sätts direkt (festivalområdet kring Stortorget) så Nominatim
 * inte behöver gissa på artistnamn. Efter 1 aug är skriptet inaktuellt.
 */

import { runSource } from '../sources/runner';
import { RawEvent, Source } from '../sources/types';

const FESTIVAL_COORDS: [number, number] = [63.1795, 14.6362]; // Stortorget, Östersund
const DAY_DATES: Record<string, string> = {
    'Fredag': '2026-07-31',
    'Lördag': '2026-08-01',
};

interface WpArtist {
    link?: string;
    title?: { rendered?: string };
    content?: { rendered?: string };
    _embedded?: {
        'wp:term'?: { taxonomy?: string; name?: string }[][];
        'wp:featuredmedia'?: { source_url?: string }[];
    };
}

function stripHtml(s: string): string {
    return s
        .replace(/<[^>]+>/g, ' ')
        .replace(/&amp;/g, '&').replace(/&#0?38;/g, '&')
        .replace(/&#8211;/g, '–').replace(/&#8217;/g, '’')
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

const yranEngine = async (): Promise<RawEvent[]> => {
    const res = await fetch('https://www.yran.se/wp-json/wp/v2/artist?per_page=100&_embed');
    if (!res.ok) throw new Error(`wp/v2/artist svarade ${res.status}`);
    const artists: WpArtist[] = await res.json();

    const events: RawEvent[] = [];
    for (const a of artists) {
        const title = stripHtml(a.title?.rendered || '');
        const url = a.link;
        if (!title || !url) continue;

        const day = (a._embedded?.['wp:term'] ?? [])
            .flat()
            .find((t) => t.taxonomy === 'speldagar' && t.name && DAY_DATES[t.name]);
        if (!day?.name) continue;

        const [y, mo, da] = DAY_DATES[day.name].split('-').map((n) => parseInt(n, 10));
        const desc = stripHtml(a.content?.rendered || '').slice(0, 600) || undefined;

        events.push({
            title: `${title} — Storsjöyran`,
            startDate: new Date(y, mo - 1, da),
            url,
            venueName: 'Storsjöyran, Stortorget',
            city: 'Östersund',
            coords: FESTIVAL_COORDS,
            description: desc,
            imageUrl: a._embedded?.['wp:featuredmedia']?.[0]?.source_url,
            category: 'music',
            hasSpecificTime: false,
        });
    }
    return events;
};

const source: Source = {
    id: 'storsjoyran-program-2026',
    hostName: 'Storsjöyran',
    region: 'ostersund',
    engine: 'api',
    config: {},
    updateFrequency: 'daily',
    notes: 'Engångsinläsning via oneoff-yran-2026.ts',
};

async function main() {
    const dryRun = process.argv.includes('--dry-run');
    const result = await runSource(source, { api: yranEngine }, { dryRun });
    console.log(JSON.stringify(result, null, 1));
    process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
