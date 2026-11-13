'use client';

/**
 * Vädret för stadsplattan (#202): hämtar SMHI:s punktprognos för ORTEN (inte
 * besökarens position) direkt från webbläsaren och väljer timmen för plattans
 * dag. Tolkning och val bor i utils/smhiWeather (testad).
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
    formatTemp,
    parseSmhiForecast,
    pickWeatherForDay,
    smhiPointUrl,
    weatherEmoji,
    weatherText,
    weatherToShow,
    type WeatherStep,
} from '@/utils/smhiWeather';

const TTL_MS = 30 * 60_000;
/** Plattan räknar om "just nu" så här ofta under ett långt besök. */
const TICK_MS = 10 * 60_000;

const cache = new Map<string, { at: number; steps: WeatherStep[] }>();
const inFlight = new Map<string, Promise<WeatherStep[]>>();

function load(url: string): Promise<WeatherStep[]> {
    const hit = cache.get(url);
    if (hit && Date.now() - hit.at < TTL_MS) return Promise.resolve(hit.steps);
    const pending = inFlight.get(url);
    if (pending) return pending;
    const p = fetch(url)
        .then(r => (r.ok ? r.json() : null))
        .then(json => parseSmhiForecast(json))
        .catch(() => [] as WeatherStep[])
        .then(steps => {
            cache.set(url, { at: Date.now(), steps });
            inFlight.delete(url);
            return steps;
        });
    inFlight.set(url, p);
    return p;
}

export interface CityWeather {
    emoji: string;
    temp: string;
    text: string;
    /**
     * 'fresh' = ortens egen prognos. 'stale' = förra ortens, kvar medan den nya
     * hämtas. 'pending' = inget att visa än: emoji/temp är bara utfyllnad som
     * plattan ritar osynligt, så dagchipet inte ändrar bredd (#221).
     */
    state: 'fresh' | 'stale' | 'pending';
}

/** Utfyllnaden medan första prognosen hämtas - samma bredd som ett vanligt väder. */
const PENDING: CityWeather = { emoji: '⛅', temp: '0°', text: '', state: 'pending' };

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

    return useMemo(() => {
        const shown = weatherToShow(url, loaded);
        if (!shown) return null;
        if (shown.state === 'pending') return PENDING;
        const w = pickWeatherForDay(shown.steps, dayOffset, new Date());
        // Förra orten saknar timmen för den här dagen: håll platsen tills den nya kommit.
        if (!w) return shown.state === 'stale' ? PENDING : null;
        return { emoji: weatherEmoji(w.symbol, w.time), temp: formatTemp(w.temp), text: weatherText(w.symbol), state: shown.state };
        // tick: "just nu" flyttar sig under ett långt besök.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [url, loaded, dayOffset, tick]);
}
