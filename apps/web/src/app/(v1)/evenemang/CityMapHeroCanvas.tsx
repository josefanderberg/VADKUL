'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { BRICKA_DARK_BG, sourceGradientCss } from '@/components/v2/v2MapBricka';
import { PERIODS, periodKeys } from './periods';
import { useDayFilter } from './dayFilter';
import { pickHeroMarkers, type HeroLiveEvent } from './heroMarkers';

export type { HeroLiveEvent };

/**
 * Stads-heronas BRICKLAGER.
 *
 * INGEN KARTMOTOR HÄR (ombyggt 20/9, ägarbeslut: "vi kan ju ändå inte dra
 * eller zooma på kartan. onödigt tungt att ladda en riktig karta istället för
 * en bild"). Kartbilden är de statiska OSM-kaklen som CityMapHero redan
 * renderar i server-HTML:en; det här lagret placerar bara brickorna ovanpå
 * dem som vanliga DOM-element.
 *
 * Vad som försvann: hela `maplibre-gl` (~800 kB JS), stilhämtningen, WebGL-
 * kontexten, IntersectionObservern som sköt upp starten och GL-fallerat-läget
 * med sin landfärgs-platta. Heron ritades tidigare TVÅ gånger — först kaklen,
 * sedan en GL-canvas ovanpå med samma bild.
 *
 * Positionerna räknas på servern (CityMapHero, samma projektion som kaklen)
 * och urvalet ligger i heroMarkers.ts — den här filen är bara utritning.
 *
 * FÖRE HYDRERING visas serverns statiska brickor (`children`), så heron är
 * komplett redan utan JavaScript. När det här lagret monterat tar det över,
 * eftersom bara det följer dag- och kategorifiltret.
 */
export default function CityMapHeroCanvas({ markers, bigMapHref, children }: {
    /** Stadens kommande event med färdiga px-offset (byggda i CityMapHero). */
    markers: HeroLiveEvent[];
    /** Stora kartan centrerad på staden (cityMapHref) — dit går klick på
     *  kartbotten. */
    bigMapHref: string;
    /** Serverns statiska brickor — visas tills det här lagret monterat. */
    children?: ReactNode;
}) {
    const { sel, setSel, category } = useDayFilter();
    // Urvalet är klockberoende ("har varit") → får inte köras vid SSR, då
    // skulle serverns och klientens HTML kunna skilja sig. Samma mönster som
    // daglistans nowTs.
    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); }, []);

    const visible = useMemo(() => {
        if (!mounted) return [];
        return pickHeroMarkers(markers, {
            dayKeys: sel.kind === 'period' ? periodKeys(sel.period) : [sel.key],
            category,
            now: Date.now(),
        });
    }, [mounted, markers, sel, category]);

    return (
        <>
            {/* Kartbotten: klick utanför en bricka öppnar stora kartan över
                staden — "missar man en bricka ska man se eventen på riktiga
                kartan" (Josef 24/8). Knapp, inte länk, så den aldrig
                konkurrerar med CTA-pillen om tangentbordsfokus. */}
            <button
                type="button"
                aria-label="Öppna hela kartan"
                tabIndex={-1}
                onClick={() => { window.location.assign(bigMapHref); }}
                className="absolute inset-0 z-0 cursor-pointer"
            />

            {/* PERIODCHIPSEN — sidans ENDA periodfilter sedan listans egen
                filterrad togs bort 20/9. De styr både brickorna här och
                daglistan under (samma delade dayFilter-state), så de får inte
                flyttas härifrån eller tas bort.
                z-20: över brickorna. flex-wrap + right-2: fem chips ryms
                knappt på en 320 px-telefon — hellre en rad till än klippt. */}
            <div className="absolute top-2 left-2 right-2 z-20 flex flex-wrap gap-1">
                {PERIODS.map(p => {
                    const active = sel.kind === 'period' && sel.period === p.key;
                    return (
                        <button
                            key={p.key}
                            type="button"
                            onClick={() => setSel({ kind: 'period', period: p.key })}
                            aria-pressed={active}
                            className={`px-2.5 py-1 rounded-full text-[10px] font-black shadow-sm border transition-colors ${
                                active
                                    ? 'bg-[#006AA7] border-[#006AA7] text-white'
                                    : 'bg-white/85 backdrop-blur border-white/60 text-slate-700 hover:bg-white'
                            }`}
                        >
                            {p.label}
                        </button>
                    );
                })}
            </div>

            {/* Serverns statiska brickor tills filterlagret monterat. */}
            {!mounted && children}

            {visible.map(({ e, count }, i) => (
                <button
                    key={e.id}
                    type="button"
                    aria-label={`Visa eventet på kartan${count > 1 ? ` (${count} på platsen)` : ''}`}
                    onClick={ev => { ev.stopPropagation(); window.location.assign(e.href); }}
                    className="absolute z-10 w-0 h-0 cursor-pointer"
                    style={{ left: `calc(50% + ${e.dx}px)`, top: `calc(50% + ${e.dy}px)` }}
                >
                    {/* Samma nål-droppe som kartan: tre runda hörn + spets
                        nedåt via rotate, kategori-gradienten som kropp,
                        emojin roterad tillbaka. Måtten speglar GL-brickans
                        (makeBrickaImageData) — ändra inte den ena utan den andra. */}
                    <span
                        className="hero-bricka block w-[32px] h-[32px] rounded-full rounded-br-none border-[1.5px] border-white/30 shadow-md"
                        style={{
                            background: e.hex ? sourceGradientCss(e.hex) : BRICKA_DARK_BG,
                            transform: 'translate(-50%, -92%) rotate(45deg)',
                            animationDelay: `${Math.min(i * 45, 500)}ms`,
                        }}
                    >
                        <span className="flex items-center justify-center w-full h-full -rotate-45 text-[19px] leading-none">
                            {e.emoji || '📍'}
                        </span>
                    </span>
                    {count > 1 && (
                        <span className="absolute left-[8px] -top-[40px] min-w-[16px] h-[16px] px-1 rounded-full bg-white text-slate-900 text-[10px] font-black flex items-center justify-center shadow">
                            {count}
                        </span>
                    )}
                </button>
            ))}
        </>
    );
}
