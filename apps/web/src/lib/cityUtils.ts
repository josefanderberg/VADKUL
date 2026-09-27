/**
 * cityUtils — slug↔stad mappning + matchning av event till stad.
 *
 * Slug-format: lowercase, å/ä→a, ö→o, mellanslag→bindestreck.
 * Exempel: "Malmö" → "malmo", "Östersund" → "ostersund", "Upplands Väsby" → "upplands-vasby".
 *
 * DATAT (City + CITIES) bor sedan 25/9 i @vadkul/kontrakt (appens regionval
 * behöver samma lista) — här bor FUNKTIONERNA, och datat re-exporteras så
 * alla befintliga importvägar står sig.
 */
import { CITIES } from '@vadkul/kontrakt';
import type { City } from '@vadkul/kontrakt';
export type { City } from '@vadkul/kontrakt';
export { CITIES } from '@vadkul/kontrakt';

const BY_SLUG = new Map(CITIES.map(c => [c.slug, c]));

export function getCity(slug: string): City | null {
    return BY_SLUG.get(slug.toLowerCase()) || null;
}

export function slugifyCity(name: string): string {
    return name.toLowerCase()
        .replace(/å/g, 'a').replace(/ä/g, 'a').replace(/ö/g, 'o')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

/** Haversine i km. */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
}

/**
 * Närmaste stad ur CITIES, eller null om ingen ligger inom maxKm.
 * Används för att härleda "din stad" ur en GPS-position — maxKm skyddar mot
 * att en användare på fjället eller utomlands får en godtycklig storstad.
 */
export function nearestCity(lat: number, lng: number, maxKm: number = 60): City | null {
    let best: City | null = null;
    let bestDist = Infinity;
    for (const c of CITIES) {
        const d = haversineKm(lat, lng, c.lat, c.lng);
        if (d < bestDist) { bestDist = d; best = c; }
    }
    return bestDist <= maxKm ? best : null;
}

/**
 * Är eventet i denna stad? Matchar antingen genom:
 *   - locationName/extractedAddress innehåller stadnamn (case-insensitive)
 *   - lat/lng inom RADIUS_KM från stadens centrum (default 20km)
 */
export function eventMatchesCity(
    event: { locationName?: string; extractedAddress?: string; lat?: number; lng?: number },
    city: City,
    radiusKm: number = 20,
): boolean {
    const name = city.name.toLowerCase();
    const haystack = `${event.locationName || ''} ${event.extractedAddress || ''}`.toLowerCase();
    if (haystack.includes(name)) return true;
    if (event.lat && event.lng && event.lat !== 0 && event.lng !== 0) {
        const dist = haversineKm(event.lat, event.lng, city.lat, city.lng);
        if (dist <= radiusKm) return true;
    }
    return false;
}
