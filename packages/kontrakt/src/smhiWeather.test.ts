import { describe, expect, it } from 'vitest';
import {
    cityWeatherFor, createSmhiLoader, formatTemp, parseSmhiForecast, pickWeatherForDay, SMHI_RETRY_MS, SMHI_TTL_MS,
    smhiPointUrl, WEATHER_PENDING, weatherEmoji, weatherText, weatherToShow,
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

// Det dagchipet ritar - webbens hook och appens platta läser samma svar (#237).
describe('cityWeatherFor', () => {
    const steps = parseSmhiForecast(SVAR);
    const nu = new Date('2026-11-13T15:20:00Z');
    const VAXJO = 'https://smhi.invalid/vaxjo';
    const KALMAR = 'https://smhi.invalid/kalmar';

    it('ortens egen prognos: symbol, temperatur och text', () => {
        expect(cityWeatherFor(VAXJO, { url: VAXJO, steps }, 0, nu)).toEqual({
            emoji: '☁️', temp: '2°', text: 'Mulet', state: 'fresh',
        });
    });

    it('på väg till en ny ort ritas förra ortens väder som gammalt', () => {
        expect(cityWeatherFor(KALMAR, { url: VAXJO, steps }, 0, nu)).toEqual({
            emoji: '☁️', temp: '2°', text: 'Mulet', state: 'stale',
        });
    });

    it('före första svaret ritas utfyllnaden', () => {
        expect(cityWeatherFor(VAXJO, null, 0, nu)).toBe(WEATHER_PENDING);
        expect(WEATHER_PENDING.state).toBe('pending');
        expect(WEATHER_PENDING.text).toBe('');
    });

    it('förra orten saknar dagens timme: platsen hålls tills den nya kommit', () => {
        expect(cityWeatherFor(KALMAR, { url: VAXJO, steps }, 9, nu)).toBe(WEATHER_PENDING);
    });

    it('ortens egen prognos når inte dagen: inget väder', () => {
        expect(cityWeatherFor(VAXJO, { url: VAXJO, steps }, 9, nu)).toBeNull();
    });

    it('ingen ort eller en ort utan prognos: inget väder', () => {
        expect(cityWeatherFor(null, { url: VAXJO, steps }, 0, nu)).toBeNull();
        expect(cityWeatherFor(VAXJO, { url: VAXJO, steps: [] }, 0, nu)).toBeNull();
    });
});

describe('createSmhiLoader', () => {
    const URL_A = 'https://smhi.invalid/a';
    const URL_B = 'https://smhi.invalid/b';

    /** En hämtning som räknar anropen och svarar med det som ligger i kön. */
    function fejkad(svar: (() => unknown)[]) {
        const anrop: string[] = [];
        const fetchJson = async (url: string) => {
            anrop.push(url);
            const nästa = svar.shift();
            if (!nästa) throw new Error('inget svar köat');
            return nästa();
        };
        return { anrop, fetchJson };
    }
    const nätfel = () => { throw new Error('nätfel'); };

    it('hämtar en gång per ort och minns prognosen en halvtimme', async () => {
        let nu = 1_000_000;
        const { anrop, fetchJson } = fejkad([() => SVAR, () => SVAR]);
        const load = createSmhiLoader(fetchJson, () => nu);

        const första = await load(URL_A);
        expect(första.map(s => s.temp)).toEqual([2.4, 1.6, -0.4, 4.6]);
        nu += SMHI_TTL_MS - 1;
        // Samma lista tillbaka (samma objekt) - klienten kan jämföra på identitet.
        expect(await load(URL_A)).toBe(första);
        expect(anrop).toEqual([URL_A]);

        nu += 1;
        await load(URL_A);
        expect(anrop).toEqual([URL_A, URL_A]);
    });

    it('två samtidiga frågor om samma ort delar på en hämtning', async () => {
        const { anrop, fetchJson } = fejkad([() => SVAR, () => SVAR]);
        const load = createSmhiLoader(fetchJson, () => 0);
        const [a, b, c] = await Promise.all([load(URL_A), load(URL_A), load(URL_B)]);
        expect(a).toBe(b);
        expect(c).not.toBe(a);
        expect(anrop).toEqual([URL_A, URL_B]);
    });

    it('en ort SMHI saknar (null) ger tom lista och frågas inte om i onödan', async () => {
        let nu = 0;
        const { anrop, fetchJson } = fejkad([() => null]);
        const load = createSmhiLoader(fetchJson, () => nu);
        expect(await load(URL_A)).toEqual([]);
        nu += SMHI_RETRY_MS + 1;
        expect(await load(URL_A)).toEqual([]);
        expect(anrop).toEqual([URL_A]);
    });

    it('ett nätfel faller aldrig - tom lista, och orten försöker snart igen', async () => {
        let nu = 0;
        const { anrop, fetchJson } = fejkad([nätfel, () => SVAR]);
        const load = createSmhiLoader(fetchJson, () => nu);
        expect(await load(URL_A)).toEqual([]);
        nu += SMHI_RETRY_MS - 1;
        expect(await load(URL_A)).toEqual([]);
        expect(anrop).toEqual([URL_A]);

        nu += 1;
        expect((await load(URL_A)).length).toBe(4);
        expect(anrop).toEqual([URL_A, URL_A]);
    });

    it('nätfel vid omhämtningen: den förra prognosen står kvar', async () => {
        let nu = 0;
        const { fetchJson } = fejkad([() => SVAR, nätfel, () => SVAR]);
        const load = createSmhiLoader(fetchJson, () => nu);
        const första = await load(URL_A);
        nu += SMHI_TTL_MS;
        expect(await load(URL_A)).toBe(första);
        nu += SMHI_RETRY_MS;
        const ny = await load(URL_A);
        expect(ny).not.toBe(första);
        expect(ny).toEqual(första);
    });

    it('en hämtning som kastar direkt (inte via löftet) fälls inte heller', async () => {
        const load = createSmhiLoader(() => { throw new Error('synkront fel'); }, () => 0);
        expect(await load(URL_A)).toEqual([]);
    });
});
