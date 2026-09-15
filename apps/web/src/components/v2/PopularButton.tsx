'use client';

import { useMemo } from 'react';
import { LinkEvent } from '@/types';
import { sourceGradientCss } from './v2MapBricka';

interface PopularButtonProps {
    /** Eventen I KARTANS RUTA (redan popular-smalnade när filtret är PÅ) —
     *  badgen räknar 🔥-eventen bland dem, så talet stämmer i båda lägena. */
    events: LinkEvent[];
    popularOnly: boolean;
    onToggle: () => void;
    /** false = inget event i lagret bär pop-flaggan (gammalt cachat aggregat
     *  eller pipeline-regression) — knappen döljs helt i stället för att
     *  erbjuda ett filter som tömmer kartan. */
    available: boolean;
    /** Visningsrundan efter veckoblinken (Josef 10/9): true i 4 s → knappen
     *  står i sitt hover-läge (större + etiketten framme). */
    hint?: boolean;
}

/**
 * 🔥 Populära-knappen i BOTTEN-DOCKANS HÖGRA HÖRN (ägarbeslut 15/9 — bodde
 * 10/9–15/9 under lagerknappen uppe till höger; kategorikolumnen är riven).
 * Läget ska vara omisskännligt (Josef 10/9: "man ser inte ifall den är
 * aktiverad"): AV = vit cirkel, PÅ = eldorange kropp med vit ring OCH namn-
 * pillen "Visar bara populära" permanent framme, till VÄNSTER om knappen.
 *
 * Hörnet ligger över MapLibres attributions-ⓘ — samma avvägning som info-
 * knappen gjorde där 1/9–15/9. z-[1090] = samma som dagväljaren → under
 * eventkortet (1250).
 */
export default function PopularButton({ events, popularOnly, onToggle, available, hint = false }: PopularButtonProps) {
    const popCount = useMemo(() => events.reduce((n, e) => n + (e.pop ? 1 : 0), 0), [events]);

    if (!available) return null;

    return (
        <div className="fixed bottom-3 right-3 z-[1090] flex flex-row-reverse items-center gap-2 pointer-events-none">
            <button
                type="button"
                onClick={onToggle}
                aria-pressed={popularOnly}
                aria-label={popularOnly ? `Visar bara populära (${popCount} i vyn) — tryck för alla event` : 'Visa bara populära event'}
                style={popularOnly ? { background: sourceGradientCss('#E8590C') } : undefined}
                // Hover = lite större + flamman växer, som skapa-knappen
                // (Josef 10/9); hint håller samma läge framme under rundan.
                className={`peer group pointer-events-auto relative h-12 w-12 rounded-full shadow-lg flex items-center justify-center text-xl leading-none transition-all duration-200 border active:scale-95 ${
                    hint ? 'scale-105' : 'hover:scale-105'
                } ${
                    popularOnly
                        ? 'border-transparent ring-2 ring-white'
                        : 'bg-white/90 backdrop-blur-md border-white/50 hover:bg-white'
                }`}
            >
                <span aria-hidden className={`inline-block transition-transform duration-200 ${hint ? 'scale-110' : 'group-hover:scale-110'}`}>🔥</span>
                {popCount > 0 && (
                    <span
                        aria-hidden
                        className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-[10px] font-black tabular-nums flex items-center justify-center border border-slate-200 dark:border-slate-600 shadow leading-none pointer-events-none"
                    >
                        {popCount > 99 ? '99+' : popCount}
                    </span>
                )}
            </button>
            <span
                aria-hidden
                className={`pointer-events-none transition-opacity duration-150 whitespace-nowrap rounded-full bg-white/90 backdrop-blur-md px-2.5 py-1 text-xs font-bold shadow-lg border border-white/50 ${
                    popularOnly
                        ? 'opacity-100 text-[#c2410c]'
                        : hint
                            ? 'opacity-100 text-slate-700'
                            : 'opacity-0 peer-hover:opacity-100 peer-focus-visible:opacity-100 text-slate-700'
                }`}
            >
                {popularOnly ? 'Visar bara populära' : 'Visa bara populära'}
            </span>
        </div>
    );
}
