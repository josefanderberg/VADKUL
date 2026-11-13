/**
 * Platsskyltar på kartan (#216): vägmärken (blå platta, vitt fält, svart
 * symbol - #225, symbolerna i utils/poiSignPictograms) för badplatser, museer,
 * bibliotek, naturreservat, golfbanor, lekplatser, bollplaner och parker.
 * Josef 13/11: "bollplaner, parker, lekplatser, naturreservat, bibliotek,
 * museer, golfbanor. De är ju intressanta. kan du hämta badplatser också så har
 * vi som tecknade vägskyltar som visas när man zoomar in ganska nära."
 *
 * Allt kommer ur baskartans EGNA kakel (source-layer 'pois', OpenStreetMap via
 * CARTO) - även badplatserna, så ingenting extra hämtas och ingen egen datafil
 * behöver underhållas. Kaklen bär platserna olika djupt (mätt över Växjö
 * 13/11): naturreservat och golfbanor från z11, badplatser från z13, parker
 * z13-14, museer och bibliotek z14, lekplatser först z15.
 *
 * Ren modul: bara MapLibre-TYPER. Lagret läggs i nöjesfältsstilen av
 * components/v2/v2MapBaseStyles; själva skyltbilderna ritas i webbläsaren av
 * components/v2/v2MapPoiSignImages när kartan ber om dem.
 */
import type * as maplibregl from 'maplibre-gl';
import { DEEP_NEAR_MIN_CHILD_ZOOM, DEEP_SOURCE_ID } from './deepTiles';

export const POI_SIGN_LAYER_ID = 'vadkul-poi-signs';
/** "När man zoomar in ganska nära": stadslandningen ligger på ~10,5. */
export const POI_SIGN_MIN_ZOOM = 13;
/** Härifrån står platsens namn under skylten. */
export const POI_SIGN_NAME_ZOOM = 14.5;
/**
 * ETT ZOOMSTEG TIDIGARE (#222, Josef 13/11: "så man ser mer detaljer när man
 * zoomar ut än man vanligtvis hade gjort"): finns den djupa källan (utils/
 * deepTiles) hämtas skyltarnas punkter ur kakel ett steg djupare, och då syns
 * badplatserna från zoom 12, museer och bibliotek från 13 och lekplatser från
 * 14. Kaklen är små så här nära (24-54 kB över Växjö), så det kostar lite.
 */
export const POI_SIGN_DEEP_MIN_ZOOM = DEEP_NEAR_MIN_CHILD_ZOOM - 1;
export const POI_SIGN_DEEP_NAME_ZOOM = POI_SIGN_NAME_ZOOM - 1;

export interface PoiSign {
    /** kind-värden i kaklens pois-lager. */
    kinds: readonly string[];
}

// Ordningen = företräde när två skyltar krockar: badplatsen först.
export const POI_SIGNS = {
    bad: { kinds: ['bathing_place', 'public_bath', 'beach'] },
    museum: { kinds: ['museum'] },
    bibliotek: { kinds: ['library'] },
    naturreservat: { kinds: ['nature_reserve'] },
    golf: { kinds: ['golf_course'] },
    lekplats: { kinds: ['playground'] },
    bollplan: { kinds: ['pitch'] },
    park: { kinds: ['park'] },
} as const satisfies Record<string, PoiSign>;
export type PoiSignKey = keyof typeof POI_SIGNS;

const IMAGE_PREFIX = 'vadkul-skylt-';
export function poiSignImageId(key: PoiSignKey): string {
    return IMAGE_PREFIX + key;
}
/** Skylten bakom ett bild-id, eller null om bilden inte är en av våra. */
export function poiSignKeyFromImageId(id: string): PoiSignKey | null {
    if (!id.startsWith(IMAGE_PREFIX)) return null;
    const key = id.slice(IMAGE_PREFIX.length);
    return key in POI_SIGNS ? key as PoiSignKey : null;
}

const KEYS = Object.keys(POI_SIGNS) as PoiSignKey[];

