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

// ── Kakel som inte gick att hämta (#207) ─────────────────────────────────────
// Faller hämtningen av ett kakel på nätet (AJAXError med status 0: tappad
// uppkoppling eller avbruten anslutning) eller på en tillfälligt överlastad
// server (408, 429, 5xx) markerar MapLibre kaklet som errored och försöker
// ALDRIG igen - en ruta av kartan saknas tills man panorerar bort och tillbaka.
// Josef 13/11 fick det som Console Error för ett av CARTO:s baskartskakel.
// Läkningen: ladda om just det kaklet (map.refreshTiles, som hämtar det på nytt
// eftersom kaklet då räknas som utgånget) efter en kort stund, högst
// TILE_RETRY_DELAYS_MS.length gånger. Först när det ändå inte går loggas en
// varning. 404 hoppar MapLibre redan över, andra fel loggas som förut.

export interface TileXYZ { x: number; y: number; z: number }

/** HTTP-status ur MapLibres AJAXError, eller null för andra fel. */
export function tileFetchStatus(err: unknown): number | null {
    if (!(err instanceof Error)) return null;
    const status = (err as { status?: unknown }).status;
    if (typeof status === 'number' && err.message.startsWith('AJAXError')) return status;
    // Felet kommer från workern; skulle status-fältet ha tappats på vägen
    // står den ändå i meddelandet: "AJAXError: <text> (<status>): <url>".
    const m = err.message.match(/^AJAXError: .*?\((\d{1,3})\)/);
    return m ? Number(m[1]) : null;
}

/** Tillfälligt fel som är värt ett nytt försök. */
export function isRetryableTileFetch(err: unknown): boolean {
    const status = tileFetchStatus(err);
    if (status == null) return false;
    return status === 0 || status === 408 || status === 429 || status >= 500;
}

/** Väntan före varje nytt försök. Två försök, sedan ges kaklet upp. */
export const TILE_RETRY_DELAYS_MS = [2_000, 8_000] as const;
/** Har kaklet fungerat så här länge börjar räkningen om. */
export const TILE_RETRY_RESET_MS = 60_000;
const TILE_RETRY_MAX_KEYS = 500;

export type TileRetryOutcome = 'retry' | 'pending' | 'gave-up';

/**
 * Returnerar `request(sourceId, tile)`: be om ett nytt försök för kaklet.
 * 'retry' = schemalagt, 'pending' = ett försök väntar redan, 'gave-up' = alla
 * försök är förbrukade (logga då en varning).
 */
export function createTileRetrier(retry: (sourceId: string, tile: TileXYZ) => void, clock: HealClock = realClock) {
    const state = new Map<string, { attempts: number; last: number; pending: boolean }>();

    return function request(sourceId: string, tile: TileXYZ): TileRetryOutcome {
        const key = `${sourceId}/${tile.z}/${tile.x}/${tile.y}`;
        const now = clock.now();
        if (state.size > TILE_RETRY_MAX_KEYS) {
            for (const [k, s] of state) if (!s.pending && now - s.last > TILE_RETRY_RESET_MS) state.delete(k);
        }
        let s = state.get(key);
        if (s && !s.pending && now - s.last > TILE_RETRY_RESET_MS) s = undefined;
        if (s?.pending) return 'pending';
        const attempts = s?.attempts ?? 0;
        if (attempts >= TILE_RETRY_DELAYS_MS.length) {
            state.set(key, { attempts, last: now, pending: false });
            return 'gave-up';
        }
        const next = { attempts: attempts + 1, last: now, pending: true };
        state.set(key, next);
        clock.setTimeout(() => {
            next.pending = false;
            next.last = clock.now();
            retry(sourceId, tile);
        }, TILE_RETRY_DELAYS_MS[attempts]);
        return 'retry';
    };
}
