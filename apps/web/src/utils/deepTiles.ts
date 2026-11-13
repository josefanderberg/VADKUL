/**
 * Djupare kakel i Sverige-vyn (#211): fler sjöar och skarpare marktäcke när
 * kartan är långt utzoomad. Josef 13/11: "gärna mer av skogsområde och sjöar så
 * långt utzoomat som det kan finnas med."
 *
 * Baskartans kakel har bara de största sjöarna på låg zoom (mätt 13/11: 2,4 %
 * av ett z5-kakel över Mellansverige mot 7,4 % på z6). Ett zoomsteg djupare
 * finns alltså betydligt mer - men MapLibre 6 kräver tileSize 512 för
 * vektorkällor, så det går inte att bara be om djupare kakel till samma vy.
 * Lösningen är ett eget protokoll: för kaklet z/x/y hämtas de fyra barnkaklen
 * på z+1, de lager vi vill ha plockas ut och läggs ihop till ETT kakel med
 * dubbla utsträckningen. MapLibre ser en vanlig vektorkälla.
 *
 * Sedan #222 används samma knep även närmare in (Josef 13/11: "kan vi göra det
 * med sånt som syns när man är nära inzoomad också? så man ser mer detaljer när
 * man zoomar ut än man vanligtvis hade gjort"): sjöar, älvar och skog upp till
 * kartzoom 9, och platsskyltarnas punkter från kartzoom 12. Vad som slås ihop
 * beror på barnkaklens zoom (deepLayersFor).
 *
 * Ren modul: ingen karta och inget DOM. Hämtningen skickas in, så hopslagningen
 * och adressräkningen går att testa. Protokollet registreras i
 * components/v2/v2MapBaseStyles, källan och lagren läggs in av utils/mapLandcover.
 */
import { VectorTile } from '@mapbox/vector-tile';
import { fromVectorTileJs, type VectorTileFeatureLike, type VectorTileLayerLike } from '@maplibre/vt-pbf';
import { PbfReader } from 'pbf';

export const DEEP_PROTOCOL = 'vadkuldjup';
const PREFIX = `${DEEP_PROTOCOL}://`;

/** Källan i stilen som går via protokollet. */
export const DEEP_SOURCE_ID = 'vadkul-far-deep';

const POINT = 1;
const LINE = 2;
const POLYGON = 3;
type GeomType = typeof POINT | typeof LINE | typeof POLYGON;

/** Vad som tas med ur ett lager i barnkaklen. */
export interface DeepLayerSpec {
    /** Geometrityp -> tillåtna kinds ('*' = alla). Typer som saknas tas inte med. */
    kinds: Partial<Record<GeomType, readonly string[] | '*'>>;
    /** Attribut som följer med - resten släpps. */
    props: readonly string[];
}

/** Av 'landuse' ritas bara skogen ur den djupa källan (skogens konturer, se
 *  utils/mapLandcover) - reservat, militärområden m.m. kodas aldrig om. */
export const DEEP_KINDS: Readonly<Record<string, readonly string[]>> = {
    landuse: ['forest', 'wood'],
};
/** Platstyperna med skylt (utils/mapPoiSigns - testet där låser att listorna
 *  är samma; de står här för att modulerna inte ska importera varandra i ring). */
export const DEEP_POI_KINDS = [
    'bathing_place', 'public_bath', 'beach', 'museum', 'library', 'nature_reserve',
    'golf_course', 'playground', 'pitch', 'park',
] as const;

/** Utzoomat och på mellanzoom (#211, #222): sjöar, älvar, marktäcke och skog.
 *  Resten (vägar, orter, gränser) läses aldrig. */
