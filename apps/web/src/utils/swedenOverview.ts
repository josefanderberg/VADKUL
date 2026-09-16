/**
 * SVERIGE-ÖVERSIKTEN (Josef 16/9): "när du har rört kartan en gång eller
 * flera gånger … en rolig pop-up: vill du se en hel översiktsbild över
 * Sverige, så att du ser hur många event som verkligen finns — och sen kan
 * du klicka gå tillbaka".
 *
 * Här bor det rena: kameran som ramar in landet (Mercator-anpassad mot
 * viewporten och kromet — zoomen räknas ALLTID ur skärmen, aldrig hårdkodad,
 * samma princip som zoomForSpan i mapUtils), reglerna för när tipset får
 * erbjudas och när översikten räknas som lämnad, samt engångsflaggan.
 * Sidan (page.tsx) äger själva hoppet — det går som ett vanligt stadshopp
 * (flyToPoint med egen zoom) så reveal-ankare, frost och landningskvitto
 * följer med gratis.
 */

export interface LatLngBounds { west: number; south: number; east: number; north: number }
export interface Camera { lat: number; lng: number; zoom: number }
export interface EdgePadding { top: number; bottom: number; left: number; right: number }

/** Landmassan, i grader. Treriksröset i norr, Smygehuk i söder. */
export const SWEDEN_BOUNDS: LatLngBounds = { west: 10.9, south: 55.3, east: 24.2, north: 69.1 };

/** Kartans minZoom är 4 (V2Map map-init: under det dör WebGL i tile-mängden)
 *  — gå aldrig under. På en telefon får inte hela landet plats i den fria
 *  ytan ens där, så kameran hamnar på golvet och centreras så gott det går. */
export const OVERVIEW_MIN_ZOOM = 4;
/** Tak så en gigantisk skärm inte zoomar in till Mellansverige. */
export const OVERVIEW_MAX_ZOOM = 6;

/** Kromet som täcker kartan: topplattan resp. dagväljaren (bottom-[92px] +
 *  ~130 px). Sidokanterna är fria. Landet ramas in i ytan DÄREMELLAN. */
export const OVERVIEW_PADDING: EdgePadding = { top: 100, bottom: 230, left: 8, right: 8 };

/** Tidigast så här långt in i besöket (efter välkomstrutan) visas tipset. */
export const SWEDEN_NUDGE_DELAY_MS = 20_000;

/** Står man redan utzoomad förbi den här nivån finns inget att erbjuda —
 *  man ser redan landskapet. (Stadsnivån är ~10, "Sverige" i topplattan
 *  börjar under 8.) */
export const OVERVIEW_OFFER_MIN_ZOOM = 6.5;

/** Så här mycket måste man zooma in förbi översiktens zoom för att räknas
 *  som att ha LÄMNAT den — då försvinner Tillbaka-pillen av sig själv. */
export const OVERVIEW_LEFT_ZOOM_DELTA = 1.5;

const TILE_PX = 512;

/** Web Mercator-y i radianer (ln tan(π/4 + φ/2)); växer norrut. */
const mercY = (lat: number): number => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
const latOfMercY = (y: number): number => (Math.atan(Math.sinh(y)) * 180) / Math.PI;

/**
 * Kameran som ramar in `bounds` i den FRIA ytan av viewporten (utanför
 * paddingen), som MapLibres fitBounds — men ren matte, så sidan kan mata den
 * genom stadshopps-vägen (center + zoom) utan kart-instansen.
 *
 * Zoomen är den största som får både bredd och höjd att rymmas, klampad till
 * [OVERVIEW_MIN_ZOOM, OVERVIEW_MAX_ZOOM]. Centrum är boxens Mercator-mitt,
 * förskjuten så den hamnar mitt i den fria ytan: med mer krom i botten än i
 * toppen ligger den fria ytans mitt ovanför skärmens mitt, och kartans
 * centrum måste då ligga lika många pixlar SÖDER om boxens mitt.
 */
export function fitCamera(bounds: LatLngBounds, viewport: { width: number; height: number }, padding: EdgePadding): Camera {
    const freeW = Math.max(1, viewport.width - padding.left - padding.right);
    const freeH = Math.max(1, viewport.height - padding.top - padding.bottom);
    const fracX = (bounds.east - bounds.west) / 360;
    const yNorth = mercY(bounds.north);
    const ySouth = mercY(bounds.south);
    const fracY = (yNorth - ySouth) / (2 * Math.PI);
    const rawZoom = Math.min(Math.log2(freeW / (TILE_PX * fracX)), Math.log2(freeH / (TILE_PX * fracY)));
    const zoom = Math.min(OVERVIEW_MAX_ZOOM, Math.max(OVERVIEW_MIN_ZOOM, rawZoom));

    const worldPx = TILE_PX * Math.pow(2, zoom);
    // Den fria ytans mitt relativt skärmens mitt (px, skärm-y växer nedåt).
    const offsetX = (padding.left - padding.right) / 2;
    const offsetY = (padding.top - padding.bottom) / 2;
    // Kartcentrum = boxmitt − offset (i skärmpixlar). Mercator-y växer norrut,
    // alltså motsatt skärm-y: Δy_merc = +offsetY · 2π / worldPx.
    const lng = (bounds.west + bounds.east) / 2 - (offsetX * 360) / worldPx;
    const yCenter = (yNorth + ySouth) / 2 + (offsetY * 2 * Math.PI) / worldPx;
    return { lat: latOfMercY(yCenter), lng, zoom };
}

/** Får tipset erbjudas på den här zoomen? (Redan utzoomad → nej.) */
export const canOfferOverview = (zoom: number): boolean => zoom >= OVERVIEW_OFFER_MIN_ZOOM;

/** Har man zoomat in själv så pass att översikten är lämnad? */
export const hasLeftOverview = (zoom: number, overviewZoom: number): boolean =>
    zoom > overviewZoom + OVERVIEW_LEFT_ZOOM_DELTA;

/** Engångsflaggan: tipset visas en gång per enhet — sedan aldrig mer. */
export const SWEDEN_NUDGE_KEY = 'vadkul_sverige_tips_klar';

type FlagStore = Pick<Storage, 'getItem' | 'setItem'>;
const store = (): FlagStore | null => {
    try { return typeof window === 'undefined' ? null : window.localStorage; } catch { return null; }
};

/** Sant när tipset redan visats (eller lagringen är oåtkomlig — då hellre
 *  tyst än en pop-up varje besök i privat läge). */
export function readSwedenNudgeDone(storage: FlagStore | null = store()): boolean {
    try { return !storage || storage.getItem(SWEDEN_NUDGE_KEY) === '1'; } catch { return true; }
}

export function markSwedenNudgeDone(storage: FlagStore | null = store()): void {
    try { storage?.setItem(SWEDEN_NUDGE_KEY, '1'); } catch { /* privat läge — tipset kommer igen, inget värre */ }
}
