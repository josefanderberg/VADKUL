'use client';

import { Fragment, useState } from 'react';
import { ChevronRight, Clock, X } from 'lucide-react';
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
//
// DAGRUBRIKER: när man tittar på hela veckan kan en scen ha 30+ event i högen
// och då räcker inte klockslaget — man måste se VILKEN DAG raden gäller. Listan
// grupperas därför per dag med klistrade dagrubriker, precis som daglistan på
// stadssidorna (/evenemang/<stad>): blå pille med veckodag + datum, gul
// "Idag"/"Imorgon"-badge, antal event i dagen. Är hela högen samma dag (vanligt
// i dagsläget) ritas INGA rubriker — panelen ser ut som förr.
// HAR VARIT: passerade event ligger hopfällda bakom en knapp längst ner (samma
// grepp som stadssidan) i stället för att ta plats bland de kommande.

const TZ = 'Europe/Stockholm';
const keyFmt = new Intl.DateTimeFormat('sv-SE', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
const dayFmt = new Intl.DateTimeFormat('sv-SE', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short' });
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);

/** "Idag"/"Imorgon" för en dagnyckel, annars null. */
function relativeDayLabel(key: string, now: number): string | null {
    const d = new Date(now);
    if (key === keyFmt.format(d)) return 'Idag';
    if (key === keyFmt.format(addDays(d, 1))) return 'Imorgon';
    return null;
}

type DayBucket = { key: string; label: string; rel: string | null; events: LinkEvent[] };

/** Tidssorterar och delar upp på dag (svensk tid), i kronologisk ordning. */
function bucketByDay(list: LinkEvent[], nowMs: number): DayBucket[] {
    const buckets: DayBucket[] = [];
    const byKey = new Map<string, DayBucket>();
    for (const ev of [...list].sort((a, b) => (a.time?.getTime() ?? 0) - (b.time?.getTime() ?? 0))) {
        const key = ev.time ? keyFmt.format(ev.time) : 'okänt';
        let bucket = byKey.get(key);
        if (!bucket) {
            // "lör 9 aug." → "Lör 9 aug." (svenskan versaliserar bara första bokstaven).
            const raw = ev.time ? dayFmt.format(ev.time) : 'Datum saknas';
            bucket = { key, label: raw.charAt(0).toUpperCase() + raw.slice(1), rel: relativeDayLabel(key, nowMs), events: [] };
            byKey.set(key, bucket);
            buckets.push(bucket);
        }
        bucket.events.push(ev);
    }
    return buckets;
}

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
    // Passerade event ligger hopfällda tills man ber om dem.
    const [pastOpen, setPastOpen] = useState(false);

    const vw = typeof window !== 'undefined' ? window.innerWidth : 1024;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 768;
    const W = Math.min(vw * 0.86, 320);          // listbredd (px)
    // Brickans ungefärliga storlek: nål-tippen sitter PÅ geo-punkten,
    // kroppen ~BRICK_H px upp och ~BRICK_W px bred (centrerad i x).
    const BRICK_W = 30, BRICK_H = 46, GAP = 6;
    const TOP_MARGIN = 70, BOTTOM_MARGIN = 12;     // håll listan under navbaren resp. ovan nederkanten
    const HEADER_H = 46, ROW_H = 52, DAY_H = 30, PAST_H = 34, MAX_ROWS = 6;

    // Kommande event överst (kronologiskt, dag för dag), passerade sist —
    // dämpade med "har varit" (samma isEventPast som kartans dämpning: start
    // + 1 h, kl 20 för event utan klockslag). Passerade rader går fortfarande
    // att klicka (medvetet val), men bläddringen hoppar över dem.
    const nowMs = Date.now();
    const upcoming = events.filter(ev => !isEventPast(ev, nowMs));
    const past = events.filter(ev => isEventPast(ev, nowMs));
    const dayBuckets = bucketByDay(upcoming, nowMs);
    const pastOrdered = bucketByDay(past, nowMs).flatMap(b => b.events);
    // Dagrubriker bara när högen faktiskt spänner över flera dagar (annars är
    // de bara brus — alla rader hör ju ändå till samma dag).
    const showDays = dayBuckets.length > 1;

    // KORTARE maxhöjd + ungefärlig faktisk höjd (för klamp på skärmen).
    const listMaxH = Math.min(vh * 0.55, HEADER_H + MAX_ROWS * ROW_H + (showDays ? 2 * DAY_H : 0));
    const bodyH = upcoming.length * ROW_H
        + (showDays ? dayBuckets.length * DAY_H : 0)
        + (past.length > 0 ? PAST_H + (pastOpen ? past.length * ROW_H : 0) : 0);
    const contentH = Math.min(listMaxH, HEADER_H + bodyH);
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
    // "Nästa" stegar markeringen till nästa KOMMANDE event (wrap), listan
    // hålls öppen precis som vid radval så man kan bläddra vidare. Står man
    // på ett passerat event (eller inget) börjar den om på första kommande.
    // Har ALLA varit bläddras hela listan som förr.
    const pool = upcoming.length > 0 ? dayBuckets.flatMap(b => b.events) : pastOrdered;
    const selIdx = pool.findIndex(ev => ev.id === selectedEvent?.id);
    const goNextInList = () => onSelect(pool[(selIdx + 1) % pool.length]);

    // En eventrad: emoji, titel, klockslag (+ "har varit" på passerade).
    const row = (ev: LinkEvent, isPast: boolean) => {
        const tid = ev.time && ev.hasSpecificTime !== false
            ? ev.time.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })
            : '';
        const isSel = selectedEvent?.id === ev.id;
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
                        {(tid || isPast) && (
                            <span className={`flex items-center gap-1 text-[11px] font-semibold tabular-nums ${isSel ? 'text-white/80' : 'text-slate-500 dark:text-slate-400'}`}>
                                {tid && <Clock size={10} className="shrink-0" />}
                                {tid ? `kl ${tid}` : ''}{isPast ? `${tid ? ' · ' : ''}har varit` : ''}
                            </span>
                        )}
                    </span>
                    <ChevronRight size={16} className={`shrink-0 ${isSel ? 'text-white' : 'text-slate-400'}`} />
                </button>
            </li>
        );
    };

    return (
        <div className="z-[1300] pointer-events-auto" style={{ position: 'absolute', left, top, width: W }}>
            <div className="flex flex-col rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md shadow-2xl border border-white/60 dark:border-slate-700 overflow-hidden animate-in fade-in zoom-in-95 slide-in-from-top-2 duration-200" style={{ maxHeight: listMaxH }}>
                <div className="shrink-0 flex items-center gap-2 px-4 py-2.5 border-b border-slate-200/70 dark:border-slate-700/70">
                    <div className="min-w-0 flex-1">
                        <span className="block text-sm font-black text-slate-800 dark:text-slate-100 truncate leading-tight">{placeName}</span>
                        <span className="block text-[10px] font-black uppercase tracking-widest text-slate-400 leading-tight">
                            {events.length} event
                            {showDays ? ` · ${dayBuckets.length} dagar` : ''}
                            {past.length > 0 && past.length < events.length ? ` · ${past.length} har varit` : ''}
                        </span>
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
                    {dayBuckets.map(day => (
                        <Fragment key={day.key}>
                            {/* DAGRUBRIKEN: klistrad i scrollporten så man aldrig kan
                                scrolla in i en ny dag utan att se vilken dag raderna
                                gäller — samma grepp som stadssidornas daglista. */}
                            {showDays && (
                                <li className="sticky top-0 z-20 px-3 py-1.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm">
                                    <span className="flex items-center gap-1.5">
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#006AA7] text-white text-[11px] font-black">
                                            {day.rel && (
                                                <span className="inline-flex items-center px-1.5 rounded-full bg-[#FECC02] text-[9px] font-black uppercase tracking-wider text-slate-900">
                                                    {day.rel}
                                                </span>
                                            )}
                                            {day.label}
                                        </span>
                                        <span className="text-[10px] font-black text-slate-400 tabular-nums">{day.events.length}</span>
                                    </span>
                                </li>
                            )}
                            {day.events.map(ev => row(ev, false))}
                        </Fragment>
                    ))}
                    {/* Historik: det som redan varit ligger hopfällt längst ner. */}
                    {past.length > 0 && (
                        <li>
                            <button
                                type="button"
                                onClick={() => setPastOpen(o => !o)}
                                aria-expanded={pastOpen}
                                className="w-full px-4 py-2 flex items-center gap-1.5 text-[11px] font-black text-slate-400 hover:text-[#006AA7] transition-colors"
                            >
                                <span aria-hidden>🕐</span>
                                {past.length} har redan varit · {pastOpen ? 'Dölj' : 'Visa'}
                            </button>
                        </li>
                    )}
                    {pastOpen && pastOrdered.map(ev => row(ev, true))}
                </ul>
            </div>
        </div>
    );
}
