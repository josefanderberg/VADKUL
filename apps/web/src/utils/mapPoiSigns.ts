/**
 * Platsskyltar på kartan (#216): tecknade vägskyltar för badplatser, museer,
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

export const POI_SIGN_LAYER_ID = 'vadkul-poi-signs';
/** "När man zoomar in ganska nära": stadslandningen ligger på ~10,5. */
export const POI_SIGN_MIN_ZOOM = 13;
/** Härifrån står platsens namn under skylten. */
export const POI_SIGN_NAME_ZOOM = 14.5;

export interface PoiSign {
    /** kind-värden i kaklens pois-lager. */
    kinds: readonly string[];
    /** Tecknet på skylten. Bara emojier som finns på äldre telefoner. */
    emoji: string;
}

// Ordningen = företräde när två skyltar krockar: badplatsen först.
export const POI_SIGNS = {
    bad: { kinds: ['bathing_place', 'public_bath', 'beach'], emoji: '🏊' },
    museum: { kinds: ['museum'], emoji: '🏛️' },
    bibliotek: { kinds: ['library'], emoji: '📚' },
    naturreservat: { kinds: ['nature_reserve'], emoji: '🌲' },
    golf: { kinds: ['golf_course'], emoji: '⛳' },
    lekplats: { kinds: ['playground'], emoji: '🎠' },
    bollplan: { kinds: ['pitch'], emoji: '⚽' },
    park: { kinds: ['park'], emoji: '🌳' },
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
    const source = withSource.source;
    if (style.sources[source]?.type !== 'vector') return;

    const park = style.layers.find(l => l.id === VOYAGER_PARK_LABEL_ID);
    const font = park?.type === 'symbol' && Array.isArray(park.layout?.['text-font'])
        ? park.layout['text-font'] as string[]
        : FALLBACK_FONT;
    if (park?.type === 'symbol') park.layout = { ...park.layout, visibility: 'none' };

    const layer: maplibregl.SymbolLayerSpecification = {
        id: POI_SIGN_LAYER_ID,
        type: 'symbol',
        source,
        'source-layer': 'pois',
        minzoom: POI_SIGN_MIN_ZOOM,
        filter: ['in', ['get', 'kind'], ['literal', KEYS.flatMap(k => [...POI_SIGNS[k].kinds])]],
        layout: {
            'icon-image': perKind(key => poiSignImageId(key), ''),
            'icon-size': ['interpolate', ['linear'], ['zoom'], POI_SIGN_MIN_ZOOM, 0.8, 16, 1],
            // Stolpens fot står på platsen.
            'icon-anchor': 'bottom',
            'symbol-sort-key': perKind((_, i) => i, KEYS.length),
            'text-field': ['step', ['zoom'], '', POI_SIGN_NAME_ZOOM, ['coalesce', ['get', 'name'], '']],
            'text-font': font,
            'text-size': 11,
            'text-anchor': 'top',
            'text-offset': [0, 0.25],
            'text-max-width': 8,
            // Får namnet inte plats står skylten kvar utan det.
            'text-optional': true,
        },
        paint: {
            'text-color': '#12384f',
            'text-halo-color': 'rgba(255,255,255,0.92)',
            'text-halo-width': 1.4,
        },
    };
    const firstPlace = style.layers.findIndex(l => l.type === 'symbol' && 'source-layer' in l && l['source-layer'] === 'places');
    style.layers.splice(firstPlace >= 0 ? firstPlace : style.layers.length, 0, layer);
}
