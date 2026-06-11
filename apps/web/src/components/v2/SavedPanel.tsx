'use client';

import { useMemo, useState } from 'react';
import { LinkEvent } from '@/types';
import EventListRow from './EventListRow';
import { Heart, X, ChevronDown } from 'lucide-react';

interface SavedPanelProps {
    open: boolean;
    /** Hela eventlistan — panelen plockar ut de sparade ur den. */
    events: LinkEvent[];
    savedEventIds: Set<string>;
    onPick: (evt: LinkEvent) => void;
    onRemove: (id: string) => void;
    onClose: () => void;
}

/**
 * Panel med användarens sparade event (hjärtan). Kommande överst, passerade
 * under en hopfällbar flik. Klick på en rad hoppar till eventet på kartan.
 */
export default function SavedPanel({ open, events, savedEventIds, onPick, onRemove, onClose }: SavedPanelProps) {
    const [showPast, setShowPast] = useState(false);

    const { upcoming, past } = useMemo(() => {
        const saved = events.filter(e => savedEventIds.has(e.id));
        // Äldre än 1 h räknas som "har varit" (matchar kortlekens statuslogik).
        const cutoff = Date.now() - 60 * 60 * 1000;
        return {
            upcoming: saved.filter(e => e.time.getTime() >= cutoff),
            past: saved.filter(e => e.time.getTime() < cutoff).reverse(),
        };
    }, [events, savedEventIds]);

    if (!open) return null;

    const removeButton = (id: string) => (
        <button
            type="button"
            onClick={() => onRemove(id)}
            title="Ta bort från sparade"
            aria-label="Ta bort från sparade"
            className="p-1.5 rounded-full text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
        >
            <X size={15} />
        </button>
    );

    return (
        <>
            {/* Klick utanför panelen stänger den */}
            <div className="fixed inset-0 z-[1030]" onClick={onClose} />
            <div className="absolute top-[4.6rem] right-4 left-4 sm:left-auto sm:w-[420px] z-[1040] pointer-events-auto">
                <div className="rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-white/60 dark:border-slate-700 shadow-2xl overflow-hidden flex flex-col max-h-[min(60vh,30rem)] animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 shrink-0 flex items-center justify-between">
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-500">
                            <Heart size={12} className="text-rose-500" fill="currentColor" />
                            Sparade event · {upcoming.length + past.length}
                        </span>
                        <button
                            type="button"
                            onClick={onClose}
                            aria-label="Stäng"
                            className="text-slate-400 hover:text-slate-600 transition-colors p-1"
                        >
                            <X size={16} />
                        </button>
                    </div>

                    {upcoming.length === 0 && past.length === 0 ? (
                        <div className="px-6 py-8 flex flex-col items-center gap-2 text-center">
                            <Heart size={22} className="text-slate-300" />
                            <p className="text-sm font-bold text-slate-600 dark:text-slate-300">Inga sparade event än</p>
                            <p className="text-xs text-slate-400">
                                Tryck på hjärtat på ett eventkort — eller svep kortet åt höger — så hamnar det här.
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-y-auto custom-scrollbar">
                            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                                {upcoming.map(evt => (
                                    <EventListRow key={evt.id} evt={evt} onPick={onPick} right={removeButton(evt.id)} />
                                ))}
                            </ul>
                            {past.length > 0 && (
                                <div className="border-t border-slate-100 dark:border-slate-800">
                                    <button
                                        type="button"
                                        onClick={() => setShowPast(s => !s)}
                                        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-white dark:hover:bg-slate-800/60 transition-colors"
                                        aria-expanded={showPast}
                                    >
                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                                            Har varit · {past.length}
                                        </span>
                                        <ChevronDown
                                            size={16}
                                            className={`text-slate-400 transition-transform duration-200 ${showPast ? 'rotate-180' : ''}`}
                                        />
                                    </button>
                                    {showPast && (
                                        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                                            {past.map(evt => (
                                                <EventListRow key={evt.id} evt={evt} onPick={onPick} right={removeButton(evt.id)} dimmed />
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
