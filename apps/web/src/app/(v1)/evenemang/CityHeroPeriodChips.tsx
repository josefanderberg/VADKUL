'use client';

import { PERIODS } from './periods';
import { useDayFilter } from './dayFilter';

/**
 * Periodchipsen överst till vänster på stads-heron.
 *
 * Sidans ENDA periodfilter sedan listans egen filterrad revs 20/9 — de styr
 * både herons brickor och daglistan under, via det delade dayFilter-statet.
 * Flytta dem inte och ta dem inte bort.
 *
 * Bruten ur CityMapHeroCanvas när heron fick två lägen: den förrenderade
 * kartbilden (CityMapHeroMarkers) och GL-reservvägen. Båda visar samma chips,
 * och de ska aldrig hinna gå isär.
 *
 * flex-wrap + right-2: fem chips ryms knappt på en 320 px-telefon — hellre en
 * rad till än klippt.
 */
export default function CityHeroPeriodChips() {
    const { sel, setSel } = useDayFilter();
    return (
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
    );
}
