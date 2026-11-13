// ── Motorbuggen "feature index out of bounds" (#206) ────────────────────────
// Ren modul (inga kart- eller webbläsar-API:er) så logiken går att testa.
// V2Map kopplar den till kartans 'error'-händelse.
//
// VAD SOM HÄNDER: när ett kakel i en geojson-källa med feature-state laddas
// ('plain-events' med reveal, frontkällan med zop) skriver MapLibre in
// feature-staten i kakelns nya buckets. Den slår då upp varje feature i
// kakelns rådata på huvudtråden. Under streamens updateData-vågor kan ett
// kakels svar komma i fel ordning: workern tolkar om den nya kakeldatan men
// skickar ingen ny rådata, och huvudtråden har kvar den gamla, kortare. Då
// finns featuren inte och MapLibre kastar "feature index out of bounds" (i
// tile_manager _loadTile). Felet fångas där, kaklet markeras som errored och
// RITAS INTE, och felet loggas som Console Error eftersom kartan saknade en
// error-lyssnare. Samma motorbugg som stream-normaliseringen och pickHoverKey
// redan går runt (se V2Map).
//
// LÄKNINGEN: en ny omladdning av samma kakel räcker inte - workern tolkar då
// om samma data utan rådata och felet kommer tillbaka. Det som läker är en
// full setData med källans nuvarande innehåll: workern tömmer sina laddade
// kakel och alla kakel, även det trasiga, laddas om från rent läge med ny
// rådata. Innehållet är detsamma, så det syns inte. Feature-staten (reveal,
// zop) ligger kvar, den nollas bara av ett stilbyte.
//
// Avstudsat (en våg kan fälla flera kakel på en gång -> EN läkning) och
// bromsat (väntetiden fördubblas om felet kommer tillbaka direkt), så att en
// läkning som själv skulle fälla felet aldrig kan bli en loop.

export const FEATURE_INDEX_ERROR = 'feature index out of bounds';

export function isFeatureIndexError(err: unknown): boolean {
    const msg = err instanceof Error ? err.message
        : typeof err === 'string' ? err
            : '';
    return msg.includes(FEATURE_INDEX_ERROR);
}

/** Väntan innan läkningen körs: samlar ihop en vågs alla trasiga kakel. */
export const HEAL_DEBOUNCE_MS = 400;
/** Minsta tid mellan två läkningar av samma källa. */
export const HEAL_COOLDOWN_MS = 3_000;
/** Taket när felet kommer tillbaka gång på gång. */
export const HEAL_COOLDOWN_MAX_MS = 60_000;

export interface HealClock {
    now(): number;
    setTimeout(fn: () => void, ms: number): unknown;
}

const realClock: HealClock = {
    now: () => Date.now(),
    setTimeout: (fn, ms) => setTimeout(fn, ms),
};

/**
 * Returnerar `request(sourceId)`: be om en läkning av källan. Flera anrop
 * medan en läkning väntar slås ihop till en. En ny begäran kort efter en
 * läkning väntar ut bromsen, som fördubblas för varje läkning som följs av
 * nya fel inom bromsen och nollställs när källan varit lugn en hel broms.
 * Inget anrop tappas: kommer felet igen blir det alltid en läkning till.
 */
export function createSourceHealer(heal: (sourceId: string) => void, clock: HealClock = realClock) {
    const pending = new Set<string>();
    const state = new Map<string, { last: number; cooldown: number }>();

    return function request(sourceId: string): boolean {
        if (pending.has(sourceId)) return false;
        const now = clock.now();
        const prev = state.get(sourceId);
        let cooldown = HEAL_COOLDOWN_MS;
        let wait = HEAL_DEBOUNCE_MS;
        if (prev) {
            const since = now - prev.last;
            // Felet kom tillbaka inom bromsen: läkningen räckte inte, vänta längre nästa gång.
            cooldown = since < prev.cooldown
                ? Math.min(prev.cooldown * 2, HEAL_COOLDOWN_MAX_MS)
                : HEAL_COOLDOWN_MS;
            wait = Math.max(HEAL_DEBOUNCE_MS, prev.cooldown - since);
        }
        pending.add(sourceId);
        clock.setTimeout(() => {
            pending.delete(sourceId);
            state.set(sourceId, { last: clock.now(), cooldown });
            heal(sourceId);
        }, wait);
        return true;
    };
}
