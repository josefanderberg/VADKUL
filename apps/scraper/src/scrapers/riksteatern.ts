/**
 * Riksteatern — nationell turné-/föreställningskalender för ~220 lokala
 * riksteaterföreningar (scenkonst i små orter: Sjöbo, Färs, Eskilstuna …).
 *
 * Öppet JSON-API (recon 2026-06-12, verifierat manuellt — hittat i
 * performances.service.es5.js i AngularJS-bundlen):
 *   GET https://www.riksteatern.se/api/performance/filter/all
 *     ?onlyNationalProductions=false&showSubscribedPerformances=false
 *     &startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&page=1&itemsPerPage=2000
 *
 * Svar: PLATT array, ett SPELTILLFÄLLE per rad (samma pjäs på 5 orter = 5
 * rader) med ISO-datum (`date`), lokalförening (`orgName`), fritext-venue
 * (`locationInfo`) och kommun (`municipality`).
 *
 * Fallgropar (verifierade):
 *  - `itemsPerPage` ignoreras; page=1 ger allt, page=2 är tom. Hämta page=1.
 *  - `month` är svensk text — använd ISO-fältet `date`, inget annat.
 *  - `isCrossReference` = en förening länkar en annans tillfälle → dubblett, skippa.
 *  - `url` är PRODUKTIONS-sidan (samma för alla datum) → unikgör med #YYYY-MM-DD.
 *  - Inga koordinater/JSON-LD — geokodning via locationInfo + municipality.
 */

import { RawEvent, Engine } from '../sources/types';

const API_BASE = 'https://www.riksteatern.se';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export interface RtPerformance {
    startTime?: string;
    imageUrl?: string;
    title?: string;
    municipality?: string;
    location?: string;
    locationInfo?: string;
    url?: string;
    orgName?: string;
    date?: string;          // ISO8601 med tidszon — auktoritativ
    producer?: string;
    isPrivate?: boolean;
    isCanceled?: boolean;
    isCrossReference?: boolean;
    isPostponed?: boolean;
}

/** Mappa ett speltillfälle → RawEvent. Exporterad för test. */
export function mapPerformance(p: RtPerformance): RawEvent | null {
    if (p.isPrivate || p.isCanceled || p.isCrossReference) return null;
    const title = (p.title || '').replace(/\s+/g, ' ').trim();
    if (!title || !p.date) return null;
    const startDate = new Date(p.date);
    if (isNaN(startDate.getTime())) return null;

    const day = p.date.slice(0, 10);
    const prodUrl = (p.url || '').replace(/^http:\/\//, 'https://');
    const absUrl = prodUrl.startsWith('http') ? prodUrl : `${API_BASE}${prodUrl}`;
    const img = p.imageUrl
        ? (p.imageUrl.startsWith('http') ? p.imageUrl : `${API_BASE}${p.imageUrl}`)
        : undefined;

    const venue = (p.locationInfo || p.location || '').trim();
    const city = (p.municipality || '').trim();

    return {
        title,
        startDate,
        // Produktions-URL:en är samma för alla speldatum — fragmentet gör
        // varje tillfälle unikt (URL = PRIMARY KEY) utan att länken bryts.
        url: `${absUrl}#${day}`,
        venueName: venue || undefined,
        city: city || undefined,
        imageUrl: img,
        description: [
            p.producer ? `${p.producer} i arrangemang av ${p.orgName || 'lokal riksteaterförening'}.` : '',
            venue ? `Plats: ${venue}.` : '',
        ].filter(Boolean).join(' '),
        category: 'culture',
        hostName: p.orgName?.trim() || 'Riksteatern',
        hasSpecificTime: !!p.startTime,
        // locationInfo är ofta "Venue, Ort" — prova hela, sedan kommunen.
        geocodeCandidates: [
            venue && city && !venue.toLowerCase().includes(city.toLowerCase()) ? `${venue}, ${city}` : venue,
            city,
        ].filter(Boolean) as string[],
    };
}

export const riksteaternEngine: Engine = async (_config, ctx) => {
    const startDate = ctx.windowStart.toISOString().slice(0, 10);
    const endDate = ctx.windowEnd.toISOString().slice(0, 10);
    const url = `${API_BASE}/api/performance/filter/all`
        + `?onlyNationalProductions=false&showSubscribedPerformances=false`
        + `&startDate=${startDate}&endDate=${endDate}&page=1&itemsPerPage=2000`;

    let rows: RtPerformance[] = [];
    try {
        const res = await fetch(url, {
            headers: { 'User-Agent': UA, 'Accept': 'application/json' },
            signal: ctx.signal ?? AbortSignal.timeout(30_000),
        });
        if (!res.ok) {
            ctx.log(`API svarade ${res.status}`);
            return [];
        }
        rows = await res.json();
    } catch (err) {
        ctx.log(`API-fel: ${(err as Error).message}`);
        return [];
    }
    if (!Array.isArray(rows)) {
        ctx.log('oväntat svarsformat (ej array)');
        return [];
    }

    const events = rows.map(mapPerformance).filter((e): e is RawEvent => e !== null);
    ctx.log(`${rows.length} speltillfällen → ${events.length} efter privat/inställt/cross-reference-filter`);
    return events;
};
