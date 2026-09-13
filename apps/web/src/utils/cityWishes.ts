/**
 * cityWishes — REN urvalslogik för önskningarna på stadssidorna (14/9):
 * stadssidans slut ska vara en inbjudan ("det här saknas — är det du?"),
 * inte en lista med andra städer. Komponenten (CityWishes) hämtar och
 * renderar; här bor det testbara: radie-filtret och åldersetiketten.
 *
 * Radien är samma som stadens spotlight (small 20 / annars 35 km) — önske-
 * volymen är liten, så generösare än 10 km-utbudsmåttet är rätt här: hellre
 * en önskan från grannorten än en tom sektion.
 */
import type { EventWish } from '@/types';
import { haversineKm } from '@/lib/cityUtils';

/** Max önskningar som visas — sektionen är en aptitretare, inte ett arkiv. */
export const CITY_WISHES_MAX = 6;

/** Aktiva önskningar inom radien, nyaste först, max CITY_WISHES_MAX. */
export function wishesNearCity(
    wishes: EventWish[],
    center: { lat: number; lng: number },
    radiusKm: number,
    max: number = CITY_WISHES_MAX,
): EventWish[] {
    return wishes
        // (0,0) är "plats saknas" i hela pipelinen — aldrig en riktig position.
        .filter(w => !(w.lat === 0 && w.lng === 0)
            && haversineKm(w.lat, w.lng, center.lat, center.lng) <= radiusKm)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, max);
}

/** "idag" / "igår" / "för X dagar sedan" — önskans ålder i löptext. */
export function wishAgeLabel(createdAt: Date, now: Date): string {
    const days = Math.floor((now.getTime() - createdAt.getTime()) / 86_400_000);
    if (days <= 0) return 'idag';
    if (days === 1) return 'igår';
    return `för ${days} dagar sedan`;
}
