'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, useTransition, type ReactNode } from 'react';
import { Heart, MapPin, Clock, Ticket, Users } from 'lucide-react';
import { PERIODS, periodKeys, relativeDayLabel } from './periods';
import { NO_TIME_PAST_HOUR } from '@/components/v2/v2MapBricka';
import { useDayFilter } from './dayFilter';

// Klientdelen av stads-/kategorisidornas eventsektion. Filterraden ligger
// ÖVERST och styr allt under den (kategorichipsen och daglistan).
// Filter i två dimensioner:
//  - DAG: Alla/Idag/Imorgon/I veckan (räknas mot användarens riktiga klocka,
//    periods.ts) + en chip per listad dag ("Lör 11/7").
//    ("Nästa timmen"-chippen borttagen 18/8, ägarbeslut: onödig.)
//  - TID: stapeldiagram över när på dagen eventen börjar — staplarna är
//    filterknappar (visar SANNA totaler per timme via hourCounts, inte bara
//    de listade raderna).
// Dessutom:
//  - FRÅN NU OCH FRAMÅT: event som redan varit (startade >1 h sedan; utan
//    klockslag: efter kl 20 — samma gränser som kartans "har varit") göms
//    bakom en "har redan varit"-knapp
//    per dag. nowTs sätts först EFTER mount — SSR-HTML:en innehåller hela
//    listan (crawlbar) och är deterministisk (ingen hydreringsmiss).
//  - HJÄRTAN: varje rad har en spara-knapp längst till höger. Samma
//    localStorage-nyckel som kartan ('vadkul_saved_events') — sparade event
//    dyker upp i kartans Sparat-panel.
// Servern (EventDayList) har förbyggt raderna till rena strängar; varje listad
// dag innehåller ALLA sina event. Default-filtret är 'Alla', och dag-
// filtreringen slår till först EFTER mount (nowTs) — SSR-HTML:en visar hela
// listan (deterministisk + crawlbar) och hydreringen matchar.
//  - DAG-FÖR-DAG-AVTÄCKNING: efter mount renderas dagarna en i taget — nästa
//    dag monteras först när man scrollar nära listans slut (sentinel +
//    scroll-lyssnare). Pre-mount renderas alla dagar (crawlbart); filterbyte
//    nollställer avtäckningen.

export type ListedEvent = {
    id: string;
    href: string;
    emoji: string;
    title: string;
    /** Färdig underrad: "kl 18.30 · Platsen · Värden" (byggd på servern). */
    meta: string;
    /** Omslagsbild — finns → raden ritas som bildkort (som eventkortets
     *  närhetslista); saknas → kompakt emoji-rad. */
    coverImage?: string;
    /** Platsnamn för inforaden. */
    place: string;
    /** Klockslag "18.30", eller null för event utan specifik tid. */
    clock: string | null;
    /** Normaliserad prisetikett ("120 kr"/"Gratis"), eller null. */
    price: string | null;
    /** Antal anmälda (0 = dölj). */
    attendees: number;
    /** Starttimme 0–23 i svensk tid; null när eventet saknar klockslag. */
    hour: number | null;
    /** Epoch-ms — "har varit"-historiken jämför mot klientens klocka. */
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
    /** Antal event per starttimme 0–23 för dagen — histogrammets staplar. */
    hourCounts: number[];
};

// Urvals-typen (dag/period/nästa timmen) bor numera i dayFilter.tsx (DaySel)
// — staten delas med kart-heron via DayFilterProvider.

const HOUR_MS = 3_600_000;
// Samma nyckel som kartan — hjärtan här hamnar i kartans Sparat-panel.
const SAVED_KEY = 'vadkul_saved_events';

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

// Tidsstatus för en rad (samma trappa som eventkortets NearbyRow): beräknas
// mot klientens klocka (nowTs) och får därför bara köras EFTER mount.
type RowStatus = 'past' | 'ongoing' | 'soon' | 'within3' | 'within5' | 'later' | 'today';
function statusOf(e: { hour: number | null; t: number }, now: number): RowStatus {
    if (e.hour === null) {
        // Utan klockslag: neutral "Idag" fram till kl 20, sedan "har varit".
        const cutoff = new Date(e.t); cutoff.setHours(NO_TIME_PAST_HOUR, 0, 0, 0);
        if (now >= cutoff.getTime()) return 'past';
        const sameDay = new Date(e.t).toDateString() === new Date(now).toDateString();
        return sameDay ? 'today' : 'later';
    }
    const end = e.t + HOUR_MS;
    if (now >= end) return 'past';
    if (now >= e.t) return 'ongoing';
    const until = e.t - now;
    if (until <= HOUR_MS) return 'soon';
    if (until <= 3 * HOUR_MS) return 'within3';
    if (until <= 5 * HOUR_MS) return 'within5';
    return 'later';
}

