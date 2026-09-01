// src/utils/mapUtils.ts
import { EVENT_CATEGORIES } from './categories';
import type { EventCategoryType } from './categories';

/**
 * Är koordinaten en giltig WGS84-punkt som Maplibre kan hantera?
 * En enda punkt med lat utanför [-90,90] (t.ex. projicerade SWEREF99/RT90-
 * koords som 6129956 från en paraply-källa) får annars `LngLatBounds.contains`
 * att kasta och kraschar HELA kartan. Vakta varje koordinat-ingång med denna.
 *
 * "Null island" (0,0 och dess närområde) räknas som ogiltig — det är vår
 * "oplacerad"-markör. Tusentals ogeokodade events hamnar där och floodar
 * annars kartan. Tröskeln |lat|<0.01 && |lng|<0.01 (~1 km kring 0,0, mitt i
 * Guineabukten) kan aldrig träffa ett riktigt svenskt event (lat ~55–69).
 * Eventen finns kvar i DB och i list-/sökvyn — de döljs bara på kartan.
 */
/**
 * Veckovyn är zoom-gatad: "ju närmare du zoomar i rummet, desto längre får du
 * zooma ut i tiden". Veckoalternativet låses upp först på stadsnivå — zoom 9 ≈
 * en stad med omnejd i mobilviewporten. Delas av page.tsx (upplåsningen +
 * zoom-vakten) och V2Map (stadsrutans auto-inzoomning till veckan, 31/8).
 */
export const WEEK_VIEW_MIN_ZOOM = 9;

/**
 * Zoom-nivån som visar ungefär `spanMeters` tvärs en yta som är `widthPx` bred,
 * vid en given latitud. MapLibre räknar zoom mot 512 px breda rutor, och en
 * longitudgrad krymper med cos(lat) — båda ligger i formeln.
 *
 * Kamerans mått anges i METER, inte i zoom-nivåer: samma zoom täcker helt
 * olika många km på mobil och desktop (zoom 11 ≈ 25 km på desktop men ≈ 8 km
 * på mobil), så en hårdkodad nivå ger två helt olika vyer.
 */
export function zoomForSpan(widthPx: number, lat: number, spanMeters: number): number {
    const EARTH_CIRCUMFERENCE_M = 40_075_016.686;
    const metersPerWorldPx = (EARTH_CIRCUMFERENCE_M * Math.cos((lat * Math.PI) / 180)) / 512;
    return Math.log2((metersPerWorldPx * widthPx) / spanMeters);
}

/**
 * Står kameran redan (i praktiken) i den vy ett stadshopp är på väg till?
 *
 * Sedan 31/8 öppnar kartan direkt i din sparade stad — och GPS-svaret strax
 * efteråt landar oftast på exakt samma ort. Utan den här kollen fyras då
 * stadshoppets frostade överlägg + stadsnamn för en förflyttning på noll meter,
 * vilket bara läser som en blink. Tröskeln ~2 km täcker "samma ortspunkt", inte
 * grannstaden.
 */
export function sameCityView(
    current: { lat: number; lng: number; zoom: number },
    target: { lat: number; lng: number; zoom: number },
): boolean {
    const dLat = Math.abs(current.lat - target.lat);
    const dLng = Math.abs(current.lng - target.lng) * Math.cos((target.lat * Math.PI) / 180);
    return dLat < 0.02 && dLng < 0.02 && Math.abs(current.zoom - target.zoom) < 0.3;
}

export function isValidLatLng(lat: unknown, lng: unknown): boolean {
    return (
        typeof lat === 'number' && typeof lng === 'number' &&
        Number.isFinite(lat) && Number.isFinite(lng) &&
        lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 &&
        !(Math.abs(lat) < 0.01 && Math.abs(lng) < 0.01)
    );
}

// --- NYA FUNKTIONER FÖR LOCAL STORAGE ---
export function saveLocationToLocalStorage(lat: number, lng: number) {
    localStorage.setItem('user_lat', lat.toString());
    localStorage.setItem('user_lng', lng.toString());
}

export function loadLocationFromLocalStorage(): { lat: number, lng: number } | null {
    const latStr = localStorage.getItem('user_lat');
    const lngStr = localStorage.getItem('user_lng');
    
    if (latStr && lngStr) {
        return {
            lat: parseFloat(latStr),
            lng: parseFloat(lngStr)
        };
    }
    return null;
}

export function getCurrentBrowserLocation(): Promise<{lat: number, lng: number}> {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error("Geolocation not supported"));
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            (err) => reject(err)
        );
    });
}
// ----------------------------------------

export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Jordens radie i km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; 
}

export const getEventEmoji = (type: string): string => {
    const category = EVENT_CATEGORIES[type as EventCategoryType];
    return category ? category.emoji : '🌟';
};

export const getEventColor = (type: string): string => {
    const category = EVENT_CATEGORIES[type as EventCategoryType];
    return category ? category.color : 'bg-slate-100 text-slate-600';
};

export const getEventLabel = (type: string): string => {
    const category = EVENT_CATEGORIES[type as EventCategoryType];
    return category ? category.label : 'Event';
};