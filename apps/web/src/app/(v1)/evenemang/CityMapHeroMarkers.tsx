'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { BRICKA_DARK_BG, sourceGradientCss } from '@/components/v2/v2MapBricka';
import { periodKeys, todayKey } from './periods';
import { useDayFilter } from './dayFilter';
import CityHeroPeriodChips from './CityHeroPeriodChips';
import { heroBrickHref, pickHeroMarkers, type HeroLiveEvent } from './heroMarkers';
import { placeHeroTitles, HERO_TITLE_FONT_PX, HERO_TITLE_LINE_PX } from './heroTitles';

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
    const { sel, category, popularOnly } = useDayFilter();
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
            // 🔥-chippet smalnar heron som listan (7/10: "inne på stadssidan
            // ska ju de event man vill se visas").
            popularOnly,
            now: Date.now(),
        });
    }, [mounted, markers, sel, category, popularOnly]);

    // TITLARNA (#267, 20/11): som på stora kartan står titeln under brickan,
    // annars till höger, vänster eller över, och bara där den får plats
    // (heroTitles). Kartrutan är flytande bred, så dess mått mäts här:
    // brickornas offset räknas från mitten och en smal skärm beskär bilden.
    const baseRef = useRef<HTMLButtonElement>(null);
    const [size, setSize] = useState<{ w: number; h: number } | null>(null);
    useEffect(() => {
        const el = baseRef.current;
        if (!el) return;
        const read = () => setSize({ w: el.clientWidth, h: el.clientHeight });
        read();
        if (typeof ResizeObserver === 'undefined') return;
        const ro = new ResizeObserver(read);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);
    const titles = useMemo(() => {
        if (!size) return [];
        return placeHeroTitles(visible, {
            halfW: size.w / 2,
            halfH: size.h / 2,
            // Periodchipsen i överkant: en rad, två när de bryts på smala
            // telefoner (CityHeroPeriodChips, flex-wrap).
            topReserve: size.w < 360 ? 58 : 32,
        });
    }, [visible, size]);

    return (
        <>
            {/* Kartbotten: klick utanför en bricka öppnar stora kartan över
                staden — "missar man en bricka ska man se eventen på riktiga
                kartan" (Josef 24/8). Knapp, inte länk, så den aldrig
                konkurrerar med sidans övriga länkar om tangentbordsfokus. */}
            <button
                ref={baseRef}
                type="button"
                aria-label="Öppna hela kartan"
                tabIndex={-1}
                onClick={() => { window.location.assign(bigMapHref); }}
                className="absolute inset-0 z-0 cursor-pointer"
            />

            <CityHeroPeriodChips />

            {visible.map(({ e, count, lastDay }, i) => (
                <button
                    key={e.id}
                    type="button"
                    aria-label={`Visa ${e.title || 'eventet'} på kartan${count > 1 ? ` (${count} på platsen)` : ''}`}
                    // En multibricka bär med sig perioden (#273): stora
                    // kartan visar samma dagar som siffran räknade.
                    onClick={ev => { ev.stopPropagation(); window.location.assign(heroBrickHref(e.href, count, lastDay, todayKey())); }}
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
                    {/* Titeln: vit fet text med mörkgrå kontur, som stora
                        kartans etiketter (text-halo). Ligger i knappen, så
                        ett tryck på titeln öppnar eventet. Måtten måste följa
                        heroTitles (HERO_TITLE_*), annars stämmer inte
                        krockrutorna. */}
                    {titles[i] && (
                        <span
                            aria-hidden
                            className="hero-bricka-title absolute whitespace-nowrap font-bold text-white"
                            style={{
                                left: titles[i]!.x,
                                top: titles[i]!.y,
                                width: titles[i]!.w,
                                fontSize: HERO_TITLE_FONT_PX,
                                lineHeight: `${HERO_TITLE_LINE_PX}px`,
                                textAlign: titles[i]!.side === 'right' ? 'left' : titles[i]!.side === 'left' ? 'right' : 'center',
                                animationDelay: `${Math.min(i * 45, 500) + 150}ms`,
                            }}
                        >
                            {titles[i]!.text}
                        </span>
                    )}
                </button>
            ))}
        </>
    );
}