function StatusBadge({ status }: { status: RowStatus }) {
    if (status === 'later') return null;
    const cfg = {
        ongoing: { label: 'Pågår', cls: 'bg-emerald-500 text-white' },
        today: { label: 'Idag', cls: 'bg-emerald-300 text-emerald-900' },
        soon: { label: 'Snart', cls: 'bg-amber-500 text-white' },
        within3: { label: 'Inom 3h', cls: 'bg-amber-300 text-amber-900' },
        within5: { label: 'Inom 5h', cls: 'bg-sky-300 text-sky-900' },
        past: { label: 'Har varit', cls: 'bg-slate-300 text-slate-700' },
    }[status];
    return (
        <span className={`inline-flex items-center text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full whitespace-nowrap shrink-0 ${cfg.cls}`}>
            {cfg.label}
        </span>
    );
}

/** Omslagsbild som laddas FÖRST när raden scrollats fram (IntersectionObserver)
 *  — samma lata beteende som eventkortets närhetslista. Fast höjd via className
 *  så inget hoppar; trasig länk rapporteras via onFailed (→ bildlös layout). */
function LazyRowImage({ src, className, onFailed }: {
    src: string; className?: string; onFailed?: () => void;
}) {
    const holderRef = useRef<HTMLDivElement>(null);
    const [inView, setInView] = useState(false);
    useEffect(() => {
        const el = holderRef.current;
        if (!el || typeof IntersectionObserver === 'undefined') return;
        const io = new IntersectionObserver(entries => {
            if (entries.some(en => en.isIntersecting)) { setInView(true); io.disconnect(); }
        }, { rootMargin: '150px' });
        io.observe(el);
        return () => io.disconnect();
    }, []);
    return (
        <div ref={holderRef} className={`overflow-hidden bg-slate-200 ${className ?? ''}`}>
            {inView && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                    src={src}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    referrerPolicy="no-referrer"
                    onError={onFailed}
                    className="w-full h-full object-cover animate-in fade-in duration-300"
                />
            )}
        </div>
    );
}

