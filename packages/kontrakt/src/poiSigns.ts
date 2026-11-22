/**
 * Platsskyltar på kartan (#216): vägmärken (blå platta, vitt fält, svart
 * symbol - #225) för badplatser, museer, bibliotek, naturreservat, golfbanor,
 * lekplatser, bollplaner och parker.
 * Josef 13/11: "bollplaner, parker, lekplatser, naturreservat, bibliotek,
 * museer, golfbanor. De är ju intressanta. kan du hämta badplatser också så har
 * vi som tecknade vägskyltar som visas när man zoomar in ganska nära."
 *
 * DELAS AV WEBBEN OCH APPEN sedan 14/11 2026 (#234, Josef: apparna ska bli som
 * webben, "med moln och skyltar för badplats osv"): vilka skyltar som finns,
 * vad de heter, när de tänds, hur lagren ser ut och vilken skylt ett tryck
 * träffar bor här. Webben når modulen via shimmen apps/web/src/utils/
 * mapPoiSigns.ts (som lägger till de djupare kaklen, #222), appen via
 * vadkul-app/src/lib/kartSkyltar.ts. Skyltbilderna ritas av webbens
 * components/v2/v2MapPoiSignImages och bakas till PNG för appen
 * (vadkul-app/scripts/baka-skyltar.mjs).
 *
 * AKTIVITETSSTÄLLEN (#231, Josef 14/11: "hade vi kunna hämta alla restauranger
 * och sådana aktivitetställen också? alltså så att man lätt hade kunnat se som
 * sådana skyltar"): bio, teater, arena och idrottsanläggning är första steget.
 * Mätt 14/11 i z15-kaklen: hela Växjö har 2 biografer, 2 teatrar, 4 arenor och
 * 11 idrottsanläggningar, centrala Göteborg 7, 27, 4 och 41. Bio och teater
 * finns bara i z15-kaklen. Restaurangerna (112 i Växjö, 1356 i centrala
 * Göteborg) fick först inga skyltar - se MATSTÄLLENA nedan.
 *
 * MATSTÄLLENA (#242, Josef 15/11 på frågan om restauranger och kaféer ska ut
 * nu med vanliga vägmärket från zoom 16: "Ja, lägg ut dem"): restauranger och
 * kaféer i ett TREDJE, ännu närmare lager. Loggorna och boosten ("vi kan hämta
 * loggan åt dem. men de kan ju köpa boost för att bli större eller synas
 * tidigare", #232) ersätter sedan skylten.
 *
 * Allt kommer ur baskartans EGNA kakel (source-layer 'pois', OpenStreetMap via
 * CARTO) - utom badplatserna sedan #279 (22/11 2026), som har en egen liten
 * fil så de kan tändas från zoom 9 (se BAD_SIGN_* nedan). Kaklen bär platserna olika djupt (mätt över Växjö
 * 13/11): naturreservat och golfbanor från z11, badplatser från z13, parker
 * z13-14, museer och bibliotek z14, lekplatser först z15.
 *
 * Ren modul: stilen beskrivs strukturellt, inget kartbibliotek importeras.
 */

export const POI_SIGN_LAYER_ID = 'vadkul-poi-signs';
/** "När man zoomar in ganska nära": stadslandningen ligger på ~10,5. */
export const POI_SIGN_MIN_ZOOM = 13;
/** Härifrån står platsens namn under skylten. */
export const POI_SIGN_NAME_ZOOM = 14.5;

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
    // Aktivitetsställen (#231).
    bio: { kinds: ['cinema'] },
    teater: { kinds: ['theatre'] },
    arena: { kinds: ['stadium'] },
    // Kaklens 'sports_centre' är allt från ishallar och simhallar till
    // judoklubbar och idrottsplatser - därav det breda namnet.
    idrott: { kinds: ['sports_centre', 'sports_hall', 'ice_rink'] },
    lekplats: { kinds: ['playground'] },
    bollplan: { kinds: ['pitch'] },
    park: { kinds: ['park'] },
    // Matställen (#242), sist: allt annat vinner en krock mot dem. Snabbmaten
    // (pizzerior, hamburgerkedjor) bär restaurangskylten.
    restaurang: { kinds: ['restaurant', 'fast_food'] },
    kafe: { kinds: ['cafe'] },
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

