'use client';

import Link from 'next/link';
import { useState } from 'react';
import { PERIODS, periodKeys, type Period } from './periods';

// Klientdelen av stads-/kategorisidornas daglista. Filter i två dimensioner:
//  - DAG: Alla/Idag/Imorgon/I helgen (räknas mot användarens riktiga klocka,
//    periods.ts) + en chip per listad dag ("Lör 11/7"), + "Nästa timmen".
//  - TID: stapeldiagram över när på dagen eventen börjar — staplarna är
//    filterknappar (visar SANNA totaler per timme via hourCounts, inte bara
//    de listade raderna).
// Servern (EventDayList) har redan trimmat urvalet och förbyggt raderna till
// rena strängar. Default 'Alla' utan timval rör inget Date-anrop, så
// SSR-HTML:en är deterministisk (ingen hydreringsmiss) och hela listan
// ligger crawlbar i serverns HTML.

export type ListedEvent = {
    id: string;
    href: string;
    emoji: string;
    title: string;
    /** Färdig underrad: "kl 18.30 · Platsen · Värden" (byggd på servern). */
    meta: string;
    /** Starttimme 0–23 i svensk tid; null när eventet saknar klockslag. */
    hour: number | null;
    /** Epoch-ms — "Nästa timmen"-filtret jämför mot klientens klocka. */
    t: number;
};

export type ListedDay = {
    /** 'YYYY-MM-DD' (svensk tid) — matchas mot periodKeys. */
    key: string;
    /** T.ex. "torsdag 9 juli". */
    label: string;
    /** Chip-etikett, t.ex. "Lör 11/7". */
    short: string;
    events: ListedEvent[];
    /** Antal ytterligare event samma dag som inte fick plats i listan. */
    more: number;
    /** Antal event per starttimme 0–23 för HELA dagen (alla event, inte bara
     *  de listade) — histogrammet ska visa den sanna fördelningen. */
    hourCounts: number[];
};

type Sel =
    | { kind: 'period'; period: Period }
    | { kind: 'day'; key: string }
    | { kind: 'nextHour' };

const HOUR_MS = 3_600_000;