function EventRow({ e, dimmed, isSaved, onToggleSave, nowTs }: {
    e: ListedEvent;
    dimmed?: boolean;
    isSaved: boolean;
    onToggleSave: (id: string) => void;
    nowTs: number;
}) {
    const [imgFailed, setImgFailed] = useState(false);
    const hasImage = !!e.coverImage && !imgFailed;
    // Statusbadgen är klockberoende → bara efter mount (deterministisk SSR).
    const status = nowTs === 0 ? null : statusOf(e, nowTs);

    // Inforad (plats · tid · pris · antal) — samma stil/ikoner som eventkortets
    // närhetslista. Allt är server-strängar → deterministiskt vid SSR.
    const infoRow = (
        <div className="flex items-center gap-x-2 text-[11px] font-bold text-slate-500 overflow-hidden">
            <span className="inline-flex items-center gap-1 min-w-0">
                <MapPin size={11} className="text-[#006AA7] shrink-0" />
                <span className="truncate">{e.place}</span>
            </span>
            {e.clock && (
                <span className="inline-flex items-center gap-1 shrink-0 whitespace-nowrap">
                    <Clock size={11} className="text-[#006AA7]" />
                    kl {e.clock}
                </span>
            )}
            {e.price && (
                <span className="inline-flex items-center gap-1 shrink-0 whitespace-nowrap">
                    <Ticket size={11} className="text-[#006AA7]" />
                    {e.price}
                </span>
            )}
            {e.attendees > 0 && (
                <span className="inline-flex items-center gap-1 shrink-0 whitespace-nowrap">
                    <Users size={11} className="text-[#006AA7]" />
                    {e.attendees} kommer
                </span>
            )}
        </div>
    );

    // MED bild: omslagsbild kant till kant, titel + emoji + statusbadge överlagd
    // på en mörk gradient, inforaden under — spara-hjärtat överlagrat uppe till
    // höger (utanför Link:en så det inte navigerar).
    // content-visibility:auto på raderna: rader utanför viewporten kostar
    // ingen layout/paint (stora listor = stor INP/LCP-vinst på mobil);
    // contain-intrinsic-size håller scrollhöjden någorlunda stabil.
    if (hasImage) {
        return (
            <li data-event-id={e.id} className={`relative overflow-hidden rounded-xl bg-white border border-slate-200 hover:border-[#006AA7]/40 hover:shadow-sm transition-all [content-visibility:auto] [contain-intrinsic-size:auto_10rem] ${dimmed ? 'opacity-55' : ''}`}>
                <Link href={e.href} className="block">
                    <div className="relative">
                        <LazyRowImage src={e.coverImage!} className="h-28" onFailed={() => setImgFailed(true)} />
                        <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 px-4 pb-2 pt-8 bg-gradient-to-t from-black/75 via-black/35 to-transparent">
                            <span className="text-lg leading-none shrink-0 drop-shadow" aria-hidden>{e.emoji}</span>
                            <h4 className="flex-1 min-w-0 font-black text-sm text-white truncate [text-shadow:0_1px_2px_rgba(0,0,0,0.8)]">{e.title}</h4>
                            {status && <StatusBadge status={status} />}
                        </div>
                    </div>
                    <div className="px-4 py-2">{infoRow}</div>
                </Link>
                <button
                    type="button"
                    onClick={() => onToggleSave(e.id)}
                    aria-pressed={isSaved}
                    aria-label={isSaved ? 'Ta bort från sparade' : 'Spara eventet'}
                    title={isSaved ? 'Sparat — finns under ♥ på kartan' : 'Spara eventet'}
                    className={`absolute top-2 right-2 z-10 flex items-center justify-center w-8 h-8 rounded-full bg-white/90 backdrop-blur shadow transition-colors ${
                        isSaved ? 'text-rose-500' : 'text-slate-400 hover:text-rose-400'
                    }`}
                >
                    <Heart size={16} fill={isSaved ? 'currentColor' : 'none'} />
                </button>
            </li>
        );
    }

    // UTAN bild: kompakt rad — emoji-bricka, titel + statusbadge, inforad under.
    return (
        <li data-event-id={e.id} className={`flex items-stretch rounded-xl bg-white border border-slate-200 hover:border-[#006AA7]/40 hover:shadow-sm transition-all [content-visibility:auto] [contain-intrinsic-size:auto_4.5rem] ${dimmed ? 'opacity-55' : ''}`}>
            <Link href={e.href} className="flex-1 min-w-0 flex items-start gap-3 pl-4 py-3">
                <span className="shrink-0 w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-lg leading-none mt-0.5" aria-hidden>{e.emoji}</span>
                <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900 leading-snug truncate">{e.title}</span>
                        {status && <StatusBadge status={status} />}
                    </span>
                    <span className="block mt-1">{infoRow}</span>
                </span>
            </Link>
            <button
                type="button"
                onClick={() => onToggleSave(e.id)}
                aria-pressed={isSaved}
                aria-label={isSaved ? 'Ta bort från sparade' : 'Spara eventet'}
                title={isSaved ? 'Sparat — finns under ♥ på kartan' : 'Spara eventet'}
                className={`shrink-0 flex items-center px-3.5 rounded-r-xl transition-colors ${
                    isSaved ? 'text-rose-500' : 'text-slate-300 hover:text-rose-400'
                }`}
            >
                <Heart size={17} fill={isSaved ? 'currentColor' : 'none'} />
            </button>
        </li>
    );
}

