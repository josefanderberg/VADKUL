import Link from 'next/link';
import type { City, CityEvent } from './cityData';
import { EVENT_CATEGORIES, type EventCategoryType } from '@/utils/categories';
import { sourceGradientCss, BRICKA_DARK_BG } from '@/components/v2/v2MapBricka';
import CityMapHeroCanvas from './CityMapHeroCanvas';

// Klickbar kart-förhandsvisning överst på stads-/kategorisidorna: en äkta,
// inzoomad kartbit över staden med riktiga VADKUL-brickor på riktiga event-
// positioner. Hela ytan är EN länk som öppnar kartan inzoomad på staden
// (?plats=lat,lng,zoom — läses i V2Maps init). Poängen är att sidorna ska
// kännas som sajten (kartan ÄR produkten), inte som ett textindex.
//
// Två lager kartbotten, i den ordningen:
//   1. Serverrenderade kakelbilder — Cartos raster-Voyager (samma kartografi
//      som kartans vektor-Voyager, ingen API-nyckel) som vanliga <img>. Syns
//      direkt, finns i HTML:en, kräver noll JS.
//   2. CityMapHeroCanvas — en riktig, passiv MapLibre-karta i huvudkartans
//      "nöjesfälts"-stil som tonas in ovanpå kaklen efter hydreringen. Utan
//      den ser heron ut som en helt annan produkt: Voyagers raster är grå-
//      beige medan kartan man landar på har grönt land och blått vatten.
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
 *  (max ~672 px innehållsbredd) — 320/110 håller brickorna synliga även på
 *  desktop utan att mobilen känns tom (overflow klipps ändå av kartytan). */
const HALF_W = 320;
const HALF_H = 110;
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
    // (max ~672×256) med god marginal oavsett viewportbredd.
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

    return (
        <Link
            href={cityMapHref(city)}
            aria-label={ctaLabel}
            className="group relative block mt-5 h-52 sm:h-60 rounded-2xl overflow-hidden border border-slate-200 shadow-sm hover:shadow-md hover:border-[#006AA7]/40 transition-all"
        >
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

            {/* Riktiga kartan i huvudkartans stil, tonas in ovanpå kaklen. */}
            <CityMapHeroCanvas lat={city.lat} lng={city.lng} zoom={HERO_GL_ZOOM} />

            {/* Brickorna: samma nål-droppe som kartan (tre runda hörn + spets
                nedåt via rotate) med kategori-gradienten, poppar in staggrat.
                Måtten speglar GL-brickans (makeBrickaImageData): hörnradien är
                HALVA kroppen — droppen ska se rund ut med ett enda spetsigt
                hörn, inte som en rundad kvadrat — kanten är svagt vit och
                emojin ~0,6 av kroppen. */}
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

            {/* Läsbarhets-scrim nedtill + CTA-pillen (samma ljussvep som
                kartans hörn-pill) — hela ytan är länken, pillen är skylten. */}
            <span aria-hidden className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/35 to-transparent pointer-events-none" />
            <span className="absolute bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap">
                <span className="city-cta relative overflow-hidden inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#006AA7] group-hover:bg-[#005590] text-white font-black text-xs shadow-lg transition-colors">
                    {ctaLabel} →
                </span>
            </span>

            {/* Carto/OSM-attribution — licenskravet gäller även rastertiles. */}
            <span className="absolute bottom-0 right-0 px-1.5 py-0.5 text-[8px] leading-none font-medium text-slate-600 bg-white/70 rounded-tl">
                © OpenStreetMap © CARTO
            </span>
        </Link>
    );
}
