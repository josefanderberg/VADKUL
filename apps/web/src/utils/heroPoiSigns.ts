/**
 * Platsskyltarna i stadssidornas kartbild (#267, Josef 20/11: "de badplats
 * skyltarna och museum osv" ska synas på stadssidornas karta).
 *
 * På stora kartan tänds skyltarna först vid zoom 12-13 (utils/mapPoiSigns),
 * eftersom kaklen inte bär platserna tidigare. Stadssidans karta står på zoom
 * 11, så där finns inga punkter att rita. Här hämtas de i stället ur de
 * DJUPASTE kaklen (zoom 15, där alla platser finns med) för just kartrutan och
 * läggs som en egen GeoJSON-källa med samma skyltlager som stora kartan.
 *
 * Bara RESMÅLEN får skylt (bad, museum, bibliotek, naturreservat, golf, bio,
 * teater, arena). Lekplatser, parker, planer och matställen är för många för
 * en bild över hela staden - de hör till stora kartans närmare zoomsteg.
 *
 * Körs BARA när kartbilderna renderas (scripts/render-city-maps.mjs, egna
 * kakel): ett par hundra kakel per stad är orimligt att hämta hos en besökare.
 * Skyltarna bakas alltså in i bilden. Ren modul, hämtningen skickas in.
 */
import { VectorTile } from '@mapbox/vector-tile';
import { PbfReader } from 'pbf';
import {
    addPoiSignLayers, POI_SIGN_CLOSE_KEYS, POI_SIGN_KEYS, POI_SIGN_LAYER_ID, POI_SIGN_NEAR_KEYS, POI_SIGNS,
    type PoiSignKey, type PoiSignStyle,
} from '@vadkul/kontrakt';

export const HERO_POI_SOURCE_ID = 'vadkul-hero-pois';
/** Kaklens djupaste zoom i Protomaps-bygget: där finns alla platser med. */
export const HERO_POI_TILE_ZOOM = 15;
/** Skyltens storlek i bilden. Mindre än på stora kartan (0,8-1): bilden visar
 *  hela staden och eventens brickor (32 px) ska väga tyngst. */
export const HERO_POI_ICON_SIZE = 0.6;
/** Marginal runt kartrutan (px), så en skylt vars fot står strax utanför ändå ritas. */
const MARGIN_PX = 40;

/** Skyltarna som visas i bilden: resmålen, inte kvarterets eller matställenas. */
export const HERO_POI_KEYS: readonly PoiSignKey[] = POI_SIGN_KEYS.filter(
    key => !POI_SIGN_NEAR_KEYS.includes(key) && !POI_SIGN_CLOSE_KEYS.includes(key),
);
const HERO_KINDS = new Set<string>(HERO_POI_KEYS.flatMap(key => [...POI_SIGNS[key].kinds]));

export interface TileId { z: number; x: number; y: number }

/**
 * Kaklen på `tileZoom` som täcker kartrutan. `glZoom` är MapLibres zoom
 * (världen är 512 * 2^zoom px bred), `width`/`height` rutans mått i px.
 */