export default function DayFilteredList({ days, restCount, cityName, children }: {
    days: ListedDay[];
    restCount: number;
    cityName: string;
    /** Renderas mellan filterraden och daglistan (t.ex. kategorichips). */
    children?: ReactNode;
}) {
    // Urval + timstaplar bor i det DELADE dagfiltret (dayFilter.tsx) så att
    // kart-heron ovanför visar samma dag som listan. Timvalen behålls när man
    // byter dag — "kvällsfiltret" följer med.
    const { sel, setSel, hours, setHours, focus, clearFocus } = useDayFilter();
    // Alla filterbyten (och mount-kollapsen nedan) renderar om stora listor —
    // som transitions är omrenderingen avbrytbar och blockerar aldrig tappen
    // (INP på mobil låg >500 ms när hela dagslistan ritades i klick-handlern).
    const [, startTransition] = useTransition();
    // Sparade event (hjärtan) + klockan. Båda sätts efter mount så att
    // SSR-HTML:en är deterministisk; innan dess är inget sparat/passerat.
    const [saved, setSaved] = useState<Set<string>>(new Set());
    const [nowTs, setNowTs] = useState(0);
    // Dagar vars "har redan varit"-sektion är uppfälld.
    const [openPast, setOpenPast] = useState<Set<string>>(new Set());
    // Dag-för-dag-avtäckning (se filhuvudet): antal dagar som renderats.
    // Gäller först efter mount (nowTs) — pre-mount renderas alla dagar.
    const [revealed, setRevealed] = useState(1);
    const sentinelRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        try {
            setSaved(new Set(JSON.parse(localStorage.getItem(SAVED_KEY) ?? '[]') as string[]));
        } catch { /* trasig post — börja med tom lista */ }
        // Kollapsen från SSR:ens ALLA dagar (kan vara 1000+ rader) till
        // dag-för-dag-avtäckningen är sidans tyngsta omrendering — körd som
        // transition kan React avbryta den för en inkommande tapp i stället
        // för att blockera tråden direkt efter hydreringen.
        startTransition(() => setNowTs(Date.now()));
    }, []);

    const toggleSave = (id: string) =>
        setSaved(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            try { localStorage.setItem(SAVED_KEY, JSON.stringify([...next])); } catch { /* privat läge */ }
            return next;
        });

    // "Har varit" = specifikt klockslag som passerade för >1 h sedan, eller —
    // för event utan klockslag (midnatt = bara datum från källan) — kl 20 sin
    // dag. Samma gränser som kartans isEventPast (NO_TIME_PAST_HOUR).
    const isPast = (e: { hour: number | null; t: number }) => {
        if (nowTs === 0) return false;
        if (e.hour !== null) return e.t < nowTs - HOUR_MS;
        return new Date(e.t).setHours(NO_TIME_PAST_HOUR, 0, 0, 0) <= nowTs;
    };

    // Period-dagfiltret räknas mot användarens RIKTIGA klocka (periodKeys →
    // new Date()) och får därför inte köras vid SSR/första klient-rendern —
    // annars skiljer sig byggdagens "idag" från besökarens och hydreringen
    // spricker (+ server-HTML:en skulle bara innehålla byggdagens event, inte
    // hela den crawlbara listan). Före mount (nowTs === 0) behandlas perioden
    // som 'Alla' (null) — vilket med default 'Alla' är samma urval efter mount.
    const periodReady = nowTs !== 0;
    const dayKeys = sel.kind === 'period' ? (periodReady ? periodKeys(sel.period) : null)
        : [sel.key];
    const visDays = dayKeys ? days.filter(d => dayKeys.includes(d.key)) : days;

    const rowMatch = (e: ListedEvent) =>
        hours.length ? e.hour !== null && hours.includes(e.hour) : true;
    // Från nu och framåt: passerade rader göms bakom "har redan varit".
    const shownDays = visDays
        .map(d => {
            const rows = d.events.filter(rowMatch);
            return { ...d, upcoming: rows.filter(e => !isPast(e)), past: rows.filter(isPast) };
        })
        .filter(d => d.upcoming.length > 0 || d.past.length > 0);

    // Dag-för-dag-avtäckningen: pre-mount (nowTs 0) renderas ALLT — serverns
    // HTML ska vara hel och crawlbar. Efter mount renderas `revealed` dagar;
    // sentineln under listan fyller på nästa dag när den scrollas inom räckhåll.
    const dayLimit = nowTs === 0 ? shownDays.length : revealed;
    const renderDays = shownDays.slice(0, dayLimit);
    const hasMoreDays = renderDays.length < shownDays.length;

    // Filterbyte → börja om från första dagen i det nya urvalet.
    useEffect(() => { setRevealed(1); }, [sel, hours]);

    // ── Fokus från kartan ─────────────────────────────────────────────────
    // Kart-popupens klick har redan valt eventets dag (requestFocus i
    // dayFilter.tsx) — här återstår att scrolla till raden och blinka den.
    // Effekten är ren DOM-synk (ingen state) och körs varje render tills
    // raden dykt upp (dagbytet är en transition och kan ta ett varv);
    // noncen ser till att varje begäran bara hanteras en gång.
    const handledFocusRef = useRef(0);
    useEffect(() => {
        if (!focus || handledFocusRef.current === focus.nonce) return;
        const el = document.querySelector(`[data-event-id="${CSS.escape(focus.id)}"]`);
        if (!el) return;
        handledFocusRef.current = focus.nonce;
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('event-row-flash');
        const t = window.setTimeout(() => {
            el.classList.remove('event-row-flash');
            // Var det fokuserade eventet ett passerat sådant hölls "har varit"
            // uppe av derivatet nedan — persistera uppfällningen INNAN fokus
            // släpps, annars slår sektionen igen mitt framför ögonen på en.
            const day = days.find(d => d.key === focus.dayKey);
            const ev = day?.events.find(e => e.id === focus.id);
            if (ev && isPast(ev)) setOpenPast(prev => new Set(prev).add(focus.dayKey));
            clearFocus();
        }, 2600);
        return () => clearTimeout(t);
    });

    // Nästa dag monteras när sentineln ligger OVANFÖR laddlinjen (viewport-
    // botten + 700 px) — "ovanför" i stället för "inom" så att en snabb
    // scroll förbi (t.ex. rakt till sidfoten, ~1700 px under sentineln) inte
    // parkerar den utanför räckhåll och låser listan (IntersectionObserver
    // med rootMargin gjorde precis det). `done` = max EN dag per varv;
    // effekten körs om efter varje reveal och check():en direkt vid setup
    // ger kaskaden som fyller skärmen utan scroll. Utan fler dagar renderas
    // ingen sentinel (el null) och effekten är passiv.
    useEffect(() => {
        if (!hasMoreDays) return;
        let done = false;
        const check = () => {
            const el = sentinelRef.current;
            if (!el || done) return;
            if (el.getBoundingClientRect().top < window.innerHeight + 700) {
                done = true;
                setRevealed(r => r + 1);
            }
        };
        check();
        window.addEventListener('scroll', check, { passive: true });
        window.addEventListener('resize', check);
        return () => {
            window.removeEventListener('scroll', check);
            window.removeEventListener('resize', check);
        };
    }, [revealed, hasMoreDays, sel, hours]);

    // Histogram = summan av de visade dagarnas hourCounts (sanna totaler).
    const hist = Array.from({ length: 24 }, (_, h) => visDays.reduce((s, d) => s + (d.hourCounts[h] ?? 0), 0));
    const histMax = Math.max(...hist, 1);
    let lo = 7, hi = 22;
    for (let h = 0; h < 7; h++) if (hist[h] > 0) { lo = h; break; }
    if (hist[23] > 0) hi = 23;
    const barHours: number[] = [];
    for (let h = lo; h <= hi; h++) barHours.push(h);
    const showHist = hist.some(c => c > 0);

    const toggleHour = (h: number) =>
        startTransition(() => setHours(prev => (prev.includes(h) ? prev.filter(x => x !== h) : [...prev, h])));
    const togglePast = (key: string) =>
        setOpenPast(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key); else next.add(key);
            return next;
        });

    const selDayLabel = sel.kind === 'day' ? (days.find(d => d.key === sel.key)?.label ?? 'den dagen') : null;
    const unit = sel.kind === 'period'
        ? (sel.period === 'all' ? 'just nu' : PERIODS.find(p => p.key === sel.period)!.unit)
        : '';
    const emptyPhrase = `${hours.length ? `kl ${hourRanges(hours)} ` : ''}${selDayLabel ?? unit}`;

    return (
        <div className="mt-7">
            {/* Dagval: perioder + en chip per listad dag. Dagchipsen hoppar
                över de två första dagarna (= Idag/Imorgon vid färsk deploy —
                dubbletter av period-chipsen). ("Nästa timmen"-chippen som låg
                efter perioderna är borttagen 18/8, ägarbeslut: onödig.) */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                {PERIODS.map(p => (
                    <Chip
                        key={p.key}
                        label={p.label}
                        active={sel.kind === 'period' && sel.period === p.key}
                        onClick={() => startTransition(() => setSel({ kind: 'period', period: p.key }))}
                    />
                ))}
                <span className="shrink-0 mx-1 h-5 w-px bg-slate-200" aria-hidden />
                {days.slice(2).map(d => (
                    <Chip
                        key={d.key}
                        label={d.short}
                        active={sel.kind === 'day' && sel.key === d.key}
                        onClick={() => startTransition(() => setSel({ kind: 'day', key: d.key }))}
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
                                onClick={() => startTransition(() => setHours([]))}
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
            {children}

            <div className="mt-6 flex flex-col gap-10">
                {renderDays.map((day, di) => {
                    // Kart-fokus på ett redan-passerat event: fäll upp dagens
                    // "har varit"-sektion automatiskt (deriverat — annars
                    // finns raden inte i DOM:en när scrollen letar).
                    const pastOpen = openPast.has(day.key)
                        || (!!focus && focus.dayKey === day.key && day.past.some(e => e.id === focus.id));
                    // "Idag"/"Imorgon" är klockberoende → bara efter mount.
                    const rel = nowTs === 0 ? null : relativeDayLabel(day.key);
                    return (
                        <section key={day.key}>
                            {/* DAGRUBRIKEN: klistrad under toppnaven (57 px) så länge
                                dagens egna rader rullar förbi, och knuffas sedan upp
                                av nästa dags rubrik. Man ska aldrig kunna scrolla in
                                i en ny dag utan att se vilken dag man är på. Bakgrunden
                                går ut till kolumnens kanter (-mx-5 px-5) så raderna
                                inte skymtar bakom rubriken när de passerar. */}
                            {/* Avgränsare mot dagen ovanför — ligger UTANFÖR den
                                klistrade rutan så den rullar bort som vanligt
                                (annars hänger en lös linje kvar under naven).
                                Första dagen har filterraden över sig i stället. */}
                            {di > 0 && <span aria-hidden className="block mb-3 h-px bg-slate-200" />}
                            <div className="sticky top-[57px] z-20 -mx-5 px-5 pt-2 pb-2.5 bg-slate-50/95 backdrop-blur-sm">
                                <h2 className="flex items-center gap-2">
                                    <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#006AA7] text-white text-sm font-black shadow-sm">
                                        {rel && (
                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-[#FECC02] text-[10px] font-black uppercase tracking-wider text-slate-900">
                                                {rel}
                                            </span>
                                        )}
                                        {/* first-letter, inte capitalize: svenska skriver
                                            "lördag 8 augusti", inte "Lördag 8 Augusti". */}
                                        <span className="first-letter:uppercase">{day.label}</span>
                                    </span>
                                    {day.upcoming.length > 0 && (
                                        <span className="text-[11px] font-black text-slate-400 tabular-nums">
                                            {day.upcoming.length} event
                                        </span>
                                    )}
                                </h2>
                            </div>
                            {/* Historik: det som redan varit ligger hopfällt överst. */}
                            {day.past.length > 0 && (
                                <button
                                    type="button"
                                    onClick={() => togglePast(day.key)}
                                    aria-expanded={pastOpen}
                                    className="mb-2 inline-flex items-center gap-1.5 text-[11px] font-black text-slate-400 hover:text-[#006AA7] transition-colors"
                                >
                                    <span aria-hidden>🕐</span>
                                    {day.past.length} har redan varit · {pastOpen ? 'Dölj' : 'Visa'}
                                </button>
                            )}
                            <ul className="flex flex-col gap-2">
                                {pastOpen && day.past.map(e => (
                                    <EventRow key={e.id} e={e} dimmed isSaved={saved.has(e.id)} onToggleSave={toggleSave} nowTs={nowTs} />
                                ))}
                                {day.upcoming.map(e => (
                                    <EventRow key={e.id} e={e} isSaved={saved.has(e.id)} onToggleSave={toggleSave} nowTs={nowTs} />
                                ))}
                            </ul>
                        </section>
                    );
                })}
            </div>

            {/* Sentinel för dag-för-dag-avtäckningen — renderas bara när fler
                dagar väntar (aldrig i SSR:en, där allt redan är utskrivet). */}
            {hasMoreDays && <div ref={sentinelRef} aria-hidden className="h-px" />}

            {shownDays.length === 0 && (
                <p className="mt-6 text-sm font-bold text-slate-500">
                    Inga listade event {emptyPhrase} i {cityName}.{' '}
                    <Link href="/" className="text-[#006AA7]">Se hela utbudet på kartan</Link>
                </p>
            )}

            {/* Visas först när alla dagar är avtäckta — annars ser det ut som
                att listan tar slut fast sentineln fyller på fler dagar. */}
            {sel.kind === 'period' && sel.period === 'all' && hours.length === 0 && !hasMoreDays && restCount > 0 && (
                <p className="mt-8 text-sm font-bold text-slate-500">
                    …och {restCount} evenemang längre fram.{' '}
                    <Link href="/" className="text-[#006AA7]">Utforska hela utbudet på kartan</Link>
                </p>
            )}
        </div>
    );
}
