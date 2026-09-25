/**
 * APP-FLÖDET (plattformsplanen fas 1): slimmade per-region-payloader ur
 * aggregatets lager, uppladdade som förpackade blobbar (aggregateBlobs) och
 * serverade CDN-cachat av webbens /api/events/app-<region>. Appen hämtar sin
 * region (~30–180 kB brotli) i stället för hela landets destinations-lager.
 *
 * VARFÖR blobbar och inte statiska filer i public/: statiska filer når prod
 * bara vid DEPLOY — nattens data når produktionen via blob-vägen, precis som
 * huvudlagren. Ingen git-churn, inga workflow-ändringar: nattkedjans
 * ordinarie `npm run aggregate` bygger flödet.
 *
 * HORISONT 14 dagar — samma tidsfönster som kartan laddar (egress-trappan);
 * appens MVP speglar kartan. Beskrivningar ingår inte (hämtas per event vid
 * öppnat kort). Boost-flagga ingår inte i fas 1: aggregatet bär inte boost,
 * och nattens fil hade ändå missat dagens köp — appen får boost via API:t i
 * fas 3.
 *
 * Typen AppFeedEvent SPEGLAS i packages/kontrakt/src/types.ts (appen läser
 * den därifrån; scrapern kan inte importera workspace-paket — dess CI kör
 * npm ci standalone). Ändras fälten här MÅSTE kontraktet följa med.
 */
import * as fs from 'fs';
import * as path from 'path';
import { eventKey } from './eventKey';

export interface AppFeedCity {
    slug: string;
    name: string;
    lat: number;
    lng: number;
    region: string;
}

export interface AppFeedEvent {
    /** Käll-URL:en — primärnyckel OCH utlänken (som destinations `id`). */
    id: string;
    title: string;
    time: string;
    endDate?: string;
    hasSpecificTime: boolean;
    lat: number;
    lng: number;
    locationName?: string;
    category: string;
    emoji?: string;
    pop?: true;
    /** Omslagsbild från cards-lagret (joinad via eventKey). */
    img?: string;
    /** Bara när cards skrivit om länken (~2 % av eventen) — annars ÄR id länken. */
    url?: string;
}

/** 14 dagar — samma fönster som kartans tidsfönster-laddning. */
export const APP_FEED_DAYS = 14;

/**
 * Läs CITIES ur webbens cityUtils.ts som TEXT — samma regex-över-paketgränsen-
 * trick som seed-venues-overpass/schedule-city-posts. cityUtils förblir enda
 * sanningskällan; testet mot riktiga filen fångar formatdrift. Läser bara
 * raderna i CITIES-arrayen (fram till dess avslutande `];`).
 */
export function parseCities(srcText: string): AppFeedCity[] {
    const start = srcText.indexOf('export const CITIES');
    if (start === -1) return [];
    const end = srcText.indexOf('];', start);
    const block = srcText.slice(start, end === -1 ? undefined : end);
    const out: AppFeedCity[] = [];
    for (const m of block.matchAll(
        /\{\s*slug:\s*'([^']+)',\s*name:\s*'([^']+)',\s*lat:\s*([\d.]+),\s*lng:\s*([\d.]+),\s*region:\s*'([^']+)'/g,
    )) {
        out.push({ slug: m[1], name: m[2], lat: Number(m[3]), lng: Number(m[4]), region: m[5] });
    }
    return out;
}

/** Webbens ortlista, läst från källfilen. Kastar om formatet driftat (hellre
 *  ett tydligt nattloggs-fel än ett tomt appflöde i produktion). */
export function loadCities(): AppFeedCity[] {
    const p = path.resolve(__dirname, '../../../web/src/lib/cityUtils.ts');
    const cities = parseCities(fs.readFileSync(p, 'utf-8'));
    if (cities.length < 30) {
        throw new Error(`appFeed: bara ${cities.length} städer lästa ur cityUtils.ts — formatdrift?`);
    }
    return cities;
}

const toRad = (d: number) => (d * Math.PI) / 180;

function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2
        + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
}

/** Region (län-slug) för en koordinat = närmaste stadens region, utan
 *  radietak — vartenda event med giltig position hör hemma någonstans. */
export function nearestRegion(lat: number, lng: number, cities: AppFeedCity[]): string | null {
    let best: AppFeedCity | null = null;
    let bestD = Infinity;
    for (const c of cities) {
        const d = distanceKm(lat, lng, c.lat, c.lng);
        if (d < bestD) { bestD = d; best = c; }
    }
    return best ? best.region : null;
}

/** Minsta ytan av destinations/cards som flödesbygget läser — aggregatorns
 *  fulla lagertyper uppfyller den strukturellt. */
export interface AppFeedDestInput {
    id: string;
    title: string;
    time: string;
    endDate?: string;
    hasSpecificTime: boolean;
    lat: number;
    lng: number;
    locationName?: string;
    category: string;
    emoji?: string;
    pop?: true;
}

export interface AppFeedCardInput {
    h: string;
    coverImage?: string;
    url?: string;
}

/**
 * Bygg per-region-flödena. Bortfiltrerat: passerade event, event bortom
 * horisonten, null island (0,0-området — appens MVP är kartan, och webben
 * döljer dem på kartan av samma skäl). Tidsordning inom regionen (indatan är
 * redan tidssorterad ur SQL:en — sorteringen här är bara ett skyddsnät).
 */
export function buildAppFeeds(
    destinations: AppFeedDestInput[],
    cards: AppFeedCardInput[],
    cities: AppFeedCity[],
    now: Date = new Date(),
    days: number = APP_FEED_DAYS,
): Map<string, AppFeedEvent[]> {
    const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0);
    const horizonMs = startOfDay.getTime() + days * 24 * 60 * 60 * 1000;

    const imgByKey = new Map<string, string>();
    const urlByKey = new Map<string, string>();
    for (const c of cards) {
        if (c.coverImage) imgByKey.set(c.h, c.coverImage);
        if (c.url) urlByKey.set(c.h, c.url);
    }

    const regions = new Map<string, AppFeedEvent[]>();
    for (const d of destinations) {
        const t = Date.parse(d.time);
        if (!Number.isFinite(t) || t < startOfDay.getTime() || t >= horizonMs) continue;
        if (Math.abs(d.lat) < 0.01 && Math.abs(d.lng) < 0.01) continue; // null island
        const region = nearestRegion(d.lat, d.lng, cities);
        if (!region) continue;
        const h = eventKey(d.id);
        const ev: AppFeedEvent = {
            id: d.id,
            title: d.title,
            time: d.time,
            endDate: d.endDate || undefined,
            hasSpecificTime: d.hasSpecificTime,
            lat: d.lat,
            lng: d.lng,
            locationName: d.locationName || undefined,
            category: d.category,
            emoji: d.emoji || undefined,
            pop: d.pop || undefined,
            img: imgByKey.get(h),
            url: urlByKey.get(h),
        };
        const list = regions.get(region);
        if (list) list.push(ev); else regions.set(region, [ev]);
    }
    for (const list of regions.values()) list.sort((a, b) => Date.parse(a.time) - Date.parse(b.time));
    return regions;
}