export function heroPoiTiles(
    center: { lat: number; lng: number }, glZoom: number, width: number, height: number,
    tileZoom: number = HERO_POI_TILE_ZOOM,
): TileId[] {
    const n = 2 ** tileZoom;
    const cx = ((center.lng + 180) / 360) * n;
    const s = Math.sin((center.lat * Math.PI) / 180);
    const cy = (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n;
    // Ett kakel på tileZoom är så här många px brett i kartrutan.
    const tilePx = 512 * 2 ** (glZoom - tileZoom);
    const hw = (width / 2 + MARGIN_PX) / tilePx;
    const hh = (height / 2 + MARGIN_PX) / tilePx;
    const out: TileId[] = [];
    for (let y = Math.floor(cy - hh); y <= Math.floor(cy + hh); y++) {
        if (y < 0 || y >= n) continue;
        for (let x = Math.floor(cx - hw); x <= Math.floor(cx + hw); x++) {
            out.push({ z: tileZoom, x: ((x % n) + n) % n, y });
        }
    }
    return out;
}

export type HeroPoiFeature = {
    type: 'Feature';
    geometry: { type: 'Point'; coordinates: [number, number] };
    properties: { kind: string; name?: string };
};

/**
 * Resmålens punkter ur ett kakel, som GeoJSON. Punkter i kaklets marginal
 * hoppas över: de finns också i grannkaklet och skulle annars stå två gånger.
 */
export function heroPoiFeatures(bytes: Uint8Array, tile: TileId): HeroPoiFeature[] {
    if (bytes.byteLength === 0) return [];
    const layer = new VectorTile(new PbfReader(bytes)).layers.pois;
    if (!layer) return [];
    const n = 2 ** tile.z;
    const out: HeroPoiFeature[] = [];
    for (let i = 0; i < layer.length; i++) {
        const f = layer.feature(i);
        if (f.type !== 1) continue;
        const kind = String(f.properties.kind);
        if (!HERO_KINDS.has(kind)) continue;
        for (const ring of f.loadGeometry()) {
            for (const p of ring) {
                if (p.x < 0 || p.y < 0 || p.x >= layer.extent || p.y >= layer.extent) continue;
                const lng = ((tile.x + p.x / layer.extent) / n) * 360 - 180;
                const lat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * (tile.y + p.y / layer.extent)) / n))) * 180) / Math.PI;
                const name = f.properties.name;
                out.push({
                    type: 'Feature',
                    geometry: { type: 'Point', coordinates: [lng, lat] },
                    properties: typeof name === 'string' ? { kind, name } : { kind },
                });
            }
        }
    }
    return out;
}

/** Kakeladressen ur en mall med {z}/{x}/{y}, eller null om mallen saknar dem. */
export function tileUrl(template: string, t: TileId): string | null {
    if (!/\{z\}/.test(template) || !/\{x\}/.test(template) || !/\{y\}/.test(template)) return null;
    return template.replace('{z}', String(t.z)).replace('{x}', String(t.x)).replace('{y}', String(t.y));
}

/**
 * Skyltlagret för bilden: SAMMA lager som stora kartans resmål (kontraktets
 * addPoiSignLayers - bild per platstyp, fot på platsen, bad och museum först
 * vid en krock), men ur GeoJSON-källan, utan zoomgräns, utan namn och mindre.
 */
export function heroPoiSignLayer(): Record<string, unknown> {
    const style: PoiSignStyle = {
        layers: [{ id: 'mall', type: 'symbol', source: 'bas', 'source-layer': 'pois' }],
        sources: { bas: { type: 'vector' } },
    };
    addPoiSignLayers(style, { source: HERO_POI_SOURCE_ID, minZoom: 0 });
    const base = style.layers!.find(l => l.id === POI_SIGN_LAYER_ID);
    if (!base) throw new Error('kontraktet gav inget skyltlager');
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { 'source-layer': _sourceLayer, minzoom: _minzoom, ...layer } = base;
    return {
        ...layer,
        layout: { ...base.layout, 'icon-size': HERO_POI_ICON_SIZE, 'text-field': '' },
    };
}

/**
 * Hämta kartrutans resmål. `fetchTile` ger kaklets okomprimerade bytes, eller
 * null när kaklet inte finns (tomt hav).
 */
export async function loadHeroPois(
    tiles: readonly TileId[],
    fetchTile: (t: TileId) => Promise<Uint8Array | null>,
): Promise<{ type: 'FeatureCollection'; features: HeroPoiFeature[] }> {
    const per = await Promise.all(tiles.map(async t => {
        const bytes = await fetchTile(t);
        return bytes ? heroPoiFeatures(bytes, t) : [];
    }));
    return { type: 'FeatureCollection', features: per.flat() };
}
