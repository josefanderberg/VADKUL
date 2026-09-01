'use client';

import { Fragment, useState } from 'react';
import { ChevronRight, Clock } from 'lucide-react';
import { LinkEvent } from '../../types';
import { eventEmoji, isEventPast } from './v2MapBricka';
import { EVENT_CATEGORIES, EventCategoryType } from '@/utils/categories';
import { nearestCityPoint } from '@/utils/cityPoints';

// ── Gruppväljaren i EVENTKORTET ─────────────────────────────────────────────
// Ersätter multi-event-listan som svävade över kartan (V2MapGroupList,
// borttagen 31/8 kväll på ägarbeslut): klickar man en bricka med FLERA event
// på samma koordinat byts EVENTKORTETS INNEHÅLL ut mot den här listan (emoji +
// titel + tid per rad) tills man valt — radklicket väljer eventet och kortet
// visar det som vanligt (sidan nollar groupChoice i onPickFromGroup).
// Ingen nästa-knapp/räknare som i gamla panelen: här finns plats att se och
// scrolla hela listan, så man pekar direkt på det man vill ha.
//
// DAGRUBRIKER: när man tittar på hela veckan kan en scen ha 30+ event i högen
// och då räcker inte klockslaget — man måste se VILKEN DAG raden gäller. Listan
// grupperas därför per dag med klistrade dagrubriker, precis som daglistan på
// stadssidorna (/evenemang/<stad>): blå pille med veckodag + datum, gul
// "Idag"/"Imorgon"-badge, antal event i dagen. Är hela högen samma dag (vanligt
// i dagsläget) ritas INGA rubriker.
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

interface EventCardGroupListProps {
    /** Eventen på platsen (väljaren visas bara vid > 1). */
    events: LinkEvent[];
    /** Kartans valda (representativa) event — raden markeras så man ser vilken
     *  frame brickan stod på när man klickade. */
    selectedEvent: LinkEvent | null;
    /** Radklicket = valet. Sidan väljer eventet OCH stänger väljarläget. */
    onSelect: (ev: LinkEvent) => void;
}