const FAR_LAYERS: Readonly<Record<string, DeepLayerSpec>> = {
    water: { kinds: { [POLYGON]: '*', [LINE]: ['river'] }, props: ['kind'] },
    landcover: { kinds: { [POLYGON]: '*' }, props: ['kind'] },
    landuse: { kinds: { [POLYGON]: DEEP_KINDS.landuse }, props: ['kind'] },
};
/** Inzoomat (#222): bara platsskyltarnas punkter, med namn. */
const NEAR_LAYERS: Readonly<Record<string, DeepLayerSpec>> = {
    pois: { kinds: { [POINT]: DEEP_POI_KINDS }, props: ['kind', 'name'] },
};
export const DEEP_LAYERS = Object.keys(FAR_LAYERS);
/** Barnkakel t.o.m. den här zoomen ger sjöar/skog, från DEEP_NEAR_MIN_CHILD_ZOOM
 *  ger de skyltar. Däremellan använder inget lager källan (inga hämtningar). */
export const DEEP_FAR_MAX_CHILD_ZOOM = 9;
export const DEEP_NEAR_MIN_CHILD_ZOOM = 13;

/** Vilka lager som slås ihop för barnkakel på en viss zoom. */
export function deepLayersFor(childZoom: number): Readonly<Record<string, DeepLayerSpec>> {
    if (childZoom <= DEEP_FAR_MAX_CHILD_ZOOM) return FAR_LAYERS;
    if (childZoom >= DEEP_NEAR_MIN_CHILD_ZOOM) return NEAR_LAYERS;
    return {};
}

/** Ett barnkakel täcker en fjärdedel: halva utsträckningen per ledd. */
const CHILD_SPAN = 4096;
export const DEEP_EXTENT = CHILD_SPAN * 2;

/** Kakelmallen för den djupa källan: baskartans egen mall bakom vårt protokoll. */
export function deepTileTemplate(baseTemplate: string): string {
    return PREFIX + baseTemplate;
}

export interface ChildTile {
    url: string;
    /** Barnkaklets zoom. */
    z: number;
    /** Barnets plats i föräldern: 0 = väst/nord, 1 = öst/syd. */
    dx: 0 | 1;
    dy: 0 | 1;
}

/**
 * De fyra barnkaklens adresser för ett kakel i den djupa källan, eller null om
 * adressen inte går att tolka. Adressen är baskartans egen kakeladress bakom
 * protokollet: "vadkuldjup://https://.../{z}/{x}/{y}.mvt".
 */
export function childTileUrls(deepUrl: string): ChildTile[] | null {
    if (!deepUrl.startsWith(PREFIX)) return null;
    const m = deepUrl.slice(PREFIX.length).match(/^(.*\/)(\d+)\/(\d+)\/(\d+)(\.[a-z0-9]+)?(\?.*)?$/i);
    if (!m) return null;
    const [, head, zs, xs, ys, ext = '', query = ''] = m;
    const z = Number(zs) + 1;
    const x = Number(xs) * 2;
    const y = Number(ys) * 2;
    const out: ChildTile[] = [];
    for (const dy of [0, 1] as const) {
        for (const dx of [0, 1] as const) {
            out.push({ url: `${head}${z}/${x + dx}/${y + dy}${ext}${query}`, z, dx, dy });
        }
    }
    return out;
}

export interface ChildData {
    /** Barnkaklets okomprimerade pbf, eller null när kaklet inte finns (tomt hav). */
    data: ArrayBuffer | Uint8Array | null;
    dx: 0 | 1;
    dy: 0 | 1;
}

type Ring = ReturnType<VectorTileFeatureLike['loadGeometry']>[number];

function layerOf(name: string, features: VectorTileFeatureLike[]): VectorTileLayerLike {
    return {
        version: 2,
        name,
        extent: DEEP_EXTENT,
        length: features.length,
        feature: (i: number) => features[i],
    };
}

/**
 * Slå ihop barnkaklens geometri till ett kakel med utsträckningen DEEP_EXTENT.
 * `layers` styr vad som tas med (deepLayersFor). Ytor och linjer som korsar
 * gränsen mellan två barn finns i båda, klippta med kaklens egen marginal, och
 * överlappar därför sömlöst. Punkter tas bara från barnets egen ruta - en punkt
 * i marginalen finns också i grannbarnet och skulle annars stå två gånger.
 */
