/**
 * cityLookup.ts — slå upp orter i WEBBENS ortlistor från scraper-sidan.
 *
 * Webben äger två listor som scrapern behöver men inte kan importera över
 * paketgränsen (olika tsconfig, olika bundling): `cityPoints.ts` (291 orter
 * med koordinater) och `cityData.ts` (`CITIES` — orterna som har stadssida
 * och därmed en slug). Båda är uniforma objektliteraler, så de läses med
 * regex i stället för att kopieras hit och hamna ur synk.
 *
 * Låg bytes: filerna cachas efter första läsningen — flera uppslag i samma
 * körning (schedule-city-posts går igenom 20+ orter) läser inte om disken.
 */

import fs from 'fs';
import path from 'path';
import { matchOrt } from './ortMatch';

export interface CityPoint {
    name: string;
    lat: number;
    lng: number;
}

const WEB_SRC = path.resolve(__dirname, '../../../web/src');

let pointsCache: CityPoint[] | null = null;
let slugCache: { name: string; slug: string }[] | null = null;

function allCityPoints(): CityPoint[] {
    if (pointsCache) return pointsCache;
    const src = fs.readFileSync(path.join(WEB_SRC, 'utils/cityPoints.ts'), 'utf-8');
    pointsCache = [...src.matchAll(/\{ name: '([^']+)', lat: ([\d.]+), lng: ([\d.]+)/g)]
        .map(m => ({ name: m[1], lat: Number(m[2]), lng: Number(m[3]) }));
    return pointsCache;
}

function allCitySlugs(): { name: string; slug: string }[] {
    if (slugCache) return slugCache;
    const src = fs.readFileSync(path.join(WEB_SRC, 'app/(v1)/evenemang/cityData.ts'), 'utf-8');
    slugCache = [...src.matchAll(/\{ name: '([^']+)', slug: '([a-z-]+)'/g)]
        .map(m => ({ name: m[1], slug: m[2] }));
    return slugCache;
}

/** Ort → koordinat. Går via matchOrt så "Mora" inte fastnar på Hedemora. */
export function lookupCityPoint(query: string): CityPoint | null {
    return matchOrt(allCityPoints(), query, p => [p.name])[0] ?? null;
}

/** Ort → stadssidans slug (null för orter utan stadssida). */
export function citySlugFor(name: string): string | null {
    const hit = allCitySlugs().find(c => c.name.toLowerCase() === name.toLowerCase());
    return hit?.slug ?? null;
}

/**
 * Stadssidans slug → ortnamn. Behövs åt andra hållet när enda spåret av
 * orten är länken i ett publicerat inlägg (`/evenemang/vasteras` → Västerås).
 */
export function cityNameForSlug(slug: string): string | null {
    const hit = allCitySlugs().find(c => c.slug === slug.toLowerCase());
    return hit?.name ?? null;
}

/**
 * Bilden som följer med ortens inlägg till Instagram (1080×1080).
 *
 * TVÅ ROUTER, och den brandade annonsbilden väljs först:
 *
 *   /api/marketing/ad/<slug>  — moln, live-siffra ("414 saker att göra i
 *       Uppsala den här veckan"), vadkul.se-pill. Ren vektorgrafik, inga
 *       externa kakel. Kräver att orten finns i CITIES (har stadssida).
 *   /api/marketing/ad-plats   — kartbild med riktiga karttiles, för orter
 *       UTAN stadssida (Kvänum, Byske, Gagnef …) som annars blir utan bild.
 *
 * ⚠️ 2026-08-26: kartvarianten duger inte till publicering just nu. CARTO
 * kräver numera API-nyckel för sina rastertiles och levererar annars kakel
 * med "API KEY REQUIRED" tvärs över kartan. Annonsvarianten är opåverkad —
 * därför förstahandsvalet. Sätt CARTO_API_KEY och deploya webben, så blir
 * kartbilden användbar igen (den drabbar även stadssidornas hero-karta).
 */
export function cityAdImageUrl(
    town: { name: string; lat: number; lng: number; citySlug?: string | null },
    { radiusKm = 25, days }: { radiusKm?: number; days?: number } = {},
): string {
    const slug = town.citySlug ?? citySlugFor(town.name);
    if (slug) return `https://vadkul.se/api/marketing/ad/${slug}`;

    const p = new URLSearchParams({
        lat: town.lat.toFixed(4),
        lng: town.lng.toFixed(4),
        namn: town.name,
        radie: String(radiusKm),
        // Sidan/IG ÄR öppet avsändaren, så den brandade stilen hör hemma här.
        // (Till gruppinlägg används stil=karta — se ad-plats-routens header.)
        stil: 'annons',
    });
    if (days) p.set('dagar', String(days));
    return `https://vadkul.se/api/marketing/ad-plats?${p.toString()}`;
}