/** "18–20, 22" — valda timmar med sammanhängande körningar ihopslagna. */
function hourRanges(hours: number[]): string {
    const hs = [...hours].sort((a, b) => a - b);
    const parts: string[] = [];
    for (let i = 0; i < hs.length; i++) {
        let j = i;
        while (j + 1 < hs.length && hs[j + 1] === hs[j] + 1) j++;
        parts.push(i === j ? `${hs[i]}` : `${hs[i]}–${hs[j]}`);
        i = j;
    }
    return parts.join(', ');
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={active}
            className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-black transition-colors border ${
                active
                    ? 'bg-[#006AA7] border-[#006AA7] text-white'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-[#006AA7]/40 hover:text-[#006AA7]'
            }`}
        >
            {label}
        </button>
    );
}

export default function DayFilteredList({ days, restCount, cityName }: {
    days: ListedDay[];
    restCount: number;
    cityName: string;
}) {
    const [sel, setSel] = useState<Sel>({ kind: 'period', period: 'all' });
    // Valda timstaplar. Behålls när man byter dag — "kvällsfiltret" följer med.
    const [hours, setHours] = useState<number[]>([]);

    const dayKeys = sel.kind === 'period' ? periodKeys(sel.period)
        : sel.kind === 'day' ? [sel.key]
        : null; // Nästa timmen: alla dagar, raderna filtreras på klockslaget.
    const visDays = dayKeys ? days.filter(d => dayKeys.includes(d.key)) : days;

    const now = sel.kind === 'nextHour' ? Date.now() : 0;
    const rowMatch = (e: ListedEvent) =>
        sel.kind === 'nextHour' ? e.t >= now && e.t < now + HOUR_MS
        : hours.length ? e.hour !== null && hours.includes(e.hour)
        : true;
    const shownDays = visDays
        .map(d => ({ ...d, shown: d.events.filter(rowMatch) }))
        .filter(d => d.shown.length > 0);

    // Histogram = summan av de visade dagarnas hourCounts (sanna totaler).
    const hist = Array.from({ length: 24 }, (_, h) => visDays.reduce((s, d) => s + (d.hourCounts[h] ?? 0), 0));
    const histMax = Math.max(...hist, 1);
    let lo = 7, hi = 22;
    for (let h = 0; h < 7; h++) if (hist[h] > 0) { lo = h; break; }
    if (hist[23] > 0) hi = 23;
    const barHours: number[] = [];
    for (let h = lo; h <= hi; h++) barHours.push(h);
    const showHist = sel.kind !== 'nextHour' && hist.some(c => c > 0);

    const toggleHour = (h: number) =>
        setHours(prev => (prev.includes(h) ? prev.filter(x => x !== h) : [...prev, h]));

    const selDayLabel = sel.kind === 'day' ? (days.find(d => d.key === sel.key)?.label ?? 'den dagen') : null;
    const unit = sel.kind === 'period'
        ? (sel.period === 'all' ? 'just nu' : PERIODS.find(p => p.key === sel.period)!.unit)
        : '';
    const emptyPhrase = sel.kind === 'nextHour'
        ? 'den närmaste timmen'
        : `${hours.length ? `kl ${hourRanges(hours)} ` : ''}${selDayLabel ?? unit}`;
    // Sant antal event vid timfilter (hourCounts) — så tomläget kan säga
    // "de finns, men ryms inte i listan" i stället för att se tomt ut.
    const hiddenTotal = hours.length && sel.kind !== 'nextHour'
        ? visDays.reduce((s, d) => s + hours.reduce((x, h) => x + (d.hourCounts[h] ?? 0), 0), 0)
        : 0;

    return (
        <div className="mt-9">
            {/* Dagval: perioder + Nästa timmen + en chip per listad dag.
                Dagchipsen hoppar över de två första dagarna (= Idag/Imorgon
                vid färsk deploy — dubbletter av period-chipsen). */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                {PERIODS.map(p => (
                    <Chip
                        key={p.key}
                        label={p.label}
                        active={sel.kind === 'period' && sel.period === p.key}
                        onClick={() => setSel({ kind: 'period', period: p.key })}
                    />
                ))}
                <Chip
                    label="Nästa timmen"
                    active={sel.kind === 'nextHour'}
                    onClick={() => { setSel({ kind: 'nextHour' }); setHours([]); }}
                />
                <span className="shrink-0 mx-1 h-5 w-px bg-slate-200" aria-hidden />
                {days.slice(2).map(d => (
                    <Chip
                        key={d.key}
                        label={d.short}
                        active={sel.kind === 'day' && sel.key === d.key}
                        onClick={() => setSel({ kind: 'day', key: d.key })}
                    />
                ))}
            </div>

            {/* Timfilter: staplar = antal event per starttimme (vald dag/period). */}
            {showHist && (
                <div className="mt-4">
                    <div className="flex items-baseline justify-between gap-2">
                        <p className="text-[11px] font-bold text-slate-400">
                            När på dagen? Tryck på staplarna för att filtrera.
                        </p>
                        {hours.length > 0 && (
                            <button
                                type="button"
                                onClick={() => setHours([])}
                                className="shrink-0 text-[11px] font-black text-[#006AA7] hover:underline"
                            >
                                kl {hourRanges(hours)} · Rensa ✕
                            </button>
                        )}
                    </div>
                    <div className="mt-1.5 flex items-end gap-[3px]">
                        {barHours.map(h => {
                            const c = hist[h];
                            const on = hours.includes(h);
                            return (
                                <button
                                    key={h}
                                    type="button"
                                    onClick={() => toggleHour(h)}
                                    disabled={c === 0}
                                    aria-pressed={on}
                                    aria-label={`kl ${h}: ${c} event`}
                                    title={`kl ${h}: ${c} event`}
                                    className="flex-1 min-w-0 flex flex-col items-center gap-0.5 group disabled:cursor-default"
                                >
                                    <span
                                        aria-hidden
                                        className={`w-full rounded-t transition-colors ${
                                            on ? 'bg-[#006AA7]'
                                            : c > 0 ? 'bg-slate-300 group-hover:bg-[#006AA7]/50'
                                            : 'bg-slate-100'
                                        }`}
                                        style={{ height: c > 0 ? Math.max(5, Math.round((c / histMax) * 44)) : 2 }}
                                    />
                                    <span
                                        aria-hidden
                                        className={`text-[9px] font-bold tabular-nums ${on ? 'text-[#006AA7]' : 'text-slate-400'}`}
                                    >
                                        {h % 3 === 0 ? String(h).padStart(2, '0') : ' '}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            <div className="mt-6 flex flex-col gap-8">
                {shownDays.map(day => {
                    // Sant antal ytterligare event: vid timfilter vet vi dagens
                    // totaler per timme; "Nästa timmen" kan inte veta (byggtid).
                    const extra = hours.length && sel.kind !== 'nextHour'
                        ? Math.max(0, hours.reduce((s, h) => s + (day.hourCounts[h] ?? 0), 0) - day.shown.length)
                        : sel.kind === 'nextHour' ? 0 : day.more;
                    return (
                        <section key={day.key}>
                            <h2 className="text-base font-black text-slate-900 mb-2 capitalize">{day.label}</h2>
                            <ul className="flex flex-col gap-1.5">
                                {day.shown.map(e => (
                                    <li key={e.id}>
                                        <Link
                                            href={e.href}
                                            className="flex items-start gap-3 rounded-xl bg-white border border-slate-200 px-4 py-3 hover:border-[#006AA7]/40 hover:shadow-sm transition-all"
                                        >
                                            <span className="text-xl leading-none mt-0.5" aria-hidden>{e.emoji}</span>
                                            <span className="min-w-0">
                                                <span className="block text-sm font-bold text-slate-900 leading-snug">{e.title}</span>
                                                <span className="block text-xs text-slate-500 font-medium mt-0.5">{e.meta}</span>
                                            </span>
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                            {extra > 0 && (
                                <p className="mt-2 text-xs font-bold text-slate-400">
                                    + {extra} till {hours.length ? `kl ${hourRanges(hours)} ` : ''}denna dag —{' '}
                                    <Link href="/" className="text-[#006AA7]">se dem på kartan</Link>
                                </p>
                            )}
                        </section>
                    );
                })}
            </div>

            {shownDays.length === 0 && (
                <p className="mt-6 text-sm font-bold text-slate-500">
                    {hiddenTotal > 0 ? (
                        <>
                            {hiddenTotal} event {emptyPhrase} i {cityName} — de ryms inte i listan här.{' '}
                            <Link href="/" className="text-[#006AA7]">Se dem på kartan</Link>
                        </>
                    ) : (
                        <>
                            Inga listade event {emptyPhrase} i {cityName}.{' '}
                            <Link href="/" className="text-[#006AA7]">Se hela utbudet på kartan</Link>
                        </>
                    )}
                </p>
            )}

            {sel.kind === 'period' && sel.period === 'all' && hours.length === 0 && restCount > 0 && (
                <p className="mt-8 text-sm font-bold text-slate-500">
                    …och {restCount} evenemang längre fram.{' '}
                    <Link href="/" className="text-[#006AA7]">Utforska hela utbudet på kartan</Link>
                </p>
            )}
        </div>
    );
}
