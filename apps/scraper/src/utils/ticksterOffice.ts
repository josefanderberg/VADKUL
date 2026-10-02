/**
 * Tickster AB:s kontorsadress (Magasinsgatan 8, Göteborg) läcker in som
 * eventadress via sidfoten. Rena hjälpare för reparationen (2/10) — se
 * scripts/repair-tickster-office-address.ts.
 */
import { cleanLocationName } from './text';
import { venueBuildingOf } from './venueFromText';

export const TICKSTER_OFFICE = /^\s*Magasinsgatan\s*8\b/i;

/** Orten ur den förgiftade frågan: "Magasinsgatan 8, Växjö" → "Växjö". */
export function cityFromOfficeQuery(q: string | null | undefined): string | null {
    const m = (q ?? '').match(/^\s*Magasinsgatan\s*8\s*,\s*(.+?)\s*$/i);
    if (!m) return null;
    const city = m[1].replace(/^\d{3}\s?\d{2}\s+/, '').trim();   // postnummer-rest
    return city.length >= 2 ? city : null;
}

/** Kandidatfrågor i runnerns ordning: byggnad + ort, venue + ort. */
export function venueQueries(locationName: string | null | undefined, city: string): string[] {
    const venue = cleanLocationName(locationName)
        .split(',').map(s => s.trim()).filter(s => s && !TICKSTER_OFFICE.test(s) && s.toLowerCase() !== city.toLowerCase())
        .join(', ');
    if (!venue) return [];
    const building = venueBuildingOf(venue);
    const withCity = (v: string) => v.toLowerCase().includes(city.toLowerCase()) ? v : `${v}, ${city}`;
    return [...new Set([building ? withCity(building) : '', withCity(venue)].filter(Boolean))];
}
