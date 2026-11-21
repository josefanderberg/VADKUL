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
    /** Pixel-offset från heronas mitt — bildvägen (CityMapHeroMarkers). */
    dx: number;
    dy: number;
    /** Koordinaten — behövs bara av GL-reservvägen (CityMapHeroCanvas), som
     *  projicerar själv. Byggs av samma buildLiveEvents, så de kan aldrig
     *  peka på olika platser. */
    lat: number;
    lng: number;
    emoji: string;
    /** Titeln vid brickan (#267, 20/11), redan kapad på servern med stora
     *  kartans truncateLabel (18 tecken) så HTML:n inte sväller. */
    title: string;
    hex: string | null;
    t: number;
    hour: number | null;
    day: string;
    /** Kategorinyckeln — heron följer kategorichipsen precis som listan. */
    category: string;
    /** 🔥 Populär (pipelinens klassning) — heron följer 🔥-chippet (7/10,
     *  "inne på stadssidan ska ju de event man vill se visas"). Utelämnas
     *  när inte populär (mindre HTML). */
    pop?: boolean;
};

/** En placerad bricka: gruppens tidigaste event + hur många som delar platsen. */
/** `lastDay` = gruppens senaste dag ('YYYY-MM-DD') - styr hur många dagar
 *  stora kartan ska visa när man trycker på en multibricka (#273). */
export type HeroMarker = { e: HeroLiveEvent; count: number; lastDay: string };

/** Senaste dagen i en grupp (dagnycklarna sorterar som text). REN. */
export function lastDayOf(group: readonly { day: string }[]): string {
    return group.reduce((max, e) => (e.day > max ? e.day : max), group[0]?.day ?? '');
}

/** Flest dagar länken ber kartan visa (kartans eget tak för ?dagar=). */
export const HERO_RANGE_MAX_DAYS = 31;

/**
 * Länken en herobricka öppnar (#273, Josef 22/11: "om jag klickar på typ en
 * eventbricka som säger 41 ... så ska jag ju komma till hela veckan och visa
 * det multieventet. nu kommer jag till området men för idag").
 *
 * Brickans siffra räknar alla event på platsen i den valda PERIODEN, men
 * `href` öppnar bara det tidigaste eventet på dess egen dag. Spänner gruppen
 * över fler dagar än så bär länken därför med sig `dag=0&dagar=N` (idag till
 * och med gruppens sista dag), så stora kartan visar samma urval som brickan
 * räknade. En ensam bricka, eller en grupp på en enda dag, får länken orörd.
 * REN: `todayKey` = dagens dagnyckel i svensk tid.
 */
export function heroBrickHref(href: string, count: number, lastDay: string, todayKey: string): string {
    if (count < 2 || !lastDay || !todayKey || lastDay <= todayKey) return href;
    const dagar = Math.round((Date.parse(`${lastDay}T00:00:00Z`) - Date.parse(`${todayKey}T00:00:00Z`)) / 86_400_000) + 1;
    if (!Number.isFinite(dagar) || dagar < 2) return href;
    return `${href}${href.includes('?') ? '&' : '?'}dag=0&dagar=${Math.min(dagar, HERO_RANGE_MAX_DAYS)}`;
}

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
        /** 🔥-chippet: bara pipelineklassade populära event (7/10). */
        popularOnly?: boolean;
        /** Klockan nu — styr "har varit". */
        now: number;
        maxLive?: number;
        minDistPx?: number;
    },
): HeroMarker[] {
    const { dayKeys, category, popularOnly = false, now } = opts;
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
        if (popularOnly && e.pop !== true) continue;
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
        out.push({ e: rep, count: group.length, lastDay: lastDayOf(group) });
    }
    return out;
}