/** Alla skyltar, i företrädesordning. */
export const POI_SIGN_KEYS = Object.keys(POI_SIGNS) as PoiSignKey[];
const KEYS = POI_SIGN_KEYS;

// ── Två zoomsteg (#225) ──────────────────────────────────────────────────────
// Josef 13/11: "eller brir det för stökigt med massa skyltar?" -> "ja gör så".
// Lekplatser, idrottsplaner och parker finns det tiotals av i en stad, och de
// saknar oftast namn. De får därför ett EGET lager som tänds först på
// kvartersnivå, så stadsvyn bara bär de få resmålen (bad, naturreservat, golf,
// museum, bibliotek) och eventens brickor får dominera.
// IDROTTSANLÄGGNINGARNA hör också hit (#231, Josef 14/11 på frågan om de ska
// ligga i det nära lagret som lekplatserna: "Ja, nära lagret") - 41 stycken i
// centrala Göteborg. Bio, teater och arena är resmål och ligger i det vanliga.
export const POI_SIGN_NEAR_LAYER_ID = 'vadkul-poi-signs-near';
export const POI_SIGN_NEAR_MIN_ZOOM = 15;
export const POI_SIGN_NEAR_KEYS: readonly PoiSignKey[] = ['idrott', 'lekplats', 'bollplan', 'park'];
// ── Tredje zoomsteget: matställena (#242) ───────────────────────────────────
// Restauranger och kaféer är så många (mätt 14/11: 104 i hela Växjö, 1217 i
// centrala Göteborg) att de får ett eget lager som tänds först på gatunivå.
// Sänk inte gränsen utan att fråga - en boostad skylt ska kunna synas
// tidigare än de andra (#232), och det bygger på att de vanliga syns sent.
export const POI_SIGN_CLOSE_LAYER_ID = 'vadkul-poi-signs-close';
export const POI_SIGN_CLOSE_MIN_ZOOM = 16;
export const POI_SIGN_CLOSE_KEYS: readonly PoiSignKey[] = ['restaurang', 'kafe'];
// ── Badplatserna ur egen fil, från zoom 9 (#279) ──────────────────────────────
// Josef 22/11: "badplatser syns bara när man zoomar in jättemycket. Fixa så det
// är mycket högre upp synligt." Kaklen bär badplatserna först från z13 (de
// djupare kaklen räcker till zoom 11-12), så badplatserna har en EGEN liten
// GeoJSON-fil (apps/web/public/badplatser.json, byggd av nattkedjan ur OSM med
// kaklens kind/name) och ett eget lager som tänds från BAD_SIGN_MIN_ZOOM. När
// filen används äger den badplatserna på ALLA zoomar: resmålens kakellager
// slutar bära bad, annars står två skyltar på samma bad. Josef valde zoom 9.
export const BAD_SIGN_LAYER_ID = 'vadkul-poi-signs-bad';
export const BAD_SIGN_SOURCE_ID = 'vadkul-badplatser';
export const BAD_SIGN_MIN_ZOOM = 9;
/** Filens sökväg på vadkul.se (webbens public/). */
export const BADPLATS_DATA_PATH = '/badplatser.json';

/** Alla skyltlagren - det som frågar efter skyltar (trycket) ska fråga alla. */
export const POI_SIGN_LAYER_IDS = [BAD_SIGN_LAYER_ID, POI_SIGN_LAYER_ID, POI_SIGN_NEAR_LAYER_ID, POI_SIGN_CLOSE_LAYER_ID] as const;
const FAR_KEYS = KEYS.filter(key => !POI_SIGN_NEAR_KEYS.includes(key) && !POI_SIGN_CLOSE_KEYS.includes(key));
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
    bio: 'Bio',
    teater: 'Teater',
    arena: 'Arena',
    idrott: 'Idrottsanläggning',
    lekplats: 'Lekplats',
    // Kaklens 'pitch' är alla slags planer, inte bara bollplaner.
    bollplan: 'Idrottsplan',
    park: 'Park',
    restaurang: 'Restaurang',
    kafe: 'Kafé',
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

