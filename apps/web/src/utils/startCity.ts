import { isValidLatLng } from './mapUtils';

/**
 * "Staden man är i" — vyn kartan ÖPPNAR i nästa gång man kommer tillbaka.
 *
 * Bakgrunden (ägarbeslut 31/8): kartan ska inte längre visa hela Sverige och
 * resa/sjunka sig fram till besökaren. Den ska ligga över DIN stad direkt.
 * Problemet är att platstjänsten svarar först en stund efter mount — och tills
 * den gjort det vet vi inte var du är. Lösningen: när vi väl landat i din stad
 * skriver vi ner den här, och nästa besök öppnar kartan där utan att fråga
 * någon. Första besöket (tom lagring) får Sverige-vyn tills GPS:en svarar.
 *
 * Vi sparar ORTEN (nearestCityPoint), inte den råa GPS-punkten: det är samma
 * upplösning som stadsrutan visar, och en grovare uppgift att lämna kvar i
 * webbläsaren.
 */
export interface StartCity {
    lat: number;
    lng: number;
    zoom: number;
    name: string;
    /** ms sedan epoch. Äldre än MAX_AGE_MS ignoreras — se parseStartCity. */
    savedAt: number;
}

export const START_CITY_KEY = 'vadkul_startstad';

/**
 * Hur länge en sparad stad får styra öppningsvyn. En månad: flyttar man, eller
 * lånar man datorn på semestern, ska kartan inte öppna i fel stad i evighet —
 * men den vanliga besökaren (samma stad, då och då) ska aldrig tappa den.
 * Färskare bud vinner ändå direkt: GPS-svaret flyttar kameran inom en sekund.
 */
export const START_CITY_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Tolka det lagrade värdet. REN funktion — all validering sker här, så
 * webbläsarlagringen aldrig kan mata kartan med skräp (en trasig koordinat in i
 * MapLibre fäller hela vyn, se isValidLatLng).
 */
export function parseStartCity(raw: string | null, nowMs: number): StartCity | null {
    if (!raw) return null;
    let obj: unknown;
    try { obj = JSON.parse(raw); } catch { return null; }
    if (!obj || typeof obj !== 'object') return null;
    const { lat, lng, zoom, name, savedAt } = obj as Record<string, unknown>;
    if (!isValidLatLng(lat, lng)) return null;
    if (typeof zoom !== 'number' || !Number.isFinite(zoom)) return null;
    if (typeof name !== 'string' || !name.trim()) return null;
    if (typeof savedAt !== 'number' || !Number.isFinite(savedAt)) return null;
    // Framtida tidsstämpel = flyttad systemklocka; behandla som färsk hellre än
    // att kasta bort en giltig stad (nowMs - savedAt blir negativt).
    if (nowMs - savedAt > START_CITY_MAX_AGE_MS) return null;
    return {
        lat: lat as number,
        lng: lng as number,
        // Kartans minZoom är 4; över 16 finns inga event-tiles att titta på.
        zoom: Math.min(16, Math.max(4, zoom)),
        name: name.trim(),
        savedAt,
    };
}

/** Sparad stad, eller null (första besöket, rensad lagring, privat läge). */
export function readStartCity(nowMs: number = Date.now()): StartCity | null {
    if (typeof window === 'undefined') return null;
    try {
        return parseStartCity(window.localStorage.getItem(START_CITY_KEY), nowMs);
    } catch {
        // Safari i privat läge m.fl. kastar på localStorage — starta som ett
        // förstabesök i stället för att fälla kartan.
        return null;
    }
}

/** Skriv ner staden vi landat i. Tyst vid fel — det här är en bekvämlighet. */
export function writeStartCity(
    city: { lat: number; lng: number; zoom: number; name: string },
    nowMs: number = Date.now(),
): void {
    if (typeof window === 'undefined') return;
    if (!isValidLatLng(city.lat, city.lng)) return;
    try {
        window.localStorage.setItem(START_CITY_KEY, JSON.stringify({ ...city, savedAt: nowMs }));
    } catch { /* full/avstängd lagring — strunt samma */ }
}
