'use client';

import { useEffect, useMemo, useState } from 'react';
import { BRICKA_DARK_BG, sourceGradientCss } from '@/components/v2/v2MapBricka';
import { periodKeys } from './periods';
import { useDayFilter } from './dayFilter';
import CityHeroPeriodChips from './CityHeroPeriodChips';
import { pickHeroMarkers, type HeroLiveEvent } from './heroMarkers';

/**
 * Brickorna ovanpå den FÖRRENDERADE kartbilden.
 *
 * Kartbotten är sedan 20/9 en färdig bild (public/kartbilder/<stad>.webp,
 * byggd av scripts/render-city-maps.mjs i exakt nöjesfälts-stilen). Heron har
 * aldrig gått att dra eller zooma, så bilden räcker — och då behövs ingen
 * kartmotor i klienten. Det sparar 269 kB gzippad JS, en stil-hämtning och
 * alla vektorkakel per besök; hela sidans HTML är 121 kB gzippad, så
 * MapLibre var sidans i särklass tyngsta post.
 *
 * BARA BAKGRUNDEN är förrenderad. Brickorna måste förbli levande: de följer
 * period- och kategorifiltret och ska visa dagens utbud, inte byggdagens.
 * Därför ligger de här som vanliga DOM-element, positionerade med px-offset
 * som servern räknat i samma projektion som bilden.
 */
export default function CityMapHeroMarkers({ markers, bigMapHref }: {
    /** Stadens kommande event med färdiga px-offset (byggda i CityMapHero). */
    markers: HeroLiveEvent[];
    /** Stora kartan centrerad på staden — dit går klick på kartbotten. */
    bigMapHref: string;
}) {
    const { sel, category } = useDayFilter();
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
                konkurrerar med sidans övriga länkar om tangentbordsfokus. */}
            <button
                type="button"
                aria-label="Öppna hela kartan"
                tabIndex={-1}
                onClick={() => { window.location.assign(bigMapHref); }}
                className="absolute inset-0 z-0 cursor-pointer"
            />

            <CityHeroPeriodChips />

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
