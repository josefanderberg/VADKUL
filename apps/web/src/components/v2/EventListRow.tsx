'use client';

import type { ReactNode } from 'react';
import { isVadkulHostedEvent, LinkEvent } from '@/types';
import { EVENT_CATEGORIES, EventCategoryType } from '@/utils/categories';
import { formatEventDate } from '@/utils/dateUtils';
import { Clock, MapPin } from 'lucide-react';

/** Samma emoji-logik som kartnålarna: AI:ns per-event-emoji, annars kategorins. */
export function eventEmoji(evt: LinkEvent): string {
    const catKey = (evt.category && evt.category in EVENT_CATEGORIES ? evt.category : 'other') as EventCategoryType;
    return evt.emoji || (EVENT_CATEGORIES[catKey]?.emoji ?? '🎫');
}

interface EventListRowProps {
    evt: LinkEvent;
    onPick: (evt: LinkEvent) => void;
    /** Extra innehåll till höger om raden — t.ex. ta bort-knapp i sparat-listan. */
    right?: ReactNode;
    dimmed?: boolean;
}

/** Kompakt eventrad för panellistor (sökträffar, sparade event). */
export default function EventListRow({ evt, onPick, right, dimmed = false }: EventListRowProps) {
    return (
        <li className={`flex items-center ${dimmed ? 'opacity-60' : ''}`}>
            <button
                type="button"
                onClick={() => onPick(evt)}
                className="flex-1 min-w-0 text-left px-4 py-3 flex items-center gap-3 hover:bg-white dark:hover:bg-slate-800/60 transition-colors"
            >
                <span
                    className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-lg leading-none ${
                        isVadkulHostedEvent(evt)
                            ? 'bg-emerald-50 dark:bg-emerald-900/30 ring-2 ring-emerald-400/80'
                            : 'bg-slate-100 dark:bg-slate-800'
                    }`}
                    aria-hidden
                >
                    {eventEmoji(evt)}
                </span>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <h4 className="font-black text-sm text-black dark:text-white truncate min-w-0">{evt.title}</h4>
                        {isVadkulHostedEvent(evt) && (
                            <span className="inline-flex items-center text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full whitespace-nowrap shrink-0 bg-emerald-500 text-white">
                                VADKUL
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-[11px] font-bold text-slate-500 dark:text-slate-400">
                        <span className="inline-flex items-center gap-1 shrink-0 whitespace-nowrap">
                            <Clock size={11} className="text-primary" />
                            {formatEventDate(evt.time, evt.hasSpecificTime !== false)}
                        </span>
                        {evt.locationName && (
                            <span className="inline-flex items-center gap-1 min-w-0">
                                <MapPin size={11} className="text-primary shrink-0" />
                                <span className="truncate">{evt.locationName}</span>
                            </span>
                        )}
                    </div>
                </div>
            </button>
            {right && <div className="pr-3 shrink-0">{right}</div>}
        </li>
    );
}
