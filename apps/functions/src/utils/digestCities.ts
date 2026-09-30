/**
 * Helgtipsets städer = kontraktets CITIES (samma lista som webbens ortval
 * skriver users.citySlug ur), avskalad till fälten urvalet behöver.
 *
 * Var en handhållen KOPIA t.o.m. 30/9 — sedan esbuild bakar in
 * @vadkul/kontrakt i bygget finns ingen anledning att synka för hand, och en
 * ort som saknades här fick aldrig torsdagspushen.
 */
import { CITIES } from '@vadkul/kontrakt';

export interface DigestCity {
    slug: string;
    name: string;
    lat: number;
    lng: number;
}

export const DIGEST_CITIES: DigestCity[] = CITIES.map(({ slug, name, lat, lng }) => ({ slug, name, lat, lng }));

export const DIGEST_CITY_BY_SLUG = new Map(DIGEST_CITIES.map(c => [c.slug, c]));
