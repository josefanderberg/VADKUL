'use client';

/**
 * Vädret för stadsplattan (#202): hämtar SMHI:s punktprognos för ORTEN (inte
 * besökarens position) direkt från webbläsaren och väljer timmen för plattans
 * dag. Tolkning, val och minnet kring hämtningen bor i utils/smhiWeather
 * (kontraktet, testat - appen visar samma väder med samma kod, #237).
 *
 * En prognos per ort hålls i minnet en halvtimme (SMHI uppdaterar varje
 * timme), så att panorera fram och tillbaka mellan två orter inte hämtar om.
 * Svarar SMHI inte, eller ligger orten utanför deras område, visas inget.
 * Medan en ny ort hämtas står förra ortens väder kvar (state 'stale'), och före
 * allra första svaret ges en utfyllnad ('pending') - plattans dagchip ska inte
 * byta bredd och få dagen att hoppa (#221).
 */
import { useEffect, useMemo, useState } from 'react';
import {
    cityWeatherFor,
    createSmhiLoader,
    smhiPointUrl,
    type CityWeather,
    type WeatherStep,
} from '@/utils/smhiWeather';

export type { CityWeather };

/** Plattan räknar om "just nu" så här ofta under ett långt besök. */
const TICK_MS = 10 * 60_000;

/** SMHI saknar orten (eller svarar med fel) = null; ett nätfel kastar och försöker snart igen. */
const load = createSmhiLoader(url => fetch(url).then(r => (r.ok ? r.json() : null)));

/**
 * Vädret för `point` på dag `dayOffset` (0 = idag), eller null. `point` null
 * eller `enabled` false = ingen hämtning. Läs `state` innan värdet används
 * som fakta (skärmläsartext, tooltip).
 */
export function useCityWeather(point: { lat: number; lng: number } | null, dayOffset: number, enabled: boolean): CityWeather | null {
    const url = enabled && point ? smhiPointUrl(point.lat, point.lng) : null;
    const [loaded, setLoaded] = useState<{ url: string; steps: WeatherStep[] } | null>(null);
    const [tick, setTick] = useState(0);

    useEffect(() => {
        const id = setInterval(() => setTick(t => t + 1), TICK_MS);
        return () => clearInterval(id);
    }, []);

    useEffect(() => {
        if (!url) return;
        let alive = true;
        load(url).then(steps => {
            if (alive) setLoaded({ url, steps });
        });
        return () => { alive = false; };
    }, [url, tick]);

    return useMemo(
        () => cityWeatherFor(url, loaded, dayOffset, new Date()),
        // tick: "just nu" flyttar sig under ett långt besök.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [url, loaded, dayOffset, tick],
    );
}
