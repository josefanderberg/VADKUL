// lib/outreach/eventSupply.ts
//
// Eventutbud per kontakt: antal event inom kontaktens radie de närmaste 7
// dygnen. Etapp 1-version: läser deploy-snapshoten public/events-destinations.json
// (samma källa som stadssidorna, cityData.ts) — snabb, noll Firestore-kostnad,
// och gott nog för RANKING. Utkastgeneratorn (etapp 2) läser i stället
// aggregatedEvents live, för där är färskheten avgörande.
//
// Server-only (fs) — får bara importeras av API-routes/server components.

import { readFile } from 'fs/promises';
import path from 'path';
import { CITIES, CITY_RADIUS_KM } from '@/app/(v1)/evenemang/cityData';
import type { OutreachContact } from '@/types/outreach';

type Dest = { id: string; time: string; lat: number; lng: number };

let destsPromise: Promise<Dest[]> | null = null;

function loadDests(): Promise<Dest[]> {
    if (!destsPromise) {
        destsPromise = readFile(path.join(process.cwd(), 'public', 'events-destinations.json'), 'utf8')
            .then(raw => (JSON.parse(raw) as { events: Dest[] }).events)
            .catch(() => []);   // saknad fil ⇒ utbud okänt, aldrig krasch
    }
    return destsPromise;
}

function distKm(lat1: number, lng1: number, lat2: number, lng2: number) {
    const R = 6371;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
}

/** Koordinat för kontakten: egen lat/lng vinner, annars stadssidans stad. */
function coordFor(c: OutreachContact): { lat: number; lng: number; radiusKm: number } | null {
    if (c.lat !== undefined && c.lng !== undefined) {
        return { lat: c.lat, lng: c.lng, radiusKm: c.radiusKm ?? 25 };
    }
    if (c.citySlug) {
        const city = CITIES.find(x => x.slug === c.citySlug);
        if (city) return { lat: city.lat, lng: city.lng, radiusKm: CITY_RADIUS_KM };
    }
    return null;
}

/** Antal kommande event inom radien de närmaste 7 dygnen, eller undefined om
 *  kontakten saknar koordinat (⚠-markering i kön i stället för en gissning). */
export async function eventSupplyForContact(c: OutreachContact): Promise<number | undefined> {
    const coord = coordFor(c);
    if (!coord) return undefined;
    const dests = await loadDests();
    if (dests.length === 0) return undefined;
    const now = Date.now();
    const horizon = now + 7 * 86_400_000;
    let n = 0;
    for (const d of dests) {
        const t = Date.parse(d.time);
        if (isNaN(t) || t < now || t > horizon) continue;
        if (distKm(coord.lat, coord.lng, d.lat, d.lng) <= coord.radiusKm) n++;
    }
    return n;
}
