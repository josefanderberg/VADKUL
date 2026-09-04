'use client';

import { useEffect, useState } from 'react';
import { LinkEvent } from '@/types';
import EventListRow from './EventListRow';
import { SearchX, MapPin, ArrowRight } from 'lucide-react';
import type { CityPoint } from '@/utils/cityPoints';

const PAGE_SIZE = 25;

export interface CityHit {
    city: CityPoint;
    /** Antal event i staden den närmaste veckan. null = datat har inte landat än. */
    weekCount: number | null;
}

interface SearchResultsProps {
    query: string;
    /** Träffar över ALLA kommande dagar, tidssorterade. */
    results: LinkEvent[];
    onPick: (evt: LinkEvent) => void;
    /** Städer som matchar söktexten. Ligger ÖVERST — söker man "Hudiksvall"
     *  vill man till Hudiksvall, inte läsa en lista med enskilda event. */
    cities?: CityHit[];
    onPickCity?: (city: CityPoint) => void;
}

/**
 * Resultatpanel under sökfältet. Två sorters träffar:
 *
 * 1. STÄDER överst — klick flyger kartan dit. Tillkom 10/8 efter en
 *    användarkommentar: det fanns bara eventsök, så vägen till sin egen ort
 *    gick via att skrolla Sverigekartan och zooma in för hand.
 * 2. EVENT under — sökningen täcker alla kommande dagar (inte bara den valda),
 *    och klick hoppar till eventets dag, väljer det och flyger dit.
 */
export default function SearchResults({ query, results, onPick, cities = [], onPickCity }: SearchResultsProps) {
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
    useEffect(() => { setVisibleCount(PAGE_SIZE); }, [query]);

    if (!query.trim()) return null;

    const hasCities = cities.length > 0 && !!onPickCity;

    return (
        // z-[1165]: samma lager som Sparat-/profilpanelen — ÖVER navbaren (1160),
        // kategorikolumnen (1150), zoomknapparna (1149) och stadsrutans
        // dag/vecka-väljare (1090). Låg tidigare på 1040 och hamnade då UNDER
        // både knappkolumnerna och dagväljaren (Josef 31/8).
        // SAMMA mörka platta-språk som dagväljaren/stadsnamnet (Josef 31/8 —
        // den vita panelen med mörkblå accenter utbytt): slate-900/80 + blur +
        // white/10-kant, guld som accentfärg, samma look i ljust och mörkt
        // läge. `dark`-klassen på plattan TVINGAR de mörka varianterna i
        // EventListRow (darkMode: 'class') — raden delas med Sparat-/profil-
        // panelerna som fortfarande är ljusa och inte ska röras.
        <div className="absolute top-[4.6rem] right-4 left-4 sm:left-auto sm:w-[420px] z-[1165] pointer-events-auto">
            <div className="dark rounded-2xl bg-slate-900/80 backdrop-blur-md border border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[min(60vh,30rem)] animate-in fade-in slide-in-from-top-2 duration-200">

                {/* Städer — egen sektion högst upp, alltid synlig (scrollar inte
                    bort med eventlistan). */}
                {hasCities && (
                    <div className="shrink-0 border-b border-white/10">
                        <div className="px-4 py-2.5">
                            <span className="text-[10px] font-black uppercase tracking-widest text-white/45">
                                {cities.length === 1 ? 'Stad' : 'Städer'} · hoppa dit
                            </span>
                        </div>
                        <ul className="divide-y divide-white/10">
                            {cities.map(({ city, weekCount }) => (
                                <li key={city.name}>
                                    <button
                                        type="button"
                                        onClick={() => onPickCity?.(city)}
                                        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/10 transition-colors group"
                                    >
                                        <span className="w-9 h-9 rounded-full bg-[#FECC02]/15 flex items-center justify-center shrink-0">
                                            <MapPin size={17} className="text-[#FECC02]" />
                                        </span>
                                        <span className="flex-1 min-w-0">
                                            <span className="block font-bold text-white truncate">
                                                {city.name}
                                            </span>
                                            <span className="block text-xs text-white/55 truncate">
                                                {weekCount === null
                                                    ? 'Räknar event…'
                                                    : weekCount === 0
                                                        ? 'Inget inbokat den närmaste veckan'
                                                        : `${weekCount} event den närmaste veckan`}
                                            </span>
                                        </span>
                                        <ArrowRight size={16} className="text-white/30 group-hover:text-[#FECC02] transition-colors shrink-0" />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                <div className="px-4 py-2.5 border-b border-white/10 shrink-0">
                    <span className="text-[10px] font-black uppercase tracking-widest text-white/45">
                        {results.length === 0
                            ? 'Inga event matchar'
                            : `${results.length} ${results.length === 1 ? 'träff' : 'träffar'} · alla dagar`}
                    </span>
                </div>
                {results.length === 0 ? (
                    hasCities ? (
                        // Staden finns i listan men inga event matchar ordet — då är
                        // stadsraden ovanför svaret, inte en tom sökning.
                        <div className="px-6 py-5 text-center">
                            <p className="text-xs text-white/55">
                                Välj staden ovan så flyger kartan dit.
                            </p>
                        </div>
                    ) : (
                        <div className="px-6 py-8 flex flex-col items-center gap-2 text-center">
                            <SearchX size={22} className="text-white/30" />
                            <p className="text-sm font-bold text-white/80">
                                Inget matchar ”{query.trim()}”
                            </p>
                            <p className="text-xs text-white/45">Sök på stad, titel, plats eller arrangör.</p>
                        </div>
                    )
                ) : (
                    <ul className="overflow-y-auto divide-y divide-white/10 custom-scrollbar">
                        {results.slice(0, visibleCount).map(evt => (
                            <EventListRow key={evt.id} evt={evt} onPick={onPick} />
                        ))}
                        {visibleCount < results.length && (
                            <li className="flex justify-center">
                                <button
                                    type="button"
                                    onClick={() => setVisibleCount(c => c + PAGE_SIZE)}
                                    className="text-[11px] font-black uppercase tracking-widest text-[#FECC02] hover:text-[#ffd633] px-4 py-3"
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
