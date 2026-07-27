'use client';

import { ChevronRight, X } from 'lucide-react';
import { LinkEvent } from '../../types';
import { eventEmoji, isEventPast } from './v2MapBricka';

// ── Multi-event-lista ───────────────────────────────────────────────────────
// Öppnas när man klickar en bricka med FLERA event på samma koordinat: en liten
// panel (emoji + titel + tid per rad) så man kan välja vilket event i högen man
// vill öppna. Ankras till den klickade brickans ÖVRE HÖGRA hörn och följer
// punkten när kartan pannas/zoomas (V2Map projicerar om anchorPos på move/zoom).
// Saknas projicerad position (ogiltig koordinat) faller den tillbaka till
// top-center. Radval STÄNGER INTE listan — man ska kunna bläddra flera event på
// samma plats; den stängs av kart-klicket (onClose).

interface V2MapGroupListProps {
    /** Eventen på platsen (alltid ≥ 1; panelen visas bara vid > 1). */
    events: LinkEvent[];
    /** Brickans projicerade skärmposition (px), null → fallback top-center. */
    anchorPos: { x: number; y: number } | null;
    selectedEvent: LinkEvent | null;
    onSelect: (ev: LinkEvent) => void;
    onClose: () => void;
}

export default function V2MapGroupList({ events, anchorPos, selectedEvent, onSelect, onClose }: V2MapGroupListProps) {
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1024;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 768;
    const W = Math.min(vw * 0.8, 300);          // listbredd (px)
    // Brickans ungefärliga storlek: nål-tippen sitter PÅ geo-punkten,
    // kroppen ~BRICK_H px upp och ~BRICK_W px bred (centrerad i x).
    const BRICK_W = 30, BRICK_H = 46, GAP = 6;
    const TOP_MARGIN = 70, BOTTOM_MARGIN = 12;     // håll listan under navbaren resp. ovan nederkanten
    const HEADER_H = 42, ROW_H = 52, MAX_ROWS = 5; // "inte så lång" → max ~5 rader synliga, resten scrollas
    // KORTARE maxhöjd + ungefärlig faktisk höjd (för klamp på skärmen).
    const listMaxH = Math.min(vh * 0.5, HEADER_H + MAX_ROWS * ROW_H);
    const contentH = Math.min(listMaxH, HEADER_H + events.length * ROW_H);
    // Listan relaterar HORISONTELLT till brickans övre högra hörn.
    const cornerX = anchorPos ? anchorPos.x + BRICK_W / 2 + GAP : vw / 2 - W / 2;
    const cornerY = anchorPos ? anchorPos.y - BRICK_H : TOP_MARGIN + contentH;
    const left = Math.max(8, Math.min(cornerX, vw - W - 8));
    // Vertikalt: helst OVANFÖR brickan (växer uppåt → "högre upp"), men klampa
    // så HELA boxen alltid syns (top ≥ TOP_MARGIN, bottom ≤ vh − margin). Då
    // ligger scrollporten på skärmen och in-container-scrollen blir användbar
    // (förut kunde toppen hamna utanför vyn → man nådde inte de nedersta).
    const top = Math.max(TOP_MARGIN, Math.min(cornerY - contentH, vh - contentH - BOTTOM_MARGIN));
    // Platsens namn (alla event i gruppen delar koordinat → samma plats).
    const placeName = events[0]?.locationName?.trim() || 'Den här platsen';
    // Kommande event överst (i inkommande ordning), passerade sist — dämpade
    // med "har varit" (samma isEventPast som kartans dämpning: start + 1 h,
    // kl 20 för event utan klockslag). Passerade rader går fortfarande att
    // klicka (medvetet val), men bläddringen hoppar över dem.
    const nowMs = Date.now();
    const upcoming = events.filter(ev => !isEventPast(ev, nowMs));
    const past = events.filter(ev => isEventPast(ev, nowMs));
    const ordered = [...upcoming, ...past];
    // "Nästa" stegar markeringen till nästa KOMMANDE event (wrap), listan
    // hålls öppen precis som vid radval så man kan bläddra vidare. Står man
    // på ett passerat event (eller inget) börjar den om på första kommande.
    // Har ALLA varit bläddras hela listan som förr.
    const pool = upcoming.length > 0 ? upcoming : ordered;
    const selIdx = pool.findIndex(ev => ev.id === selectedEvent?.id);
    const goNextInList = () => onSelect(pool[(selIdx + 1) % pool.length]);

    return (
        <div className="z-[1300] pointer-events-auto" style={{ position: 'absolute', left, top, width: W }}>
            <div className="flex flex-col rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md shadow-2xl border border-white/60 dark:border-slate-700 overflow-hidden animate-in fade-in zoom-in-95 slide-in-from-top-2 duration-200" style={{ maxHeight: listMaxH }}>
                <div className="shrink-0 flex items-center gap-2 px-4 py-2.5 border-b border-slate-200/70 dark:border-slate-700/70">
                    <div className="min-w-0 flex-1">
                        <span className="block text-sm font-black text-slate-800 dark:text-slate-100 truncate leading-tight">{placeName}</span>
                        <span className="block text-[10px] font-black uppercase tracking-widest text-slate-400 leading-tight">{events.length} event{past.length > 0 && past.length < events.length ? ` · ${past.length} har varit` : ''}</span>
                    </div>
                    <button
                        type="button"
                        onClick={goNextInList}
                        aria-label="Nästa event här"
                        title="Nästa event här"
                        className="shrink-0 w-8 h-8 rounded-full bg-[#006AA7] text-white hover:bg-[#005590] active:scale-95 flex items-center justify-center transition-all"
                    >
                        <ChevronRight size={18} />
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Stäng listan"
                        className="shrink-0 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                        <X size={16} />
                    </button>
                </div>
                <ul className="flex-1 min-h-0 overflow-y-auto overscroll-contain divide-y divide-slate-100 dark:divide-slate-800">
                    {ordered.map((ev) => {
                        const tid = ev.time && ev.hasSpecificTime !== false
                            ? new Date(ev.time).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })
                            : '';
                        const isSel = selectedEvent?.id === ev.id;
                        const isPast = isEventPast(ev, nowMs);
                        return (
                            <li key={ev.id}>
                                <button
                                    type="button"
                                    onClick={() => onSelect(ev)}
                                    // Vald rad = blå med vit kant (ring-inset, ingen layout-shift) —
                                    // samma "vald = vit-kantad" som markören på kartan, så man ser
                                    // vilket event man står på medan man bläddrar. Passerad rad
                                    // dämpas (samma 50 % som kartans nål-prickar).
                                    className={`relative w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors ${isSel ? 'bg-[#006AA7] ring-2 ring-inset ring-white z-10' : 'hover:bg-slate-50 dark:hover:bg-slate-800 active:bg-slate-100 dark:active:bg-slate-700'}${isPast && !isSel ? ' opacity-50' : ''}`}
                                >
                                    <span className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-lg leading-none ${isSel ? 'bg-white/20' : 'bg-slate-100 dark:bg-slate-800'}`} aria-hidden>{eventEmoji(ev)}</span>
                                    <span className="flex-1 min-w-0">
                                        <span className={`block font-bold text-sm truncate ${isSel ? 'text-white' : 'text-slate-800 dark:text-slate-100'}`}>{ev.title}</span>
                                        {(tid || isPast) && <span className={`block text-[11px] font-semibold tabular-nums ${isSel ? 'text-white/80' : 'text-slate-500 dark:text-slate-400'}`}>{tid ? `kl ${tid}` : ''}{isPast ? `${tid ? ' · ' : ''}har varit` : ''}</span>}
                                    </span>
                                    <ChevronRight size={16} className={`shrink-0 ${isSel ? 'text-white' : 'text-slate-400'}`} />
                                </button>
                            </li>
                        );
                    })}
                </ul>
            </div>
        </div>
    );
}
