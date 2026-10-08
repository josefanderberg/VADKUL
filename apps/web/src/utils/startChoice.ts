import { CITY_POINTS, findCityPoint, type CityPoint } from './cityPoints';
import { CITIES as CITY_PAGES } from './cityPages';

/**
 * VALD STARTSTAD (ägarbeslut 8/10, Josef: "efter välkomstmodalen så kan man
 * välja stad och kanske kategori. eller bara hoppa över och komma till där
 * man är" - förebild happymap.se).
 *
 * Skild från utils/startCity, som är den GPS-landade staden kartan minns
 * mellan besöken: ett AKTIVT val vinner över GPS:en och går aldrig ut (det
 * gör den GPS-landade efter en månad). "Där jag är" = inget val = dagens
 * beteende.
 *
 * Valet lagras som ORTNAMNET och slås upp i cityPoints (291 orter, alla
 * stadssidor inräknade - testet håller det sant). Koordinaterna kommer alltså
 * alltid ur listan, aldrig ur lagringen eller kontot.
 *
 * Persistens: localStorage för alla + users.startstad för inloggade
 * (sträng = vald ort, null = "där jag är", saknas = aldrig frågat). Kontot
 * vinner över enheten, precis som kartfiltret (utils/mapFilter).
 */

export const CHOSEN_CITY_KEY = 'vadkul_vald_startstad';
/** Har väljaren besvarats (vald stad, "där jag är" eller hoppa över)? */
export const START_PICKER_DONE_KEY = 'vadkul_startval_klart';
/** Stadsnivån kartan landar på - samma som sidans TOUR_ZOOM. */
export const START_CHOICE_ZOOM = 10;

/** Kontots fält tolkat: ort, "där jag är" eller aldrig besvarat. REN. */
export type AccountStartChoice =
    | { kind: 'unset' }
    | { kind: 'here' }
    | { kind: 'city'; city: CityPoint };

export function parseAccountStartChoice(value: unknown): AccountStartChoice {
    if (value === null) return { kind: 'here' };
    if (typeof value !== 'string') return { kind: 'unset' };
    const city = findCityPoint(value);
    // Okänd ort (omdöpt/borttagen ur listan) = som aldrig besvarat - hellre
    // en ny fråga än en karta som öppnar på fel ställe.
    return city ? { kind: 'city', city } : { kind: 'unset' };
}

/** Lagrat ortnamn → ort ur listan, eller null. REN. */
export function parseChosenCity(raw: string | null): CityPoint | null {
    if (!raw) return null;
    return findCityPoint(raw);
}

export function readChosenCity(): CityPoint | null {
    if (typeof window === 'undefined') return null;
    try { return parseChosenCity(window.localStorage.getItem(CHOSEN_CITY_KEY)); } catch { return null; }
}

/** Spara valet (null = "där jag är") och kvittera att väljaren besvarats. */
export function writeChosenCity(city: CityPoint | null): void {
    if (typeof window === 'undefined') return;
    try {
        if (city) window.localStorage.setItem(CHOSEN_CITY_KEY, city.name);
        else window.localStorage.removeItem(CHOSEN_CITY_KEY);
        window.localStorage.setItem(START_PICKER_DONE_KEY, '1');
    } catch { /* privat läge - valet gäller besöket */ }
}

/** Hoppa över: kvittera utan att röra ett tidigare val. */
export function markStartPickerDone(): void {
    if (typeof window === 'undefined') return;
    try { window.localStorage.setItem(START_PICKER_DONE_KEY, '1'); } catch { /* privat läge */ }
}

export function readStartPickerDone(): boolean {
    if (typeof window === 'undefined') return false;
    try { return window.localStorage.getItem(START_PICKER_DONE_KEY) === '1'; } catch { return true; }
}

/**
 * Snabbvalen i väljaren innan man skrivit något: stadssidornas orter, största
 * först. Resten (291 orter) nås via sökfältet. REN.
 */
export function popularStartCities(limit = 12): CityPoint[] {
    const out: CityPoint[] = [];
    for (const page of [...CITY_PAGES].sort((a, b) => b.population - a.population)) {
        const point = findCityPoint(page.name);
        if (point && !out.includes(point)) out.push(point);
        if (out.length >= limit) break;
    }
    return out;
}

/** Antal orter man kan välja - väljarens "alla N orter"-rad. */
export const START_CITY_COUNT = CITY_POINTS.length;
