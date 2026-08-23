import Link from 'next/link';
import { dayKey, clockLabel, hourOf, type City, type CityEvent } from './cityData';
import { EVENT_CATEGORIES, type EventCategoryType } from '@/utils/categories';
import { sourceGradientCss, BRICKA_DARK_BG } from '@/components/v2/v2MapBricka';
import CityMapHeroCanvas, { type HeroLiveEvent } from './CityMapHeroCanvas';
import { mapHref, DAYS_LISTED } from './EventList';

// Kart-heron överst på stads-/kategorisidorna: en äkta, inzoomad kartbit över
// staden med riktiga VADKUL-brickor på riktiga event-positioner. Sedan 24/8
// PASSIV men klickbar (CityMapHeroCanvas): inga kartgester — klick på
// kartbotten öppnar stora kartan över staden — men dagchipsen delar filter
// med daglistan och brick-klick leder till eventet i listan på samma sida.
// CTA-pillen längst ner är kvar som den tydliga länken till stora kartan
// (?plats=lat,lng,zoom — läses i V2Maps init). Poängen är densamma: sidorna
// ska kännas som sajten (kartan ÄR produkten), inte som ett textindex.
//
// Tre lager kartbotten, i den ordningen:
//   1. Serverrenderade kakelbilder — Cartos raster-Voyager (samma kartografi
//      som kartans vektor-Voyager, ingen API-nyckel) som vanliga <img>. Finns
//      i HTML:en, kräver noll JS — men är numera RESERVVÄG, inte förstabild.
//   2. CityMapHeroCanvas täcker kaklen med en platta i kartans landfärg redan
//      från server-HTML:en (Voyagers grå-beige såg ut som "en annan produkt"
//      den sekund den syntes) och släpper fram dem bara om GL fallerar.
//   3. Samma komponents riktiga, passiva MapLibre-karta i huvudkartans
//      "nöjesfälts"-stil tonas in ovanpå när den laddat.
// Brickorna ligger överst och är absolut positionerade <span> vars offset
// räknas ut vid BUILD med samma webbmercator som kartan.

const TILE = 256;
/** Kakel-zoom (256 px-kakel) för förhandsvisningen. 12 ≈ hela stadskärnan med
 *  igenkännbara gator/kvarter i en ~670 px bred hero. */
const HERO_ZOOM = 12;
/** Samma skala uttryckt som MapLibre-zoom. MapLibres värld är 512·2^zoom px
 *  bred medan kakelrutnätet ovan är 256·2^HERO_ZOOM — samma upplösning kräver
 *  därför ett snäpp lägre siffra. Går den isär hamnar brickorna (som räknas i
 *  kakel-zoom) dubbelt så långt ut som kartbilden under dem. */
const HERO_GL_ZOOM = HERO_ZOOM - 1;
/** Halva hero-ytan i px som brickor får placeras inom. Bredden är fluid
 *  (max ~672 px innehållsbredd) — 320/140 håller brickorna synliga även på
 *  desktop utan att mobilen känns tom (overflow klipps ändå av kartytan).
 *  140 följer den högre heron (h-72/h-80 sedan 18/8, var h-52/h-60). */
const HALF_W = 320;
const HALF_H = 140;
/** Max antal brickor + minsta inbördes avstånd (px) — kartan ska kännas
 *  levande, inte igenkorkad. */
const MAX_BRICKS = 14;
const MIN_DIST = 44;