// ── Lagren i stilen ──────────────────────────────────────────────────────────

/** Strukturellt minimum av en MapLibre-stil - bara det skyltlagren rör. */
export interface PoiSignStyleLayer {
    id: string;
    type?: string;
    source?: unknown;
    'source-layer'?: unknown;
    layout?: Record<string, unknown>;
    [key: string]: unknown;
}
export interface PoiSignStyle {
    layers?: PoiSignStyleLayer[];
    sources?: Record<string, { type?: string; [key: string]: unknown } | undefined>;
}

export interface PoiSignLayerOptions {
    /**
     * Källan skyltarnas punkter läses ur. Utelämnad = baskartans egen
     * (webben pekar på sin djupa källa när den finns, #222).
     */
    source?: string;
    /** Startzoom för resmålens lager. */
    minZoom?: number;
    /** Härifrån står namnet under resmålens skyltar. */
    nameZoom?: number;
    /**
     * Startzoom för kvarterets lager (idrott, lekplats, plan, park) och för
     * matställenas (restaurang, kafé). Utelämnade = POI_SIGN_NEAR_MIN_ZOOM och
     * POI_SIGN_CLOSE_MIN_ZOOM. Appen tänder dem ett steg tidigare (#251, Josef
     * 15/11: "blir bättre så på en mobil").
     */
    nearMinZoom?: number;
    closeMinZoom?: number;
    /**
     * Badplatsfilens adress (#279). Satt = badplatserna ritas ur filen från
     * BAD_SIGN_MIN_ZOOM och kakellagret slutar bära dem. Utelämnad = bad ur
     * kaklen som förut. Måste vara en hel adress (https://...): webbens
     * MapLibre hämtar GeoJSON i en worker och appens i native-koden.
     */
    badData?: string;
    /** Startzoom för badlagret ur filen. Utelämnad = BAD_SIGN_MIN_ZOOM. */
    badMinZoom?: number;
    /**
     * Faktor på skyltens storlek. Webben ritar bilden med egen pixeltäthet
     * (1); appen bakar den i högre upplösning och skalar ner lika mycket.
     */
    iconScale?: number;
}

// Voyagers egna parknamn - skylten bär namnet i stället, annars står det två gånger.
const VOYAGER_PARK_LABEL_ID = 'poi_park';
const FALLBACK_FONT = ['Montserrat SemiBold', 'Open Sans Bold', 'Noto Sans Regular'];

// match-uttryck kind -> värde per skylt. Formen valideras mot MapLibres
// stilspec i webbens test (apps/web/src/utils/mapPoiSigns.test.ts).
function perKind<T>(value: (key: PoiSignKey, index: number) => T, fallback: T): unknown[] {
    const grenar = KEYS.flatMap((key, i) => [[...POI_SIGNS[key].kinds], value(key, i)]);
    return ['match', ['get', 'kind'], ...grenar, fallback];
}

/**
 * Lägg skyltlagren i stilen (muterar den). Under ortsnamnen (de vinner en
 * krock) och därmed under allt kartan lägger till senare - eventens brickor
 * och titlar går alltid före en skylt. Hoppas över om stilen saknar
 * platskällan. Returnerar true när lagren lades till.
 */
