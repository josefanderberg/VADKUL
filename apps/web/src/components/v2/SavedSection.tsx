'use client';

import { useEffect, useMemo, useState } from 'react';
import { LinkEvent } from '@/types';
import EventListRow from './EventListRow';
import { isEventPast } from './v2MapBricka';
import { Heart, X, ChevronDown, ChevronRight } from 'lucide-react';

interface SavedSectionProps {
    /** Profilpanelens öppet-läge - stängd panel fäller ihop mappen. */
    panelOpen: boolean;
    /** Hela eventlistan - sektionen plockar ut de sparade ur den. */
    events: LinkEvent[];
    savedEventIds: ReadonlySet<string>;
    onPick: (evt: LinkEvent) => void;
    onRemove: (id: string) => void;
}

/**
 * Sparade event (hjärtan) som en mapp i profilpanelen - fälls ut PÅ PLATS i
 * stället för att byta till en egen panel (Josef 7/10: "då behöver ju inte
 * ett annat fönster öppnas"). Kommande (aktivt sparade) överst; passerade
 * ligger som HISTORIK under en hopfällbar flik och räknas inte med i
 * räknaren. Klick på en rad hoppar till eventet (och stänger panelen).
 */
export default function SavedSection({ panelOpen, events, savedEventIds, onPick, onRemove }: SavedSectionProps) {
    const [expanded, setExpanded] = useState(false);
    const [showPast, setShowPast] = useState(false);

    // Panelstängning nollar utfällningen, som Vänner-mappen.
    useEffect(() => {
        if (!panelOpen) {
            setExpanded(false);
            setShowPast(false);
        }
    }, [panelOpen]);

    const { upcoming, past } = useMemo(() => {
        const saved = events.filter(e => savedEventIds.has(e.id));
        // "Har varit" = samma logik som kartan/kortleken (isEventPast): start
        // + 1 h passerad, eller kl 20 för event utan klockslag.
        const nowMs = Date.now();
        return {
            upcoming: saved.filter(e => !isEventPast(e, nowMs)),
            past: saved.filter(e => isEventPast(e, nowMs)).reverse(),
        };
    }, [events, savedEventIds]);

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
        <div>
            <button
                type="button"
                onClick={() => setExpanded(o => !o)}
                aria-expanded={expanded}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-800/60 transition-colors text-left"
            >
                <Heart size={16} className="text-rose-500 shrink-0" fill={upcoming.length > 0 ? 'currentColor' : 'none'} />
                <span className="flex-1">Sparade event</span>
                <span className="text-xs font-black text-slate-400 tabular-nums">{upcoming.length}</span>
                {expanded
                    ? <ChevronDown size={15} className="text-slate-400 shrink-0" />
                    : <ChevronRight size={15} className="text-slate-400 shrink-0" />}
            </button>

            {expanded && (
                upcoming.length === 0 && past.length === 0 ? (
                    <p className="px-4 pb-3 text-xs font-semibold text-slate-400">
                        Inga sparade event än - tryck på hjärtat på ett eventkort så hamnar det här.
                    </p>
                ) : (
                    <div className="pb-1">
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
                                    className="w-full px-4 py-2.5 flex items-center justify-between text-left hover:bg-white dark:hover:bg-slate-800/60 transition-colors"
                                    aria-expanded={showPast}
                                >
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                                        Historik · {past.length}
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
                )
            )}
        </div>
    );
}
