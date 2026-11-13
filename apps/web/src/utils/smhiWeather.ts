/**
 * Vädret i stadsplattan (#202): SMHI:s öppna prognos-API, punktprognos ur
 * snow1g version 1 (ersatte pmp3g som stängdes 31/3 2026). Gratis, ingen
 * nyckel, CC BY 4.0 (SMHI krediteras i välkomstrutan), CORS öppet och ca 5 kB
 * komprimerat per ort - webbläsaren hämtar direkt, ingen server hos oss.
 * Bara ortens koordinater skickas, aldrig besökarens position.
 *
 * Josef 13/11: "kan vi hitta ett bra och billigt api där vi kan hämta in
 * vädret på den givna platsen och tempratur. som vi kan visa uppe stadssida
 * knappen."
 *
 * Ren modul: inga webbläsar- eller kart-API:er. Hämtningen bor i
 * hooks/useCityWeather.
 */

export interface WeatherStep {
    /** Prognosens tid (ms). */
    time: number;
    /** Lufttemperatur, °C. */
    temp: number;
    /** SMHI:s vädersymbol 1-27. */
    symbol: number;
}

const SMHI_BASE = 'https://opendata-download-metfcst.smhi.se/api/category/snow1g/version/1/geotype/point';

/** Punktprognosens adress. Tre decimaler (~100 m) - stabil cachenyckel per ort. */
export function smhiPointUrl(lat: number, lng: number): string {
    return `${SMHI_BASE}/lon/${lng.toFixed(3)}/lat/${lat.toFixed(3)}/data.json`;
}

/** Tolka SMHI-svaret. Steg utan tid, temperatur eller giltig symbol hoppas över. */
export function parseSmhiForecast(json: unknown): WeatherStep[] {
    const series = (json as { timeSeries?: unknown })?.timeSeries;
    if (!Array.isArray(series)) return [];
    const out: WeatherStep[] = [];
    for (const step of series) {
        const s = step as { time?: unknown; data?: { air_temperature?: unknown; symbol_code?: unknown } };
        const time = typeof s?.time === 'string' ? Date.parse(s.time) : NaN;
        const temp = s?.data?.air_temperature;
        const symbol = s?.data?.symbol_code;
        if (!Number.isFinite(time) || typeof temp !== 'number' || !Number.isFinite(temp)) continue;
        if (typeof symbol !== 'number' || !Number.isInteger(symbol) || symbol < 1 || symbol > 27) continue;
        out.push({ time, temp, symbol });
    }
    return out.sort((a, b) => a.time - b.time);
}

const HOUR = 3600_000;
/** Idag: närmaste timme, högst så här långt bort. */
const NOW_MAX_GAP_MS = 1.5 * HOUR;
/** Kommande dagar: vädret mitt på dagen (lokal tid)... */
const DAY_HOUR = 13;
/** ...från närmaste prognossteg inom så här långt (de sena dagarna har glesare steg). */
const DAY_MAX_GAP_MS = 3 * HOUR;

/**
 * Vädret för plattans dag: idag (0) = närmaste timme just nu, kommande dagar =
 * mitt på dagen i lokal tid (samma dagräkning som dagväljaren). Ingen
 * prognos tillräckligt nära = null, och då visas inget.
 */
export function pickWeatherForDay(steps: readonly WeatherStep[], dayOffset: number, now: Date): WeatherStep | null {
    if (!Number.isInteger(dayOffset) || dayOffset < 0 || steps.length === 0) return null;
    let target: number;
    let maxGap: number;
    if (dayOffset === 0) {
        target = now.getTime();
        maxGap = NOW_MAX_GAP_MS;
    } else {
        const d = new Date(now);
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() + dayOffset);
        d.setHours(DAY_HOUR);
        target = d.getTime();
        maxGap = DAY_MAX_GAP_MS;
    }
    let best: WeatherStep | null = null;
    let bestGap = Infinity;
    for (const s of steps) {
        const gap = Math.abs(s.time - target);
        if (gap < bestGap) {
            best = s;
            bestGap = gap;
        }
    }
    return best && bestGap <= maxGap ? best : null;
}

const SYMBOL_TEXT: Record<number, string> = {
    1: 'Klart', 2: 'Nästan klart', 3: 'Växlande molnighet', 4: 'Halvklart', 5: 'Molnigt', 6: 'Mulet',
    7: 'Dimma', 8: 'Lätta regnskurar', 9: 'Regnskurar', 10: 'Kraftiga regnskurar', 11: 'Åskskurar',
    12: 'Lätta skurar av snöblandat regn', 13: 'Skurar av snöblandat regn', 14: 'Kraftiga skurar av snöblandat regn',
    15: 'Lätta snöbyar', 16: 'Snöbyar', 17: 'Kraftiga snöbyar', 18: 'Lätt regn', 19: 'Regn', 20: 'Kraftigt regn',
    21: 'Åska', 22: 'Lätt snöblandat regn', 23: 'Snöblandat regn', 24: 'Kraftigt snöblandat regn',
    25: 'Lätt snöfall', 26: 'Snöfall', 27: 'Ymnigt snöfall',
};

/** Vädret i ord, för skärmläsare. */
export function weatherText(symbol: number): string {
    return SYMBOL_TEXT[symbol] ?? 'Väder';
}

/** Natt (lokal tid) - klart väder visas då som måne i stället för sol. */
function isNight(timeMs: number): boolean {
    const h = new Date(timeMs).getHours();
    return h < 7 || h >= 18;
}

/** Vädersymbolen som emoji. */
export function weatherEmoji(symbol: number, timeMs: number): string {
    if (symbol === 1 || symbol === 2) return isNight(timeMs) ? '🌙' : symbol === 1 ? '☀️' : '🌤️';
    if (symbol === 3 || symbol === 4) return '⛅';
    if (symbol === 5) return '🌥️';
    if (symbol === 6) return '☁️';
    if (symbol === 7) return '🌫️';
    if (symbol === 8 || symbol === 9) return '🌦️';
    if (symbol === 11 || symbol === 21) return '⛈️';
    if (symbol === 10 || (symbol >= 18 && symbol <= 20)) return '🌧️';
    if (symbol === 17 || symbol === 26 || symbol === 27) return '❄️';
    if ((symbol >= 12 && symbol <= 16) || (symbol >= 22 && symbol <= 25)) return '🌨️';
    return '🌡️';
}

/** Temperaturen avrundad, t.ex. "3°" eller "-2°" (aldrig "-0°"). */
export function formatTemp(temp: number): string {
    const r = Math.round(temp);
    return `${r === 0 ? 0 : r}°`;
}
