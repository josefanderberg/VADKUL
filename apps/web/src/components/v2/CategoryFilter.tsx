'use client';

import { useMemo } from 'react';
import { X } from 'lucide-react';
import { LinkEvent } from '@/types';
import { EVENT_CATEGORIES, EventCategoryType } from '@/utils/categories';

interface CategoryFilterProps {
    /** Dagens (+ sökfiltrerade) events — chipsen visar antal per kategori ur dessa. */
    events: LinkEvent[];
    selected: Set<string>;
    onToggle: (categoryId: string) => void;
    onClear: () => void;
}

/**
 * Horisontellt scrollbar kategorichips-rad under navbaren. Bara kategorier som
 * finns bland dagens events visas (med antal). Flerval; tom selection = alla.
 */
export default function CategoryFilter({ events, selected, onToggle, onClear }: CategoryFilterProps) {
    const counts = useMemo(() => {
        const c = new Map<string, number>();
        for (const evt of events) {
            const key = evt.category && evt.category in EVENT_CATEGORIES ? evt.category : 'other';
            c.set(key, (c.get(key) ?? 0) + 1);
        }
        return c;
    }, [events]);

    const visible = useMemo(
        () =>
            (Object.keys(EVENT_CATEGORIES) as EventCategoryType[])
                .filter((id) => (counts.get(id) ?? 0) > 0 || selected.has(id))
                .sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0)),
        [counts, selected],
    );

    if (visible.length <= 1 && selected.size === 0) return null;   // inget att filtrera på

    return (
        <div className="absolute top-[4.6rem] left-0 right-0 z-[990] px-3 pointer-events-none">
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1 pointer-events-auto items-center"
                 style={{ scrollbarWidth: 'none' }}>
                {selected.size > 0 && (
                    <button
                        type="button"
                        onClick={onClear}
                        className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-bold bg-slate-800/90 text-white shadow-md backdrop-blur-sm hover:bg-slate-700 transition-colors"
                        aria-label="Rensa kategorifilter"
                    >
                        <X size={12} /> Rensa
                    </button>
                )}
                {visible.map((id) => {
                    const cat = EVENT_CATEGORIES[id];
                    const isOn = selected.has(id);
                    return (
                        <button
                            key={id}
                            type="button"
                            onClick={() => onToggle(id)}
                            aria-pressed={isOn}
                            className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-bold shadow-md backdrop-blur-sm border transition-colors whitespace-nowrap ${
                                isOn
                                    ? `${cat.activeColor} text-white border-transparent`
                                    : 'bg-white/90 text-slate-700 border-white/60 hover:bg-white'
                            }`}
                        >
                            <span aria-hidden>{cat.emoji}</span>
                            {cat.label}
                            <span className={`tabular-nums font-semibold ${isOn ? 'text-white/80' : 'text-slate-400'}`}>
                                {counts.get(id) ?? 0}
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