export function addPoiSignLayers(style: PoiSignStyle, options: PoiSignLayerOptions = {}): boolean {
    if (!style.layers || !style.sources) return false;
    if (style.layers.some(l => l.id === POI_SIGN_LAYER_ID)) return false;
    const withSource = style.layers.find(l => l['source-layer'] === 'pois')
        ?? style.layers.find(l => l['source-layer'] === 'places' || l['source-layer'] === 'water');
    if (!withSource || typeof withSource.source !== 'string') return false;
    if (style.sources[withSource.source]?.type !== 'vector') return false;
    const source = options.source ?? withSource.source;
    const minZoom = options.minZoom ?? POI_SIGN_MIN_ZOOM;
    const nameZoom = options.nameZoom ?? POI_SIGN_NAME_ZOOM;
    const nearMinZoom = options.nearMinZoom ?? POI_SIGN_NEAR_MIN_ZOOM;
    const closeMinZoom = options.closeMinZoom ?? POI_SIGN_CLOSE_MIN_ZOOM;
    const scale = options.iconScale ?? 1;

    const park = style.layers.find(l => l.id === VOYAGER_PARK_LABEL_ID);
    const parkFont = park?.type === 'symbol' ? park.layout?.['text-font'] : undefined;
    const font = Array.isArray(parkFont) ? parkFont as string[] : FALLBACK_FONT;
    if (park?.type === 'symbol') park.layout = { ...park.layout, visibility: 'none' };

    const badFromFile = typeof options.badData === 'string' && options.badData.length > 0;
    const badMinZoom = options.badMinZoom ?? BAD_SIGN_MIN_ZOOM;

    const label = ['coalesce', ['get', 'name'], perKind(key => POI_SIGN_LABELS[key], '')];
    const signLayer = (
        id: string, keys: readonly PoiSignKey[], from: number, text: Record<string, unknown>,
        fromFile = false,
    ): PoiSignStyleLayer => ({
        id,
        type: 'symbol',
        ...(fromFile ? { source: BAD_SIGN_SOURCE_ID } : { source, 'source-layer': 'pois' }),
        minzoom: from,
        // match, inte in-uttrycket: MapLibre Native (appen) avgör på operatorn
        // om ett filter är ett uttryck, och en lista som börjar med "in" kan
        // där läsas som ett filter i det äldre formatet. match är alltid ett
        // uttryck, och ger samma urval.
        filter: ['match', ['get', 'kind'], kindsOf(keys), true, false],
        layout: {
            'icon-image': perKind(key => poiSignImageId(key), ''),
            // Långt ute (badlagret från zoom 9) är skylten mindre, så en
            // region full av bad inte blir en matta av skyltar.
            'icon-size': from < 12
                ? ['interpolate', ['linear'], ['zoom'], from, 0.6 * scale, 13, 0.8 * scale, 16, scale]
                : ['interpolate', ['linear'], ['zoom'], Math.min(from, 15), 0.8 * scale, 16, scale],
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
    const farText = { 'text-field': ['step', ['zoom'], '', nameZoom, label] };
    const layer = signLayer(POI_SIGN_LAYER_ID, badFromFile ? FAR_KEYS.filter(k => k !== 'bad') : FAR_KEYS, minZoom, farText);
    // Badplatserna ur filen (#279), samma skylt och namnregel som resmålen.
    const bad = badFromFile ? signLayer(BAD_SIGN_LAYER_ID, ['bad'], badMinZoom, farText, true) : null;
    // Kvartersnivån: texten står där direkt.
    const near = signLayer(POI_SIGN_NEAR_LAYER_ID, POI_SIGN_NEAR_KEYS, nearMinZoom, { 'text-field': label });
    // Gatunivån (#242): matställena, också med texten direkt.
    const close = signLayer(POI_SIGN_CLOSE_LAYER_ID, POI_SIGN_CLOSE_KEYS, closeMinZoom, { 'text-field': label });
    const firstPlace = style.layers.findIndex(l => l.type === 'symbol' && l['source-layer'] === 'places');
    // Det nära lagret UNDER det vanliga, och matställena underst: symboler
    // placeras uppifrån, så ett bad eller museum vinner en krock mot en
    // lekplats, och lekplatsen mot en restaurang.
    // Badlagret överst: badplatsen har alltid gått först (POI_SIGNS-ordningen).
    if (bad) style.sources[BAD_SIGN_SOURCE_ID] = { type: 'geojson', data: options.badData };
    style.layers.splice(firstPlace >= 0 ? firstPlace : style.layers.length, 0, close, near, layer, ...(bad ? [bad] : []));
    return true;
}