// ── Två zoomsteg (#225) ──────────────────────────────────────────────────────
// Josef 13/11: "eller brir det för stökigt med massa skyltar?" -> "ja gör så".
// Lekplatser, idrottsplaner och parker finns det tiotals av i en stad, och de
// saknar oftast namn. De får därför ett EGET lager som tänds först på
// kvartersnivå, så stadsvyn bara bär de få resmålen (bad, naturreservat, golf,
// museum, bibliotek) och eventens brickor får dominera.
export const POI_SIGN_NEAR_LAYER_ID = 'vadkul-poi-signs-near';
export const POI_SIGN_NEAR_MIN_ZOOM = 15;
export const POI_SIGN_NEAR_KEYS: readonly PoiSignKey[] = ['lekplats', 'bollplan', 'park'];
/** Båda skyltlagren - det som frågar efter skyltar (trycket) ska fråga båda. */
export const POI_SIGN_LAYER_IDS = [POI_SIGN_LAYER_ID, POI_SIGN_NEAR_LAYER_ID] as const;
const FAR_KEYS = KEYS.filter(key => !POI_SIGN_NEAR_KEYS.includes(key));
const kindsOf = (keys: readonly PoiSignKey[]) => keys.flatMap(k => [...POI_SIGNS[k].kinds]);

// ── Tryck på en skylt (#225) ─────────────────────────────────────────────────
// Josef 13/11: "det kan väl komma upp vad det är om man klickar på en skylt
// okså. gärna namnet på badplatsen eller naturreservatet. de som har namn".

/** Vad skylten står för, i klartext. */
export const POI_SIGN_LABELS: Readonly<Record<PoiSignKey, string>> = {
    bad: 'Badplats',
    museum: 'Museum',
    bibliotek: 'Bibliotek',
    naturreservat: 'Naturreservat',
    golf: 'Golfbana',
    lekplats: 'Lekplats',
    // Kaklens 'pitch' är alla slags planer, inte bara bollplaner.
    bollplan: 'Idrottsplan',
    park: 'Park',
};

/** Skylten för ett kind-värde ur kaklen, eller null om platstypen saknar skylt. */
export function poiSignKeyForKind(kind: unknown): PoiSignKey | null {
    if (typeof kind !== 'string') return null;
    return KEYS.find(key => (POI_SIGNS[key].kinds as readonly string[]).includes(kind)) ?? null;
}

export interface PoiSignInfo {
    key: PoiSignKey;
    /** "Badplats", "Naturreservat" ... */
    type: string;
    /** Platsens eget namn, null när kaklen saknar det. */
    name: string | null;
}

/** Texten som visas när man trycker på en skylt. */
export function poiSignInfo(kind: unknown, name: unknown): PoiSignInfo | null {
    const key = poiSignKeyForKind(kind);
    if (!key) return null;
    const trimmed = typeof name === 'string' ? name.trim() : '';
    return { key, type: POI_SIGN_LABELS[key], name: trimmed || null };
}

// Skyltens tryckyta kring stolpens fot, i skärmpixlar: plattan står ovanför
// foten och namnet under. Lite generös, fingrar är breda.
export const POI_SIGN_HIT = { halfWidth: 22, above: 46, below: 16 } as const;

/**
 * Vilken skylt ett tryck träffar: index för den vars platta ligger närmast
 * trycket, eller null om trycket inte ligger på någon skylt. `feet` är
 * skyltarnas fotpunkter på skärmen.
 */
export function pickPoiSignHit(
    feet: readonly { x: number; y: number }[],
    click: { x: number; y: number },
): number | null {
    let best: number | null = null;
    let bestDist = Infinity;
    feet.forEach((foot, i) => {
        const dx = click.x - foot.x;
        const dy = click.y - foot.y;
        if (Math.abs(dx) > POI_SIGN_HIT.halfWidth) return;
        if (dy < -POI_SIGN_HIT.above || dy > POI_SIGN_HIT.below) return;
        // Avståndet mäts till plattans mitt, inte till foten.
        const dist = Math.hypot(dx, dy + POI_SIGN_HIT.above / 2);
        if (dist < bestDist) { bestDist = dist; best = i; }
    });
    return best;
}

// Voyagers egna parknamn - skylten bär namnet i stället, annars står det två gånger.
const VOYAGER_PARK_LABEL_ID = 'poi_park';
const FALLBACK_FONT = ['Montserrat SemiBold', 'Open Sans Bold', 'Noto Sans Regular'];

// match-uttryck kind -> värde per skylt (samma väg som utils/mapLandcover:
// typen kräver grenar på fast position, formen valideras i testet).
function perKind<T>(value: (key: PoiSignKey, index: number) => T, fallback: T): maplibregl.ExpressionSpecification {
    const grenar = KEYS.flatMap((key, i) => [[...POI_SIGNS[key].kinds], value(key, i)]);
    return ['match', ['get', 'kind'], ...grenar, fallback] as unknown as maplibregl.ExpressionSpecification;
}

