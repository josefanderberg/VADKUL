import { EVENT_CATEGORIES, type EventCategoryType } from './categories';

/**
 * Kartans sparade filter (ägarbeslut 6/10: "en tydligare filter som sparas
 * med localStorage eller på sitt inlogg"). Kategorivalet i sökpanelen är
 * sedan samma dag ett FLERVAL (Musik + Quiz samtidigt), och det överlever
 * nästa besök: utloggade via nyckeln här, inloggade via users.mapFilter
 * (hydreringen i (v2)/page.tsx — kontot vinner över enheten, en delad
 * ?kat=-länk vinner över båda).
 *
 * 15/9-läxan gäller fortfarande: ett sparat filter får ALDRIG vara osynligt.
 * Det som gör persistensen okej nu är att filtret alltid syns som brickor
 * med ✕ under dagplattan — vägen ut är ett tryck, inte en gissning.
 *
 * Fler-källan ("visa bara Svenska kyrkan/PRO/Korpen") sparas MEDVETET inte:
 * den gömmer allt annat och är ett tillfälligt drilldown-läge, inte en
 * preferens. Opt-in-källorna har sin egen persistens (users.mapCategories).
 */
export interface MapFilterPrefs {
    /** Valda kategorier (tom = visa alla). */
    kats: EventCategoryType[];
    /** 🔥 Populära-läget. */
    pop: boolean;
}

export const MAP_FILTER_KEY = 'vadkul_kartfilter';

/**
 * Samma månadsgräns som startstaden (startCity.ts): ett filter man satte för
 * länge sedan ska inte smalna kartan i evighet — det är precis det osynliga
 * filter 15/9-beslutet handlade om.
 */
export const MAP_FILTER_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Tolka det lagrade värdet. REN funktion — all validering bor här så
 * webbläsarlagringen aldrig matar kartan med skräp: okända kategorinycklar
 * filtreras bort (en gammal nyckel efter en rename ska inte ge ett filter
 * som tömmer kartan), och utgångna/trasiga poster ger null.
 */
export function parseMapFilter(raw: string | null, nowMs: number): MapFilterPrefs | null {
    if (!raw) return null;
    let obj: unknown;
    try { obj = JSON.parse(raw); } catch { return null; }
    if (!obj || typeof obj !== 'object') return null;
    const { kats, pop, savedAt } = obj as Record<string, unknown>;
    if (typeof savedAt !== 'number' || !Number.isFinite(savedAt)) return null;
    if (nowMs - savedAt > MAP_FILTER_MAX_AGE_MS) return null;
    const validKats = Array.isArray(kats)
        ? kats.filter((k): k is EventCategoryType => typeof k === 'string' && k in EVENT_CATEGORIES)
        : [];
    const popOn = pop === true;
    if (validKats.length === 0 && !popOn) return null;
    return { kats: validKats, pop: popOn };
}

/** Det som skrivs till lagringen — exporterad för testerna. */
export function serializeMapFilter(prefs: MapFilterPrefs, nowMs: number): string {
    return JSON.stringify({ kats: prefs.kats, pop: prefs.pop, savedAt: nowMs });
}

/** Läs det sparade filtret. null = inget (eller trasigt/utgånget/privat läge). */
export function readMapFilter(nowMs = Date.now()): MapFilterPrefs | null {
    try {
        return parseMapFilter(window.localStorage.getItem(MAP_FILTER_KEY), nowMs);
    } catch { return null; }
}

/**
 * Spara filtret. Ett tomt filter (inga kategorier, 🔥 av) tar bort nyckeln i
 * stället för att spara "ingenting" — annars förnyas TTL:n på ett avval.
 */
export function writeMapFilter(prefs: MapFilterPrefs, nowMs = Date.now()): void {
    try {
        if (prefs.kats.length === 0 && !prefs.pop) window.localStorage.removeItem(MAP_FILTER_KEY);
        else window.localStorage.setItem(MAP_FILTER_KEY, serializeMapFilter(prefs, nowMs));
    } catch { /* privat läge — filtret gäller då bara besöket */ }
}
