'use client';

import { useEffect, useState } from 'react';
import { LinkEvent } from '@/types';
import EventListRow from './EventListRow';
import { SearchX } from 'lucide-react';

const PAGE_SIZE = 25;

interface SearchResultsProps {
    query: string;
    /** Träffar över ALLA kommande dagar, tidssorterade. */
    results: LinkEvent[];
    onPick: (evt: LinkEvent) => void;
}

/**
 * Resultatpanel under sökfältet. Sökningen täcker alla kommande dagar (inte
 * bara den valda) — klick på en träff hoppar till eventets dag, väljer det
 * och flyger dit på kartan.
 */
export default function SearchResults({ query, results, onPick }: SearchResultsProps) {
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
    useEffect(() => { setVisibleCount(PAGE_SIZE); }, [query]);

    if (!query.trim()) return null;

    return (
        <div className="absolute top-[4.6rem] right-4 left-4 sm:left-auto sm:w-[420px] z-[1040] pointer-events-auto">
            <div className="rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-white/60 dark:border-slate-700 shadow-2xl overflow-hidden flex flex-col max-h-[min(60vh,30rem)] animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 shrink-0">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                        {results.length === 0
                            ? 'Inga träffar'
                            : `${results.length} ${results.length === 1 ? 'träff' : 'träffar'} · alla dagar`}
                    </span>
                </div>
                {results.length === 0 ? (
                    <div className="px-6 py-8 flex flex-col items-center gap-2 text-center">
                        <SearchX size={22} className="text-slate-300" />
                        <p className="text-sm font-bold text-slate-600 dark:text-slate-300">
                            Inget event matchar ”{query.trim()}”
                        </p>
                        <p className="text-xs text-slate-400">Sök på titel, plats eller arrangör.</p>
                    </div>
                ) : (
                    <ul className="overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 custom-scrollbar">
                        {results.slice(0, visibleCount).map(evt => (
                            <EventListRow key={evt.id} evt={evt} onPick={onPick} />
                        ))}
                        {visibleCount < results.length && (
                            <li className="flex justify-center">
                                <button
                                    type="button"
                                    onClick={() => setVisibleCount(c => c + PAGE_SIZE)}
                                    className="text-[11px] font-black uppercase tracking-widest text-[#006AA7] hover:text-[#005590] px-4 py-3"
                                >
                                    Visa fler ({results.length - visibleCount} till)
                                </button>
                            </li>
                        )}
                    </ul>
                )}
            </div>
        </div>
    );
}