/** Webbmercator: världs-pixel vid given zoom (samma projektion som MapLibre). */
function worldPx(lat: number, lng: number, zoom: number) {
    const scale = TILE * 2 ** zoom;
    const x = ((lng + 180) / 360) * scale;
    const s = Math.sin((lat * Math.PI) / 180);
    const y = (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * scale;
    return { x, y };
}

/** Länken hero:n (och stadssidornas kart-CTA:er) öppnar: kartan centrerad på
 *  staden i EXAKT heron's skala, så klicket känns som att man zoomar in i
 *  bilden man tittade på. Man ser ändå mer omland än i förhandsbilden — kartan
 *  fyller hela skärmen medan heron bara är ~630×238 px. (?plats-zoomen går
 *  rakt in i MapLibre → HERO_GL_ZOOM, inte kakel-zoomen.) */
export function cityMapHref(city: City): string {
    return `/?plats=${city.lat},${city.lng},${HERO_GL_ZOOM}`;
}

/** Brick-bakgrund ur kategorin — samma markerHex + gradient som kartans
 *  GL-brickor, så förhandsvisningen färgmatchar den riktiga kartan. */
function brickBg(category: string): string {
    const cat = EVENT_CATEGORIES[category as EventCategoryType] as { markerHex?: string } | undefined;
    return cat?.markerHex ? sourceGradientCss(cat.markerHex) : BRICKA_DARK_BG;
}

type Brick = { id: string; emoji: string; bg: string; dx: number; dy: number };

/** Tak på hur många event som serialiseras till den levande kartan — håller
 *  HTML-payloaden i schack på de största städerna (tidssorterat → det som
 *  kapas ligger längst fram i tiden). */
const MAX_LIVE_DATA = 350;

/** Bygg den levande kartans eventdata (vid BUILD). `listed` = dagen finns
 *  bland daglistans DAYS_LISTED första dagar — samma skärning som
 *  EventDayList, så kart-popupens "gå till listan" aldrig pekar på en rad
 *  som inte finns. */
function buildLiveEvents(city: City, events: CityEvent[]): HeroLiveEvent[] {
    const listedKeys = new Set<string>();
    for (const e of events) {
        const k = dayKey(e.time);
        if (listedKeys.size < DAYS_LISTED) listedKeys.add(k);
        else if (!listedKeys.has(k)) break; // tidssorterat → resten är bortom horisonten
    }
    return events
        .filter(e => e.lat && e.lng)
        .slice(0, MAX_LIVE_DATA)
        .map(e => {
            const k = dayKey(e.time);
            const cat = EVENT_CATEGORIES[e.category as EventCategoryType] as { markerHex?: string } | undefined;
            return {
                id: e.id,
                href: mapHref(e.id),
                lat: e.lat,
                lng: e.lng,
                emoji: e.emoji || '📍',
                hex: cat?.markerHex ?? null,
                title: e.title,
                place: e.locationName || city.name,
                clock: e.hasSpecificTime ? clockLabel(e.time) : null,
                t: Date.parse(e.time),
                hour: e.hasSpecificTime ? hourOf(e.time) : null,
                day: k,
                listed: listedKeys.has(k),
            };
        });
}

/** Välj brickor: Rekommenderat-eventen först (mest "riktiga händelser"),
 *  sedan bildsatta, sedan resten i tidsordning — greedy med minavstånd så
 *  inga brickor staplas på varandra. En bricka per koordinat (samma dedup-
 *  tanke som kartans grupp-nyckel). */
function pickBricks(city: City, events: CityEvent[], recommended: CityEvent[]): Brick[] {
    const center = worldPx(city.lat, city.lng, HERO_ZOOM);
    const recIds = new Set(recommended.map(e => e.id));
    const ordered = [
        ...recommended,
        ...events.filter(e => !recIds.has(e.id) && e.coverImage),
        ...events.filter(e => !recIds.has(e.id) && !e.coverImage),
    ];
    const picked: Brick[] = [];
    const seenCoord = new Set<string>();
    for (const e of ordered) {
        if (picked.length >= MAX_BRICKS) break;
        if (!e.lat || !e.lng) continue;
        const coordKey = `${e.lat.toFixed(4)},${e.lng.toFixed(4)}`;
        if (seenCoord.has(coordKey)) continue;
        const p = worldPx(e.lat, e.lng, HERO_ZOOM);
        const dx = p.x - center.x;
        const dy = p.y - center.y;
        if (Math.abs(dx) > HALF_W || Math.abs(dy) > HALF_H) continue;
        if (picked.some(b => (b.dx - dx) ** 2 + (b.dy - dy) ** 2 < MIN_DIST ** 2)) continue;
        seenCoord.add(coordKey);
        picked.push({ id: e.id, emoji: e.emoji || '📍', bg: brickBg(e.category), dx, dy });
    }
    return picked;
}

export default function CityMapHero({ city, events, recommended, ctaLabel }: {
    city: City;
    events: CityEvent[];
    recommended: CityEvent[];
    /** T.ex. "Öppna kartan över Malmö". */
    ctaLabel: string;
}) {
    const center = worldPx(city.lat, city.lng, HERO_ZOOM);
    const ctx = Math.floor(center.x / TILE);
    const cty = Math.floor(center.y / TILE);

    // 5×3 tiles (1280×768 px) centrerade på staden täcker hero-ytan
    // (max ~672×320) med god marginal oavsett viewportbredd.
    const tiles: { key: string; src: string; left: number; top: number }[] = [];
    const subs = ['a', 'b', 'c', 'd'];
    for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
            const tx = ctx + dx;
            const ty = cty + dy;
            tiles.push({
                key: `${tx}/${ty}`,
                // Samma Voyager-kartografi som kartans vektorstil, som raster
                // (@2x = skarpt på retina). Keyless, kräver bara attribution.
                src: `https://${subs[(tx + ty) % 4]}.basemaps.cartocdn.com/rastertiles/voyager/${HERO_ZOOM}/${tx}/${ty}@2x.png`,
                left: tx * TILE - center.x,
                top: ty * TILE - center.y,
            });
        }
    }

    const bricks = pickBricks(city, events, recommended);
    const live = buildLiveEvents(city, events);

    return (
        <div className="group relative block mt-5 h-72 sm:h-80 rounded-2xl overflow-hidden border border-slate-200 shadow-sm hover:shadow-md hover:border-[#006AA7]/40 transition-all">
            {/* Kartbotten: rena bild-tiles, absolut positionerade runt mitten. */}
            {tiles.map(t => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                    key={t.key}
                    src={t.src}
                    alt=""
                    aria-hidden
                    width={TILE}
                    height={TILE}
                    decoding="async"
                    className="absolute max-w-none select-none pointer-events-none"
                    style={{ left: `calc(50% + ${t.left}px)`, top: `calc(50% + ${t.top}px)`, width: TILE, height: TILE }}
                />
            ))}

            {/* Riktiga kartan (passiv men klickbar — kartbotten-klick öppnar
                stora kartan via bigMapHref) i huvudkartans stil, tonas in
                ovanpå kaklen. De statiska SSR-brickorna skickas med som
                children men visas BARA i GL-fallerade reservläget: samma
                nål-droppe som kartan (tre runda hörn + spets nedåt via rotate)
                med kategori-gradienten. Måtten speglar GL-brickans
                (makeBrickaImageData): hörnradien är HALVA kroppen — droppen
                ska se rund ut med ett enda spetsigt hörn — kanten är svagt
                vit och emojin ~0,6 av kroppen. */}
            <CityMapHeroCanvas lat={city.lat} lng={city.lng} zoom={HERO_GL_ZOOM} markers={live} bigMapHref={cityMapHref(city)}>
                {bricks.map((b, i) => (
                    <span
                        key={b.id}
                        aria-hidden
                        className="absolute"
                        style={{ left: `calc(50% + ${b.dx}px)`, top: `calc(50% + ${b.dy}px)` }}
                    >
                        <span
                            className="hero-bricka block w-[32px] h-[32px] rounded-full rounded-br-none border-[1.5px] border-white/30 shadow-md"
                            style={{ background: b.bg, transform: 'translate(-50%, -92%) rotate(45deg)', animationDelay: `${120 + i * 70}ms` }}
                        >
                            <span className="flex items-center justify-center w-full h-full -rotate-45 text-[19px] leading-none">
                                {b.emoji}
                            </span>
                        </span>
                    </span>
                ))}
            </CityMapHeroCanvas>

            {/* Läsbarhets-scrim nedtill + CTA-pillen (samma ljussvep som
                kartans hörn-pill). Sedan kartan blev interaktiv är PILLEN
                länken till stora kartan — inte hela ytan. pointer-events-none
                på scrimmen så den inte äter kartgester. */}
            <span aria-hidden className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/35 to-transparent pointer-events-none" />
            <Link
                href={cityMapHref(city)}
                aria-label={ctaLabel}
                className="absolute bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap z-30"
            >
                <span className="city-cta relative overflow-hidden inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#006AA7] hover:bg-[#005590] text-white font-black text-xs shadow-lg transition-colors">
                    {ctaLabel} →
                </span>
            </Link>

            {/* Carto/OSM-attribution — licenskravet gäller även rastertiles. */}
            <span className="absolute bottom-0 right-0 z-30 px-1.5 py-0.5 text-[8px] leading-none font-medium text-slate-600 bg-white/70 rounded-tl pointer-events-none">
                © OpenStreetMap © CARTO
            </span>
        </div>
    );
}
