/**
 * cityInText.ts — hitta KÄNDA städer (SWEDISH_GEO_CITIES) omnämnda i fritext,
 * med vakterna från repair-misplaced-geo (varifrån funktionerna flyttades
 * 25/9 så FB-scraperns ankarstads-logik kan dela dem utan att dra in
 * skriptets Firebase-/SQLite-beroenden).
 */

import { SWEDISH_GEO_CITIES } from './venueCoordinates';

/** Väderstrecks-/storleksprefix som gör ortnamnet till en ANNAN ort. */
const COMPOUND_PREFIX = /(östra|västra|norra|södra|gamla|nya|stora|lilla|övre|nedre)\s*$/i;

/**
 * Nämns orten (ordgräns, genitiv ok, ej bindestreck) i en textsträng?
 * "<Ortnamn> <siffra>" avvisas — det är en BYADRESS ("Sandviken 130" = gård på
 * Frösön, inte staden Sandviken); lookahead kräver att whitespace efter namnet
 * INTE följs av en siffra.
 */
export function cityMentioned(text: string, city: string): boolean {
    const esc = city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(^|[\\s,])${esc}s?(?=$|[,.!:)]|\\s+(?!\\d))`, 'i');
    const m = re.exec(text || '');
    if (!m) return false;
    return !COMPOUND_PREFIX.test((text || '').slice(0, m.index + m[1].length));
}

/**
 * Känd stad i en textsträng. Ordgränser är space/komma/punkt — INTE bindestreck:
 * "Vinberg-Ljungby" (Falkenberg), "Nora-Skogs" (Ångermanland) är egna orter och
 * får inte matcha Ljungby/Nora. Prefix-vakten stoppar "Östra Ljungby" (Skåne)
 * och "Västra Sandviken" (Grums) — dry-run 2026-07-02 visade att de annars
 * "repareras" till fel landsdel.
 */
export function findKnownCity(text: string): string | null {
    for (const c of SWEDISH_GEO_CITIES) {
        if (cityMentioned(text, c)) return c;
    }
    return null;
}

/** ALLA kända städer som nämns — för tvetydighetsvakter ("Buss Göteborg–Malmö"
 *  nämner två och ska inte ge något entydigt stadsbevis). */
export function findKnownCities(text: string): string[] {
    return SWEDISH_GEO_CITIES.filter((c) => cityMentioned(text, c));
}