/**
 * Lägg skyltlagret i stilen. Under ortsnamnen (de vinner en krock) och därmed
 * under allt V2Map lägger till senare - eventens brickor och titlar går alltid
 * före en skylt. Hoppas över om stilen saknar platskällan.
 */
export function addPoiSigns(style: maplibregl.StyleSpecification) {
    if (!style.layers || !style.sources) return;
    if (style.layers.some(l => l.id === POI_SIGN_LAYER_ID)) return;
    const withSource = style.layers.find(l => 'source-layer' in l && l['source-layer'] === 'pois')
        ?? style.layers.find(l => 'source-layer' in l && (l['source-layer'] === 'places' || l['source-layer'] === 'water'));
    if (!withSource || !('source' in withSource) || typeof withSource.source !== 'string') return;
    if (style.sources[withSource.source]?.type !== 'vector') return;
    // Den djupa källan när den finns (läggs in av addZoomedOutLandcover före oss).
    const deep = style.sources[DEEP_SOURCE_ID]?.type === 'vector';
    const source = deep ? DEEP_SOURCE_ID : withSource.source;
    const minZoom = deep ? POI_SIGN_DEEP_MIN_ZOOM : POI_SIGN_MIN_ZOOM;
    const nameZoom = deep ? POI_SIGN_DEEP_NAME_ZOOM : POI_SIGN_NAME_ZOOM;

    const park = style.layers.find(l => l.id === VOYAGER_PARK_LABEL_ID);
    const font = park?.type === 'symbol' && Array.isArray(park.layout?.['text-font'])
        ? park.layout['text-font'] as string[]
        : FALLBACK_FONT;
    if (park?.type === 'symbol') park.layout = { ...park.layout, visibility: 'none' };

    const label: maplibregl.ExpressionSpecification = ['coalesce', ['get', 'name'], perKind(key => POI_SIGN_LABELS[key], '')];
    const signLayer = (
        id: string, keys: readonly PoiSignKey[], from: number,
        text: maplibregl.SymbolLayerSpecification['layout'] & object,
    ): maplibregl.SymbolLayerSpecification => ({
        id,
        type: 'symbol',
        source,
        'source-layer': 'pois',
        minzoom: from,
        filter: ['in', ['get', 'kind'], ['literal', kindsOf(keys)]],
        layout: {
            'icon-image': perKind(key => poiSignImageId(key), ''),
            'icon-size': ['interpolate', ['linear'], ['zoom'], Math.min(from, 15), 0.8, 16, 1],
            // Stolpens fot står på platsen.
            'icon-anchor': 'bottom',
            'symbol-sort-key': perKind((_, i) => i, KEYS.length),
            'text-font': font,
            'text-size': 11,
            'text-anchor': 'top',
            'text-offset': [0, 0.25],
            'text-max-width': 8,
            // Får namnet inte plats står skylten kvar utan det.
            'text-optional': true,
            ...text,
        },
        paint: {
            'text-color': '#12384f',
            'text-halo-color': 'rgba(255,255,255,0.92)',
            'text-halo-width': 1.4,
        },
    });
    // Platsens namn, annars platstypen ("Lekplats", "Park") - Josef 13/11:
    // "kan du inte skriva lekplats under också, eller park, för de som de inte
    // dyker upp någon text under."
    const layer = signLayer(POI_SIGN_LAYER_ID, FAR_KEYS, minZoom, {
        'text-field': ['step', ['zoom'], '', nameZoom, label],
    });
    // Kvartersnivån: texten står där direkt.
    const near = signLayer(POI_SIGN_NEAR_LAYER_ID, POI_SIGN_NEAR_KEYS, POI_SIGN_NEAR_MIN_ZOOM, { 'text-field': label });
    const firstPlace = style.layers.findIndex(l => l.type === 'symbol' && 'source-layer' in l && l['source-layer'] === 'places');
    // Det nära lagret UNDER det vanliga: symboler placeras uppifrån, så ett
    // bad eller museum vinner en krock mot en lekplats.
    style.layers.splice(firstPlace >= 0 ? firstPlace : style.layers.length, 0, near, layer);
}
