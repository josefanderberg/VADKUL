/**
 * SHIM (14/11 2026, #234): platsskyltarna (#216, #225) bor numera i
 * @vadkul/kontrakt (packages/kontrakt/src/poiSigns.ts) - webben och appen
 * delar vilka skyltar som finns, vad de heter, när de tänds, hur lagren ser ut
 * och vilken skylt ett tryck träffar. Där står hela bakgrunden.
 *
 * Kvar här är bara webbens eget: de djupare kaklen (#222, utils/deepTiles),
 * som kräver ett eget kakelprotokoll och därför inte finns i appen, och
 * badplatsfilens adress (#279).
 * Skyltbilderna ritas av components/v2/v2MapPoiSignImages när kartan ber om
 * dem, lagret läggs i nöjesfältsstilen av components/v2/v2MapBaseStyles.
 */
import type * as maplibregl from 'maplibre-gl';
import {
    addPoiSignLayers,
    BADPLATS_DATA_PATH,
    POI_SIGN_CLOSE_MIN_ZOOM,
    POI_SIGN_MIN_ZOOM,
    POI_SIGN_NAME_ZOOM,
    POI_SIGN_NEAR_MIN_ZOOM,
    type PoiSignStyle,
} from '@vadkul/kontrakt';
import { DEEP_NEAR_MIN_CHILD_ZOOM, DEEP_SOURCE_ID } from './deepTiles';

export {
    BAD_SIGN_LAYER_ID,
    BAD_SIGN_MIN_ZOOM,
    BAD_SIGN_SOURCE_ID,
    BADPLATS_DATA_PATH,
    pickPoiSignHit,
    POI_SIGN_CLOSE_KEYS,
    POI_SIGN_CLOSE_LAYER_ID,
    POI_SIGN_CLOSE_MIN_ZOOM,
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
 * KVARTERETS OCH GATANS SKYLTAR ETT STEG TIDIGARE (#288, ägarbeslut 24/11,
 * Josef: "allt kan flyttas 1 zoomsteg längre ut/bort. alltså så man ser
 * lekplatser och restauranger, de som är på deras zoomnivå 1 steg
 * tidigare") - Josefs svar på "sänk inte gränsen utan att fråga" i #225 och
 * #242, för webben. Lekplats/idrott/park från 14 (var 15), restaurang/kafé
 * från 15 (var 16). Går bara tack vare de djupare kaklen: källkakel z14
 * byggs ur z15-barnen, som är de första som bär lekplatser och matställen,
 * och från kartzoom 15 överzoomas samma kakel. Samma steg som appen tar i
 * lib/kartSkyltar (#251), så webb och app tänder dem på samma zoom.
 */
export const POI_SIGN_DEEP_NEAR_MIN_ZOOM = POI_SIGN_NEAR_MIN_ZOOM - 1;
export const POI_SIGN_DEEP_CLOSE_MIN_ZOOM = POI_SIGN_CLOSE_MIN_ZOOM - 1;

/**
 * Lägg skyltlagret i stilen. Under ortsnamnen (de vinner en krock) och därmed
 * under allt V2Map lägger till senare - eventens brickor och titlar går alltid
 * före en skylt. Hoppas över om stilen saknar platskällan.
 */
export function addPoiSigns(style: maplibregl.StyleSpecification, origin = badplatsOrigin()) {
    // Den djupa källan när den finns (läggs in av addZoomedOutLandcover före oss).
    const deep = style.sources?.[DEEP_SOURCE_ID]?.type === 'vector';
    // BADPLATSERNA (#279, från zoom 12 sedan #284): ur public/badplatser.json, som
    // nattkedjan bygger. Hel adress - MapLibre hämtar GeoJSON i sin worker,
    // där en relativ sökväg inte går att lösa.
    const badData = origin ? new URL(BADPLATS_DATA_PATH, origin).href : undefined;
    addPoiSignLayers(style as unknown as PoiSignStyle, deep
        ? {
            source: DEEP_SOURCE_ID, minZoom: POI_SIGN_DEEP_MIN_ZOOM, nameZoom: POI_SIGN_DEEP_NAME_ZOOM,
            nearMinZoom: POI_SIGN_DEEP_NEAR_MIN_ZOOM, closeMinZoom: POI_SIGN_DEEP_CLOSE_MIN_ZOOM, badData,
        }
        : { minZoom: POI_SIGN_MIN_ZOOM, nameZoom: POI_SIGN_NAME_ZOOM, badData });
}

/** Sidans ursprung i webbläsaren; på servern finns inget (då ritas bad ur kaklen). */
function badplatsOrigin(): string | undefined {
    return typeof window !== 'undefined' ? window.location.origin : undefined;
}
