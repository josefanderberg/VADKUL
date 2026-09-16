'use client';

import { useMemo } from 'react';
import { EVENT_CATEGORIES, type EventCategoryType } from '@/utils/categories';
import { planMapCategoryChips } from '@/utils/categoryChips';
import { categoryLabel } from './v2MapLabel';

const KEYS = Object.keys(EVENT_CATEGORIES) as EventCategoryType[];

interface CategoryChipRowProps {
    /** Event per kategori i kartans ruta, räknade med alla filter utom själva
     *  kategorivalet — alltså vad kartan visar om man trycker på chippet. */
    counts: ReadonlyMap<string, number>;
    selected: EventCategoryType | null;
    /** null = släpp filtret. */
    onSelect: (category: EventCategoryType | null) => void;
}

/**
 * Kategorifiltret i SÖKPANELEN (ägarbeslut 16/9). Kolumnen till höger revs
 * 15/9 för att få ner antalet knappar, men användare saknade filtret ("bara
 * få upp sport eller musik") — så det bor nu bakom sökknappen och syns så
 * fort sökfältet är öppet. EN kategori åt gången: tryck = bara den, tryck
 * igen = alla. Kortnamnen är samma ord som under kartans markörer.
 * Vald = vit platta med mörk text — guld betyder boost på kartan.
 */
export default function CategoryChipRow({ counts, selected, onSelect }: CategoryChipRowProps) {
    const chips = useMemo(() => planMapCategoryChips(KEYS, counts, selected), [counts, selected]);
    return (
        <div className="px-4 pt-2.5 pb-3">
            <span className="block mb-2 text-[10px] font-black uppercase tracking-widest text-white/45">
                Visa bara
            </span>
            {chips.length === 0 ? (
                <p className="text-xs text-white/55">Inga event i vyn — zooma ut för att se kategorierna.</p>
            ) : (
                // -mx-4/px-4: raden scrollar ända ut till panelens kanter.
                <div className="-mx-4 px-4 flex gap-2 overflow-x-auto no-scrollbar [touch-action:pan-x]">
                    {chips.map(({ key, count }) => {
                        const cat = key as EventCategoryType;
                        const on = selected === cat;
                        return (
                            <button
                                key={key}
                                type="button"
                                aria-pressed={on}
                                onClick={() => onSelect(on ? null : cat)}
                                className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
                                    on ? 'bg-white text-slate-900' : 'bg-white/10 text-white/85 hover:bg-white/20'
                                }`}
                            >
                                <span aria-hidden>{EVENT_CATEGORIES[cat].emoji}</span>
                                {categoryLabel(cat)}
                                <span className={`tabular-nums ${on ? 'text-slate-500' : 'text-white/45'}`}>{count}</span>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
