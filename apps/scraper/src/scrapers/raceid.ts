/**
 * RaceID — svensk plattform för motionslopp/tävlingar (löpning/OCR/multisport).
 * Småorts-tungt: trail-lopp, byaruslopp, hinderbanor över hela landet.
 *
 * Öppet JSON-API (recon 2026-06-12, verifierat):
 *   GET https://api.raceid.com/api/v2/web/races?limit=200&page=N
 *   → { data: [...], meta: { pagination: { total, total_pages } } }
 *
 * Fallgropar (verifierade):
 *  - Listan är ordnad på id ASC och innehåller ALLT sedan 2019 — inga
 *    server-side datumfilter fungerar (upcoming/sort/from ignoreras).
 *    Vi paginerar igenom allt (~28 sidor à 200) och filtrerar klient-side.
 *  - Filtrera: published && !is_secret && is_searchable && country=Sweden.
 *  - race_date saknar klockslag → hasSpecificTime=false (starttider skiljer
 *    per distans ändå).
 *  - Inga koordinater — location.city (+ ev. street_address) geokodas.
 *  - Publika sidan är SPA; raceid.com/races/<id> routas av appen.
 */

import { RawEvent, Engine } from '../sources/types';

const API = 'https://api.raceid.com/api/v2/web/races';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const PAGE_LIMIT = 200;
const MAX_PAGES = 60;   // skyddsnät — idag ~28 sidor

export interface RaceIdRace {
    id: number;
    name?: string;
    published?: boolean;
    is_searchable?: boolean;
    is_secret?: boolean;
    race_date?: string;       // "YYYY-MM-DD" — inget klockslag
    race_end_date?: string;
    image?: string;
    sport?: { title?: string };
    location?: { city?: string | null; country?: string | null; street_address?: string | null };
    distances?: Array<{ name?: string; length?: number; is_visible?: boolean }>;
}

/** Mappa ett lopp → RawEvent. Exporterad för test. */
export function mapRace(r: RaceIdRace): RawEvent | null {
    if (!r.published || r.is_secret || r.is_searchable === false) return null;
    if ((r.location?.country || '') !== 'Sweden') return null;
    const title = (r.name || '').trim();
    if (!title || !r.race_date) return null;
    const startDate = new Date(`${r.race_date}T00:00:00`);   // lokal midnatt = datum-bara
    if (isNaN(startDate.getTime())) return null;

    const city = r.location?.city?.trim() || undefined;
    const street = r.location?.street_address?.trim() || undefined;
    const distances = (r.distances || [])
        .filter((d) => d.is_visible !== false && d.length)
        .map((d) => d.length! >= 1000 ? `${Math.round(d.length! / 100) / 10} km` : `${d.length} m`);
    const distinctDistances = [...new Set(distances)].slice(0, 6);

    return {
        externalId: String(r.id),
        title,
        startDate,
        endDate: r.race_end_date && r.race_end_date !== r.race_date
            ? new Date(`${r.race_end_date}T23:59:00`)
            : undefined,
        url: `https://raceid.com/races/${r.id}`,
        city,
        address: street,
        venueName: city,
        imageUrl: r.image || undefined,
        description: [
            r.sport?.title ? `${r.sport.title}.` : '',
            distinctDistances.length ? `Distanser: ${distinctDistances.join(', ')}.` : '',
            'Anmälan via RaceID.',
        ].filter(Boolean).join(' '),
        category: 'sport',
        hostName: 'RaceID',
        hasSpecificTime: false,   // bara datum — starttider skiljer per distans
    };
}

export const raceidEngine: Engine = async (_config, ctx) => {
    const all: RawEvent[] = [];
    let page = 1;
    let totalPages = 1;
    let scanned = 0;
    while (page <= totalPages && page <= MAX_PAGES) {
        try {
            const res = await fetch(`${API}?limit=${PAGE_LIMIT}&page=${page}`, {
                headers: { 'User-Agent': UA, 'Accept': 'application/json' },
                signal: ctx.signal ?? AbortSignal.timeout(30_000),
            });
            if (!res.ok) { ctx.log(`HTTP ${res.status} på sida ${page}`); break; }
            const data: any = await res.json();
            totalPages = data?.meta?.pagination?.total_pages ?? page;
            const races: RaceIdRace[] = data?.data ?? [];
            scanned += races.length;
            for (const r of races) {
                const ev = mapRace(r);
                // Fönsterfiltret sköts av runnern, men hoppa passerade direkt
                // här för att slippa bygga tusentals historiska objekt.
                if (ev && ev.startDate >= ctx.windowStart) all.push(ev);
            }
        } catch (err) {
            ctx.log(`sida ${page}: ${(err as Error).message}`);
            break;
        }
        page++;
    }
    ctx.log(`${scanned} lopp skannade (${page - 1} sidor) → ${all.length} kommande svenska`);
    return all;
};
