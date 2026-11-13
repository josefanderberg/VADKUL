import { describe, expect, it } from 'vitest';
import {
    formatTemp, parseSmhiForecast, pickWeatherForDay, smhiPointUrl, weatherEmoji, weatherText, weatherToShow,
    type WeatherStep,
} from './smhiWeather';

// Ett utdrag i snow1g-formatet (fälten som används + några till).
const SVAR = {
    createdTime: '2026-11-13T14:44:25Z',
    referenceTime: '2026-11-13T14:30:00Z',
    geometry: { type: 'Point', coordinates: [18.077207, 59.33036] },
    timeSeries: [
        { time: '2026-11-13T16:00:00Z', data: { air_temperature: 1.6, symbol_code: 6, wind_speed: 6.1 } },
        { time: '2026-11-13T15:00:00Z', data: { air_temperature: 2.4, symbol_code: 6, wind_speed: 7.0 } },
        { time: '2026-11-14T12:00:00Z', data: { air_temperature: -0.4, symbol_code: 2 } },
        { time: '2026-11-15T12:00:00Z', data: { air_temperature: 4.6, symbol_code: 19 } },
        { time: 'trasig', data: { air_temperature: 3, symbol_code: 1 } },
        { time: '2026-11-16T12:00:00Z', data: { symbol_code: 1 } },
        { time: '2026-11-17T12:00:00Z', data: { air_temperature: 3, symbol_code: 99 } },
    ],
};

describe('smhiPointUrl', () => {
    it('pekar på snow1g-punktprognosen med lon före lat', () => {
        expect(smhiPointUrl(59.3293, 18.0686)).toBe(
            'https://opendata-download-metfcst.smhi.se/api/category/snow1g/version/1/geotype/point/lon/18.069/lat/59.329/data.json',
        );
    });
});

describe('parseSmhiForecast', () => {
    it('läser tid, temperatur och symbol i tidsordning och hoppar över trasiga steg', () => {
        const steps = parseSmhiForecast(SVAR);
        expect(steps.map(s => s.temp)).toEqual([2.4, 1.6, -0.4, 4.6]);
        expect(steps[0]).toEqual({ time: Date.parse('2026-11-13T15:00:00Z'), temp: 2.4, symbol: 6 });
    });

    it('tål skräp', () => {
        expect(parseSmhiForecast(null)).toEqual([]);
        expect(parseSmhiForecast({})).toEqual([]);
        expect(parseSmhiForecast({ timeSeries: 'nej' })).toEqual([]);
    });
});

describe('pickWeatherForDay', () => {
    const steps = parseSmhiForecast(SVAR);

    it('idag: närmaste timme', () => {
        const nu = new Date('2026-11-13T15:20:00Z');
        expect(pickWeatherForDay(steps, 0, nu)?.temp).toBe(2.4);
    });

    it('idag utan prognos nära i tid: inget', () => {
        expect(pickWeatherForDay(steps, 0, new Date('2026-11-13T09:00:00Z'))).toBeNull();
    });

    it('kommande dagar: mitt på dagen', () => {
        // Lokal tid i testmiljön kan vara vad som helst - räkna målet likadant som funktionen.
        const nu = new Date('2026-11-13T15:20:00Z');
        const imorgon = pickWeatherForDay(steps, 1, nu);
        const mal = new Date(nu); mal.setHours(0, 0, 0, 0); mal.setDate(mal.getDate() + 1); mal.setHours(13);
        if (Math.abs(Date.parse('2026-11-14T12:00:00Z') - mal.getTime()) <= 3 * 3600_000) {
            expect(imorgon?.temp).toBe(-0.4);
        } else {
            expect(imorgon).toBeNull();
        }
    });

    it('bortom prognosen, bakåt i tiden och utan data: inget', () => {
        const nu = new Date('2026-11-13T15:20:00Z');
        expect(pickWeatherForDay(steps, 9, nu)).toBeNull();
        expect(pickWeatherForDay(steps, -1, nu)).toBeNull();
        expect(pickWeatherForDay([], 0, nu)).toBeNull();
    });
});

describe('weatherEmoji och weatherText', () => {
    const dag = new Date(2026, 10, 13, 12).getTime();
    const natt = new Date(2026, 10, 13, 23).getTime();

    it('sol på dagen, måne på natten', () => {
        expect(weatherEmoji(1, dag)).toBe('☀️');
        expect(weatherEmoji(2, dag)).toBe('🌤️');
        expect(weatherEmoji(1, natt)).toBe('🌙');
    });

    it('har en symbol och en text för alla SMHI:s 27 koder', () => {
        for (let s = 1; s <= 27; s++) {
            expect(weatherEmoji(s, dag)).not.toBe('🌡️');
            expect(weatherText(s)).not.toBe('Väder');
        }
        expect(weatherEmoji(6, dag)).toBe('☁️');
        expect(weatherEmoji(19, dag)).toBe('🌧️');
        expect(weatherEmoji(26, dag)).toBe('❄️');
        expect(weatherText(6)).toBe('Mulet');
    });
});

describe('formatTemp', () => {
    it('avrundar och skriver aldrig -0', () => {
        expect(formatTemp(2.4)).toBe('2°');
        expect(formatTemp(-2.6)).toBe('-3°');
        expect(formatTemp(-0.4)).toBe('0°');
    });
});

// #221, Josef 13/11: "när temperaturen ändras när man går till en annan stad.
// då försvinner allt. så söndag flyttas snabbt mot mitten i några sekunder".
describe('weatherToShow', () => {
    const steg: WeatherStep[] = [{ time: Date.UTC(2026, 10, 13, 12), temp: 3, symbol: 3 }];
    const VAXJO = 'https://smhi.invalid/vaxjo';
    const KALMAR = 'https://smhi.invalid/kalmar';

    it('ingen ort = inget väder', () => {
        expect(weatherToShow(null, { url: VAXJO, steps: steg })).toBeNull();
    });

    it('före allra första svaret hålls platsen', () => {
        expect(weatherToShow(VAXJO, null)).toEqual({ state: 'pending' });
    });

    it('ortens egen prognos visas som den är', () => {
        expect(weatherToShow(VAXJO, { url: VAXJO, steps: steg })).toEqual({ state: 'fresh', steps: steg });
    });

    it('på väg till en ny ort står förra ortens väder kvar - chipet byter inte bredd', () => {
        expect(weatherToShow(KALMAR, { url: VAXJO, steps: steg })).toEqual({ state: 'stale', steps: steg });
    });

    it('en ort utan prognos visar inget, men håller platsen åt nästa ort', () => {
        expect(weatherToShow(VAXJO, { url: VAXJO, steps: [] })).toBeNull();
        expect(weatherToShow(KALMAR, { url: VAXJO, steps: [] })).toEqual({ state: 'pending' });
    });
});
