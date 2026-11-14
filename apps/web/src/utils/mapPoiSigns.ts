/**
 * SHIM (14/11 2026, #234): platsskyltarna (#216, #225) bor numera i
 * @vadkul/kontrakt (packages/kontrakt/src/poiSigns.ts) - webben och appen
 * delar vilka skyltar som finns, vad de heter, när de tänds, hur lagren ser ut
 * och vilken skylt ett tryck träffar. Där står hela bakgrunden.
 *
 * Kvar här är bara webbens eget: de djupare kaklen (#222, utils/deepTiles),
 * som kräver ett eget kakelprotokoll och därför inte finns i appen.
 * Skyltbilderna ritas av components/v2/v2MapPoiSignImages när kartan ber om
 * dem, lagret läggs i nöjesfältsstilen av components/v2/v2MapBaseStyles.
 */
import type * as maplibregl from 'maplibre-gl';
import { addPoiSignLayers, POI_SIGN_MIN_ZOOM, POI_SIGN_NAME_ZOOM, type PoiSignStyle } from '@vadkul/kontrakt';
import { DEEP_NEAR_MIN_CHILD_ZOOM, DEEP_SOURCE_ID } from './deepTiles';

export {
    pickPoiSignHit,
    POI_SIGN_HIT,
    POI_SIGN_LABELS,
    POI_SIGN_LAYER_ID,
    POI_SIGN_LAYER_IDS,
    POI_SIGN_MIN_ZOOM,
    POI_SIGN_NAME_ZOOM,
    POI_SIGN_NEAR_KEYS,
    POI_SIGN_NEAR_LAYER_ID,
    POI_SIGN_NEAR_MIN_ZOOM,
    POI_SIGNS,
    poiSignImageId,
    poiSignInfo,
    poiSignKeyForKind,
    poiSignKeyFromImageId,
    type PoiSign,
    type PoiSignInfo,
    type PoiSignKey,
} from '@vadkul/kontrakt';

/**
 * ETT ZOOMSTEG TIDIGARE (#222, Josef 13/11: "så man ser mer detaljer när man
 * zoomar ut än man vanligtvis hade gjort"): finns den djupa källan (utils/
 * deepTiles) hämtas skyltarnas punkter ur kakel ett steg djupare, och då syns
 * badplatserna från zoom 12, museer och bibliotek från 13 och lekplatser från
 * 14. Kaklen är små så här nära (24-54 kB över Växjö), så det kostar lite.
 */
export const POI_SIGN_DEEP_MIN_ZOOM = DEEP_NEAR_MIN_CHILD_ZOOM - 1;
export const POI_SIGN_DEEP_NAME_ZOOM = POI_SIGN_NAME_ZOOM - 1;

/**
 * Lägg skyltlagret i stilen. Under ortsnamnen (de vinner en krock) och därmed
 * under allt V2Map lägger till senare - eventens brickor och titlar går alltid
 * före en skylt. Hoppas över om stilen saknar platskällan.
 */
export function addPoiSigns(style: maplibregl.StyleSpecification) {
    // Den djupa källan när den finns (läggs in av addZoomedOutLandcover före oss).
    const deep = style.sources?.[DEEP_SOURCE_ID]?.type === 'vector';
    addPoiSignLayers(style as unknown as PoiSignStyle, deep
        ? { source: DEEP_SOURCE_ID, minZoom: POI_SIGN_DEEP_MIN_ZOOM, nameZoom: POI_SIGN_DEEP_NAME_ZOOM }
        : { minZoom: POI_SIGN_MIN_ZOOM, nameZoom: POI_SIGN_NAME_ZOOM });
}
