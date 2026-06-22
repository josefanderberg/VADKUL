/**
 * featureToggles.ts — katalog + lagring för användarens på/av-val av funktioner.
 *
 * Designmål (samarbete pågår i kartkoden):
 *  - Kartkoden (V2Map/CloudPopup/page) ska kunna fråga `isFeatureOn('cloudDrift')`
 *    SYNKRONT utan context-plumbing → 1-rads integration.
 *  - Värden lagras i localStorage (default = katalogens defaultOn) och speglas
 *    valfritt till Firestore per inloggad user (se useFeatureToggles).
 *  - Ändringar dispatchar ett window-event så öppna komponenter kan läsa om live.
 */

export type FeatureGroup = 'map' | 'premium' | 'soon';
export type FeatureTier = 'free' | 'premium' | 'soon';

export interface FeatureDef {
    id: string;
    name: string;
    description: string;
    group: FeatureGroup;
    tier: FeatureTier;
    /** Standardläge för gratis-funktioner (premium/soon styrs av upplåsning/kö). */
    defaultOn: boolean;
    /** lucide-react ikonnamn (valfritt, för UI). */
    icon?: string;
}

export const FEATURE_GROUPS: { id: FeatureGroup; title: string; subtitle: string }[] = [
    { id: 'map', title: 'Kartan & upplevelse', subtitle: 'Slå på eller stäng av det som händer på kartan.' },
    { id: 'premium', title: 'Premium', subtitle: 'Lås upp extra funktioner.' },
    { id: 'soon', title: 'På gång', subtitle: 'Funktioner på väg — ställ dig i kö så hör vi av oss.' },
];

/**
 * Katalogen är grundad i vad som faktiskt finns i appen idag.
 * `map`-funktionerna lever i V2Map/CloudPopup/page.tsx och gatas via isFeatureOn().
 */
export const FEATURE_CATALOG: FeatureDef[] = [
    // ── Kartan & upplevelse (gratis på/av) ──────────────────────────────────
    {
        id: 'clouds',
        name: 'Moln',
        description: 'Animerade moln ovanpå kartan.',
        group: 'map', tier: 'free', defaultOn: true, icon: 'Cloud',
    },
    {
        id: 'cloudDrift',
        name: 'Automatisk molnrörelse',
        description: 'Molnen rör sig långsamt av sig själva. Stäng av för en lugnare karta och bättre batteritid.',
        group: 'map', tier: 'free', defaultOn: true, icon: 'Wind',
    },
    {
        id: 'slingshot',
        name: 'Slangbella',
        description: 'Dra och skjut iväg molnet med slangbella-greppet.',
        group: 'map', tier: 'free', defaultOn: true, icon: 'Target',
    },
    {
        id: 'findGame',
        name: 'Hitta event',
        description: 'Mini-spelet där du gissar var ett event ligger på kartan.',
        group: 'map', tier: 'free', defaultOn: true, icon: 'Sparkles',
    },
    {
        id: 'tilt3d',
        name: '3D-vy',
        description: 'Luta kartan för ett 3D-perspektiv.',
        group: 'map', tier: 'free', defaultOn: true, icon: 'Mountain',
    },
    {
        id: 'reviret',
        name: 'Reviret',
        description: 'I pinball-läget målar kulan rutorna den rullar genom i din färg — eventen i ditt revir blir dina.',
        group: 'map', tier: 'free', defaultOn: true, icon: 'Hexagon',
    },

    // ── Premium (lås upp med kod / köp) ─────────────────────────────────────
    {
        id: 'moreEvents',
        name: 'Fler aktiva event',
        description: 'Skapa fler än ett aktivt event samtidigt.',
        group: 'premium', tier: 'premium', defaultOn: false, icon: 'CalendarPlus',
    },

    // ── På gång (väntelista) ────────────────────────────────────────────────
    {
        id: 'friendsRadar',
        name: 'Vänner på kartan',
        description: 'Se var dina vänner är i realtid.',
        group: 'soon', tier: 'soon', defaultOn: false, icon: 'Users',
    },
    {
        id: 'nearbyPush',
        name: 'Notiser nära dig',
        description: 'Få en notis när något händer i närheten just nu.',
        group: 'soon', tier: 'soon', defaultOn: false, icon: 'Bell',
    },
];

export const FEATURE_BY_ID: Record<string, FeatureDef> =
    Object.fromEntries(FEATURE_CATALOG.map((f) => [f.id, f]));

const STORAGE_PREFIX = 'vadkul_feature_';
export const FEATURE_CHANGE_EVENT = 'vadkul:featuretoggleschange';

/** Standardläge för en funktion (true för gratis kart-funktioner). */
export function getDefaultOn(id: string): boolean {
    return FEATURE_BY_ID[id]?.defaultOn ?? false;
}

/**
 * Synkron läsning — säker att anropa från kartkoden (client-only).
 * Faller tillbaka på katalogens defaultOn om inget sparats eller vid SSR.
 */
export function isFeatureOn(id: string): boolean {
    if (typeof window === 'undefined') return getDefaultOn(id);
    try {
        const raw = window.localStorage.getItem(STORAGE_PREFIX + id);
        if (raw === null) return getDefaultOn(id);
        return raw === '1';
    } catch {
        return getDefaultOn(id);
    }
}

/** Skriv ett värde och meddela lyssnare (samma flik) via window-event. */
export function setFeatureOn(id: string, on: boolean): void {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.setItem(STORAGE_PREFIX + id, on ? '1' : '0');
        window.dispatchEvent(new CustomEvent(FEATURE_CHANGE_EVENT, { detail: { id, on } }));
    } catch {
        /* localStorage kan vara blockerat (privatläge) — ignorera tyst. */
    }
}

/** Har användaren ett explicit sparat värde lokalt? (för Firestore-hydrering) */
export function hasLocalValue(id: string): boolean {
    if (typeof window === 'undefined') return false;
    try {
        return window.localStorage.getItem(STORAGE_PREFIX + id) !== null;
    } catch {
        return false;
    }
}

/** Läs alla toggles som ett objekt (för UI/Firestore-sync). */
export function getAllToggles(): Record<string, boolean> {
    const out: Record<string, boolean> = {};
    for (const f of FEATURE_CATALOG) out[f.id] = isFeatureOn(f.id);
    return out;
}
