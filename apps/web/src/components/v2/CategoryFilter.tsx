'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Layers, X } from 'lucide-react';
import { LinkEvent } from '@/types';
import { EVENT_CATEGORIES, EventCategoryType } from '@/utils/categories';

interface CategoryFilterProps {
    /** Dagens (+ sökfiltrerade) events — panelen visar antal per kategori ur dessa. */
    events: LinkEvent[];
    selected: Set<string>;
    onToggle: (categoryId: string) => void;
    onClear: () => void;
}

/**
 * Kategorifilter i samma formspråk som funktions-väskan: en rund knapp under
 * profilen (spegelplats till lager-knappen på högersidan) som fäller ut en
 * panel med en rad per kategori — emoji-bricka + namn + antal + PÅ-indikator.
 * Flerval; tom selection = alla kategorier visas.
 */
export default function CategoryFilter({ events, selected, onToggle, onClear }: CategoryFilterProps) {
    const [open, setOpen] = useState(false);
    const panelRef = useRef<HTMLDivElement>(null);
    const btnRef = useRef<HTMLButtonElement>(null);

    // Stäng vid klick utanför panelen/knappen
    useEffect(() => {
        if (!open) return;
        const onDown = (e: MouseEvent) => {
            const t = e.target as Node;
            if (panelRef.current?.contains(t) || btnRef.current?.contains(t)) return;
            setOpen(false);
        };
        document.addEventListener('mousedown', onDown);
        return () => document.removeEventListener('mousedown', onDown);
    }, [open]);

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

    return (
        <>
            {/* Rund knapp i högerkolumnen (under sök/+). Badge = antal aktiva filter. */}
            <div className="fixed top-[72px] right-4 z-[1151] pointer-events-auto">
                <button
                    ref={btnRef}
                    type="button"
                    onClick={() => setOpen(o => !o)}
                    aria-expanded={open}
                    aria-label="Filtrera på kategori"
                    className="bg-white/90 backdrop-blur-md p-2.5 rounded-full shadow-lg border border-white/50 hover:bg-white transition-colors relative"
                >
                    <Layers size={20} className="text-slate-700" />
                    {selected.size > 0 && (
                        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#006AA7] text-white text-[10px] font-black flex items-center justify-center border border-white tabular-nums">
                            {selected.size}
                        </span>
                    )}
                </button>
            </div>

            {/* Panel — samma stil som funktions-väskan, fast i högerkolumnen. */}
            {open && (
                <div
                    ref={panelRef}
                    className="fixed top-[118px] right-3 z-[1150] w-[270px] max-h-[68vh] overflow-y-auto no-scrollbar rounded-2xl bg-white/95 backdrop-blur-md shadow-2xl border border-white/60 p-1.5 pointer-events-auto animate-in fade-in zoom-in-95 slide-in-from-top-2 duration-200"
                >
                    <div className="px-2.5 pt-1 pb-1.5 flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                            Kategorier
                        </span>
                        {selected.size > 0 && (
                            <button
                                type="button"
                                onClick={onClear}
                                className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wide text-[#006AA7] hover:text-[#005590] px-1.5 py-0.5"
                            >
                                <X size={10} strokeWidth={3} /> Visa alla
                            </button>
                        )}
                    </div>
                    {visible.map((id) => {
                        const cat = EVENT_CATEGORIES[id];
                        const active = selected.has(id);
                        return (
                            <button
                                key={id}
                                type="button"
                                onClick={() => onToggle(id)}
                                aria-pressed={active}
                                className={`w-full flex items-center gap-3 px-2 py-1.5 rounded-xl text-left transition-colors ${active ? 'bg-slate-100' : 'hover:bg-slate-100 active:bg-slate-200'}`}
                            >
                                <span
                                    className={`shrink-0 h-9 w-9 rounded-full flex items-center justify-center text-lg leading-none border ${
                                        active ? `${cat.color} border-transparent ring-2 ring-offset-1 ring-slate-300` : 'bg-slate-50 border-slate-200'
                                    }`}
                                    aria-hidden
                                >
                                    {cat.emoji}
                                </span>
                                <span className="flex-1 min-w-0">
                                    <span className={`block text-sm font-bold leading-tight ${active ? 'text-slate-800' : 'text-slate-500'}`}>
                                        {cat.label}
                                    </span>
                                    <span className="block text-[11px] text-slate-500 leading-tight tabular-nums">
                                        {counts.get(id) ?? 0} event idag
                                    </span>
                                </span>
                                {active && (
                                    <span className={`shrink-0 text-[9px] font-black px-1.5 py-0.5 rounded-full tracking-wide ${cat.color}`}>
                                        PÅ
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            )}
        </>
    );
}