export default function EventCardGroupList({ events, selectedEvent, onSelect }: EventCardGroupListProps) {
    // Passerade event ligger hopfällda tills man ber om dem.
    const [pastOpen, setPastOpen] = useState(false);

    // Kommande event överst (kronologiskt, dag för dag), passerade sist —
    // dämpade med "har varit" (samma isEventPast som kartans dämpning: start
    // + 1 h, kl 20 för event utan klockslag). Passerade rader går fortfarande
    // att klicka (medvetet val).
    const nowMs = Date.now();
    const upcoming = events.filter(ev => !isEventPast(ev, nowMs));
    const past = events.filter(ev => isEventPast(ev, nowMs));
    const dayBuckets = bucketByDay(upcoming, nowMs);
    const pastOrdered = bucketByDay(past, nowMs).flatMap(b => b.events);
    // Dagrubriker bara när högen faktiskt spänner över flera dagar (annars är
    // de bara brus — alla rader hör ju ändå till samma dag).
    const showDays = dayBuckets.length > 1;

    // PLATSRUBRIKEN: alla event i gruppen delar koordinat, men INTE nödvändigt-
    // vis lokal — event som bara geokodats till orten hamnar i samma hög mitt i
    // stan, och då är första eventets locationName ("Rotary Göteborg-City") en
    // lögn om de övriga 13 (Josef 27/8). Bara när HELA högen delar samma namn
    // är det en riktig lokal och namnet visas; annars räcker orten: närmsta
    // CITY_POINTS-ort, samma uppslag som stadsnamnet högst upp på kartan.
    const firstName = events[0]?.locationName?.trim() || '';
    const sharedVenue = firstName !== '' && events.every(ev => (ev.locationName?.trim() || '') === firstName);
    const placeName = sharedVenue ? firstName : nearestCityPoint(events[0].lat, events[0].lng).name;

    // En eventrad: emoji, titel, klockslag · kategorinamn (+ "har varit" på
    // passerade). Kategorinamnet till höger om klockslaget (Josef 26/8) —
    // samma nyckelupplösning som eventEmoji: okänd/utebliven kategori → Övrigt.
    const row = (ev: LinkEvent, isPast: boolean) => {
        const tid = ev.time && ev.hasSpecificTime !== false
            ? ev.time.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })
            : '';
        const catKey = (ev.category && ev.category in EVENT_CATEGORIES ? ev.category : 'other') as EventCategoryType;
        const catLabel = EVENT_CATEGORIES[catKey].label;
        const isSel = selectedEvent?.id === ev.id;
        return (
            <li key={ev.id}>
                <button
                    type="button"
                    onClick={() => onSelect(ev)}
                    // Markerad rad = blå med vit kant (ring-inset, ingen layout-
                    // shift) — samma "vald = vit-kantad" som markören på kartan,
                    // så man ser vilken frame brickan stod på. Passerad rad
                    // dämpas (samma 50 % som kartans nål-prickar).
                    className={`relative w-full text-left px-4 py-3 flex items-center gap-3 transition-colors ${isSel ? 'bg-[#006AA7] ring-2 ring-inset ring-white z-10' : 'hover:bg-slate-50 dark:hover:bg-slate-800 active:bg-slate-100 dark:active:bg-slate-700'}${isPast && !isSel ? ' opacity-50' : ''}`}
                >
                    <span className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-lg leading-none ${isSel ? 'bg-white/20' : 'bg-slate-100 dark:bg-slate-800'}`} aria-hidden>{eventEmoji(ev)}</span>
                    <span className="flex-1 min-w-0">
                        <span className={`block font-bold text-sm truncate ${isSel ? 'text-white' : 'text-slate-800 dark:text-slate-100'}`}>{ev.title}</span>
                        <span className={`flex items-center gap-1 text-[11px] font-semibold ${isSel ? 'text-white/80' : 'text-slate-500 dark:text-slate-400'}`}>
                            {tid && <Clock size={10} className="shrink-0" />}
                            {tid && <span className="shrink-0 tabular-nums">{`kl ${tid}`}</span>}
                            <span className="min-w-0 truncate">{tid ? `· ${catLabel}` : catLabel}</span>
                            {isPast && <span className="shrink-0">· har varit</span>}
                        </span>
                    </span>
                    <ChevronRight size={16} className={`shrink-0 ${isSel ? 'text-white' : 'text-slate-400'}`} />
                </button>
            </li>
        );
    };

    return (
        // Vanligt blockinnehåll i kortets scrollcontainer — kortets sheet äger
        // höjd/drag/scroll. pt-8 lyfter rubriken under drag-indikatorn som
        // ligger absolut överst i kortet.
        <div className="pt-8">
            <div className="flex items-center gap-2 px-4 pb-2.5 border-b border-slate-200/70 dark:border-slate-700/70">
                <div className="min-w-0 flex-1">
                    <span className="block text-base font-black text-slate-800 dark:text-slate-100 truncate leading-tight">{placeName}</span>
                    <span className="block text-[10px] font-black uppercase tracking-widest text-slate-400 leading-tight">
                        {events.length} event på samma plats
                        {showDays ? ` · ${dayBuckets.length} dagar` : ''}
                        {past.length > 0 && past.length < events.length ? ` · ${past.length} har varit` : ''}
                    </span>
                </div>
            </div>
            <p className="px-4 pt-2 pb-1 text-[11px] font-bold text-slate-400">
                Välj vilket event du vill öppna:
            </p>
            {/* Klistrade dagrubriker klistrar mot kortets scrollcontainer
                (närmsta scrollande förälder) — samma grepp som stadssidornas
                daglista. */}
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {dayBuckets.map(day => (
                    <Fragment key={day.key}>
                        {showDays && (
                            <li className="sticky top-0 z-20 px-3 py-1.5 bg-card">
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
    );
}
