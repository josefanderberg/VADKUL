import { NO_TIME_PAST_HOUR } from '@/components/v2/v2MapBricka';

/**
 * heroMarkers.ts — vilka brickor stads-heron ritar för ett givet filter.
 *
 * Bruten ur CityMapHeroCanvas 20/9 när heron slutade rendera en MapLibre-
 * canvas. Kartbilden ÄR sedan dess bara de statiska OSM-kaklen, och brickorna
 * placeras som vanliga DOM-element ovanpå dem — heron har aldrig kunnat dras
 * eller zoomas, så en hel GL-motor (≈800 kB JS + stil-hämtning) betalade bara
 * för en bild vi redan hade.
 *
 * Positionerna (dx/dy) räknas på SERVERN i CityMapHero, i kakelrutnätets egen
 * skala. Den här modulen gör bara urvalet, och är därför ren och testbar.
 */

const HOUR_MS = 3_600_000;

/** Min-avstånd i px mellan två brickor + tak på antalet. */
export const MIN_DIST_PX = 40;
export const MAX_LIVE = 140;

/**
 * Ett event heron kan visa. `dx`/`dy` = pixel-offset från heronas mitt vid
 * hero-zoomen, färdigräknat på servern (samma projektion som kaklen).
 * `hex` i stället för färdig gradient-CSS: gradienten byggs i komponenten
 * (sparar ~30 kB HTML på stora städer). `day` = 'YYYY-MM-DD' (svensk tid).
 * `href` = stora kartan med eventet uppslaget (?event=).
 */
export type HeroLiveEvent = {
    id: string;
    href: string;
    dx: number;
    dy: number;
    emoji: string;
    hex: string | null;
    t: number;
    hour: number | null;
    day: string;
    /** Kategorinyckeln — heron följer kategorichipsen precis som listan. */
    category: string;
};

/** En placerad bricka: gruppens tidigaste event + hur många som delar platsen. */
export type HeroMarker = { e: HeroLiveEvent; count: number };

/**
 * Samma "har varit"-trappa som daglistan och stora kartan: med klockslag är
 * eventet passerat 1 h efter start; utan klockslag vid NO_TIME_PAST_HOUR sin
 * dag. Delas av alla ytor — uppfinn ingen egen gräns.
 */
export function isPastEv(e: { t: number; hour: number | null }, now: number): boolean {
    if (e.hour !== null) return e.t < now - HOUR_MS;
    return new Date(e.t).setHours(NO_TIME_PAST_HOUR, 0, 0, 0) <= now;
}

/**
 * Brickorna som ska ritas, i ritordning.
 *
 * Ordningen i `markers` är prioritetsordningen (servern skickar dem
 * tidigast-först). Tre steg, i tur och ordning:
 *  1. Filtrera bort passerade, event utanför dagurvalet och fel kategori.
 *  2. Gruppera per plats — flera event på samma koordinat blir EN bricka med
 *     en räknare, precis som stora kartans klumpar.
 *  3. Greedy gallring: en grupp hoppas över om den hamnar närmare än
 *     MIN_DIST_PX från en redan placerad bricka. Tidigast-först vinner.
 *
 * `dayKeys = null` betyder "alla dagar" (perioden Alla).
 */
export function pickHeroMarkers(
    markers: readonly HeroLiveEvent[],
    opts: {
        /** Dagnycklar urvalet tillåter, eller null för alla. */
        dayKeys: readonly string[] | null;
        /** Vald kategorinyckel, eller null för alla. */
        category: string | null;
        /** Klockan nu — styr "har varit". */
        now: number;
        maxLive?: number;
        minDistPx?: number;
    },
): HeroMarker[] {
    const { dayKeys, category, now } = opts;
    const maxLive = opts.maxLive ?? MAX_LIVE;
    const minDist = opts.minDistPx ?? MIN_DIST_PX;

    // 1 + 2: filtrera och gruppera per plats. Map bevarar insättningsordning,
    // så grupperna kommer i prioritetsordning och gruppens första event är
    // det tidigaste — det blir brickans ansikte.
    const byCoord = new Map<string, HeroLiveEvent[]>();
    for (const e of markers) {
        if (isPastEv(e, now)) continue;
        if (dayKeys && !dayKeys.includes(e.day)) continue;
        if (category !== null && e.category !== category) continue;
        const k = `${e.dx},${e.dy}`;
        const g = byCoord.get(k);
        if (g) g.push(e); else byCoord.set(k, [e]);
    }

    // 3: greedy gallring i px.
    const out: HeroMarker[] = [];
    for (const group of byCoord.values()) {
        if (out.length >= maxLive) break;
        const rep = group[0];
        if (out.some(m => (m.e.dx - rep.dx) ** 2 + (m.e.dy - rep.dy) ** 2 < minDist ** 2)) continue;
        out.push({ e: rep, count: group.length });
    }
    return out;
}