export function mergeChildTiles(
    children: readonly ChildData[],
    layers: Readonly<Record<string, DeepLayerSpec>> = FAR_LAYERS,
): Uint8Array {
    const names = Object.keys(layers);
    const perLayer = new Map<string, VectorTileFeatureLike[]>(names.map(n => [n, []]));
    for (const child of children) {
        if (!child.data || child.data.byteLength === 0) continue;
        const bytes = child.data instanceof Uint8Array ? child.data : new Uint8Array(child.data);
        const tile = new VectorTile(new PbfReader(bytes));
        for (const name of names) {
            const layer = tile.layers[name];
            if (!layer) continue;
            const spec = layers[name];
            const k = CHILD_SPAN / layer.extent;
            const ox = child.dx * CHILD_SPAN;
            const oy = child.dy * CHILD_SPAN;
            const out = perLayer.get(name)!;
            for (let i = 0; i < layer.length; i++) {
                const f = layer.feature(i);
                const type = f.type as GeomType;
                const allowed = spec.kinds[type];
                if (!allowed) continue;
                if (allowed !== '*' && !allowed.includes(String(f.properties.kind))) continue;
                let geometry = f.loadGeometry();
                if (type === POINT) {
                    geometry = geometry
                        .map(ring => ring.filter(p => p.x >= 0 && p.y >= 0 && p.x < layer.extent && p.y < layer.extent))
                        .filter(ring => ring.length > 0);
                    if (geometry.length === 0) continue;
                }
                const rings = geometry.map(ring =>
                    ring.map(p => ({ x: Math.round(p.x * k) + ox, y: Math.round(p.y * k) + oy })) as unknown as Ring);
                const properties: Record<string, string | number | boolean> = {};
                for (const key of spec.props) {
                    const v = f.properties[key];
                    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') properties[key] = v;
                }
                out.push({ type, id: undefined, extent: DEEP_EXTENT, properties, loadGeometry: () => rings });
            }
        }
    }
    const merged: Record<string, VectorTileLayerLike> = {};
    for (const [name, features] of perLayer) {
        if (features.length > 0) merged[name] = layerOf(name, features);
    }
    return fromVectorTileJs({ layers: merged });
}

/** Fel i samma form som MapLibres AJAXError, så omförsöken för kakel som inte
 *  gick att hämta (#207, v2MapEngineHeal) känner igen dem. Status 0 = nätfel. */
export function deepTileError(status: number, text: string, url: string): Error {
    const err = new Error(`AJAXError: ${text} (${status}): ${url}`) as Error & { status: number; url: string };
    err.status = status;
    err.url = url;
    return err;
}

/** Hämtar ett barnkakel: svaret, eller ett kastat nätfel. */
export type TileFetch = (url: string, signal?: AbortSignal) => Promise<{
    ok: boolean;
    status: number;
    statusText: string;
    arrayBuffer(): Promise<ArrayBuffer>;
}>;

/**
 * Ett kakel i den djupa källan: hämta de fyra barnen samtidigt och slå ihop
 * dem. Ett barn som inte finns (404/204) är en tom fjärdedel. Faller ett barn
 * på nätet eller servern kastas hela kaklet, så det försöks igen i sin helhet
 * i stället för att visas med ett hål.
 */
export async function loadDeepTile(deepUrl: string, fetchTile: TileFetch, signal?: AbortSignal): Promise<Uint8Array> {
    const children = childTileUrls(deepUrl);
    if (!children) throw new Error(`Okänd adress för djupt kakel: ${deepUrl}`);
    const parts = await Promise.all(children.map(async ({ url, dx, dy }): Promise<ChildData> => {
        let res: Awaited<ReturnType<TileFetch>>;
        try {
            res = await fetchTile(url, signal);
        } catch (e) {
            // Avbruten hämtning (kaklet lämnade vyn) är inget fel att försöka om.
            if (e instanceof Error && e.name === 'AbortError') throw e;
            throw deepTileError(0, e instanceof Error ? e.message : 'nätfel', url);
        }
        if (res.status === 404 || res.status === 204) return { data: null, dx, dy };
        if (!res.ok) throw deepTileError(res.status, res.statusText, url);
        return { data: await res.arrayBuffer(), dx, dy };
    }));
    return mergeChildTiles(parts, deepLayersFor(children[0].z));
}
