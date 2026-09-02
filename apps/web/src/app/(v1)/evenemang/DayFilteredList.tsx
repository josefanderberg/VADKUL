'use client';

import Link from 'next/link';
import { writeEventSeed } from '@/utils/eventSeed';
import dynamic from 'next/dynamic';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react';
import { mergeListedDays } from '@/utils/cityOptIn';
import { Heart, MapPin, Clock, Ticket, Users, ChevronDown } from 'lucide-react';
import { PERIODS, periodKeys, relativeDayLabel } from './periods';
import { NO_TIME_PAST_HOUR } from '@/components/v2/v2MapBricka';
import { useDayFilter } from './dayFilter';
import { dupKey } from '@/utils/groupDups';
import { useAuth } from '@/context/AuthContext';
import { anchorScrollDelta, isPlainClick } from '@/utils/eventExpand';
// Kartans ettords-kategorietiketter (Musik, Sport, Familj …) — kategori-
// chipet nere till höger på raden (Josef 2/9), vänster om statusbadgen.
import { categoryLabel } from '@/components/v2/v2MapLabel';
import EventExpanded from './EventExpanded';

// Inloggningsmodalen (samma som kartans) — laddas först när någon utloggad
// trycker på ett hjärta. Stadssidorna är SEO-ytor och ska inte bära
// registreringsformuläret i sitt förstabundle.
const AuthModal = dynamic(() => import('@/components/v2/AuthModal'), { ssr: false });

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
//    dyker upp under Sparade i profilen. Gilla KRÄVER konto (22/8): utloggad
//    öppnar hjärtat inloggningsmodalen i stället för att spara.
// Servern (EventDayList) har förbyggt raderna till rena strängar; varje listad
// dag innehåller ALLA sina event. Default-filtret är 'Alla', och dag-
// filtreringen slår till först EFTER mount (nowTs) — SSR-HTML:en visar hela
// listan (deterministisk + crawlbar) och hydreringen matchar.
//  - DAG-FÖR-DAG-AVTÄCKNING: efter mount renderas dagarna en i taget — nästa
//    dag monteras först när man scrollar nära listans slut (sentinel +
//    scroll-lyssnare). Pre-mount renderas alla dagar (crawlbart); filterbyte
//    nollställer avtäckningen.
//  - BILDLÖSA KAPAS: max IMGLESS_SHOWN rader utan omslagsbild per dag, resten
//    bakom en "Visa fler"-rad (Josef 30/8) — bildkorten ska bära listan.
//  - UTFÄLLNING PÅ PLATS (Josef 2/9): ett klick på en rad öppnar eventet HÄR
//    (EventExpanded: beskrivning, Anmäl/Boka, Karta, Dela) i stället för att
//    hoppa till kartan. Ett i taget, som ett kort. Radens <a href=/?event=>
//    står kvar i HTML:n — crawlbar, och cmd/ctrl-klick öppnar kartan i ny
//    flik som förut; bara det vanliga klicket fångas (isPlainClick).

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
    /** Överlämningen till kartan (sessionStorage-seed vid klick, se
     *  utils/eventSeed): eventkortet på /?event= öppnar direkt på radens data
     *  i stället för att vänta på Sverige-lagren. description är stadssidans
     *  schema.org-trimmade (~300 tecken) — kartan fyller på med hela texten. */
    lat: number;
    lng: number;
    category: string;
    hostName: string | null;
    description: string | null;
    /** Dagens dubbletter (samma titel eller omslagsbild — groupDups): ÖVRIGA tillfällen utöver
     *  radens representant. Det som skiljer (tid & plats) radas upp bakom
     *  radens utfällning; representanten bär bild, status och hjärta. */
    dups?: Omit<ListedEvent, 'dups'>[];
};

/** Skriv klick-överlämningen — kortet på /?event= läser den vid boot.
 *  hasSpecificTime återskapas ur clock (null ⇔ inget klockslag, samma
 *  biconditional som radbygget i EventList). */
function seedMapHandoff(e: ListedEvent): void {
    writeEventSeed({
        id: e.id,
        title: e.title,
        t: e.t,
        hasSpecificTime: e.clock !== null,
        lat: e.lat,
        lng: e.lng,
        locationName: e.place,
        category: e.category,
        emoji: e.emoji,
        hostName: e.hostName ?? undefined,
        coverImage: e.coverImage,
        price: e.price ?? undefined,
        attendees: e.attendees,
        description: e.description ?? undefined,
    });
}

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

// Dagrubrikens "N event" ska räkna EVENT, inte rader — en grupprad (dups)
// bär flera tillfällen.
const countEvents = (rows: ListedEvent[]) => rows.reduce((sum, e) => sum + 1 + (e.dups?.length ?? 0), 0);
// Max antal BILDLÖSA rader som visas per dag — bildkorten gör listan visuellt
// tilltalande, de kompakta raderna får inte dränka dem (Josef 30/8). Resten
// ligger bakom en "Visa fler"-rad per dag. SSR:en renderar allt (crawlbart);
// kapningen slår till först efter mount (nowTs), precis som dagfiltren.
const IMGLESS_SHOWN = 3;
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
                    : 'bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:border-[#006AA7]/40 dark:hover:border-sky-400/40 hover:text-[#006AA7] dark:hover:text-sky-400'
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
        past: { label: 'Har varit', cls: 'bg-slate-300 dark:bg-zinc-700 text-slate-700 dark:text-zinc-300' },
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
        <div ref={holderRef} className={`overflow-hidden bg-slate-200 dark:bg-zinc-800 ${className ?? ''}`}>
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

// Utfällningen på en GRUPPRAD (dups): övriga tillfällen — bara det som
// skiljer sig: tid & plats, ev. pris, och TITELN när den avviker från radens
// (bildgrupperna — "Förtidsröstning Tenhult" under "Förtidsröstning i stan").
// <details> i stället för state så SSR-HTML:en är komplett och länkarna
// fungerar redan före hydreringen. Ligger UTANFÖR radens Link (klick ska
// fälla ut, inte navigera). Tillfällenas egna länkar fäller sedan 2/9 ut
// tillfället i gruppradens panel (onPick), precis som radklicket.
type RowPick = (ev: ReactMouseEvent<HTMLAnchorElement>, target: Omit<ListedEvent, 'dups'>) => void;

function DupList({ dups, repTitle, onPick, activeId }: {
    dups: NonNullable<ListedEvent['dups']>;
    repTitle: string;
    /** Radklicket (EventRow.pick): vanligt klick fäller ut tillfället under
     *  gruppraden, modifierat klick går till kartan som förut. */
    onPick: RowPick;
    /** Det utfällda tillfällets id — raden markeras blå. */
    activeId: string | null;
}) {
    const repKey = dupKey(repTitle);
    return (
        <details className="group/dups">
            <summary className="inline-flex items-center gap-1 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden text-[11px] font-black text-[#006AA7] dark:text-sky-400 hover:underline">
                <ChevronDown size={12} strokeWidth={3} className="transition-transform group-open/dups:rotate-180" aria-hidden />
                {dups.length === 1 ? '+1 tillfälle till' : `+${dups.length} fler tider & platser`}
            </summary>
            <ul className="mt-1.5 flex flex-col gap-1.5 border-l-2 border-slate-200 dark:border-zinc-800 pl-3">
                {dups.map(d => (
                    <li key={d.id}>
                        <Link
                            href={d.href}
                            onClick={ev => onPick(ev, d)}
                            aria-expanded={activeId === d.id}
                            className={`flex items-center gap-x-2 max-w-full text-[11px] font-bold transition-colors hover:text-[#006AA7] dark:hover:text-sky-400 ${
                                activeId === d.id ? 'text-[#006AA7] dark:text-sky-400' : 'text-slate-500 dark:text-zinc-400'
                            }`}
                        >
                            {dupKey(d.title) !== repKey && (
                                <span className="min-w-0 shrink truncate font-black text-slate-700 dark:text-zinc-300">{d.title}</span>
                            )}
                            {d.clock && <span className="shrink-0 tabular-nums">kl {d.clock}</span>}
                            <span className="min-w-0 shrink truncate">{d.place}</span>
                            {d.price && <span className="shrink-0 text-slate-400 dark:text-zinc-500">{d.price}</span>}
                        </Link>
                    </li>
                ))}
            </ul>
        </details>
    );
}

function EventRow({ e, dimmed, isSaved, onToggleSave, nowTs, expandedId, onToggleExpand, dayLabel }: {
    e: ListedEvent;
    dimmed?: boolean;
    isSaved: boolean;
    onToggleSave: (id: string) => void;
    nowTs: number;
    /** Id:t på det UTFÄLLDA eventet i listan (ett i taget) — radens eget
     *  eller ett av dess dups → panelen renderas under den här raden. */
    expandedId: string | null;
    /** anchor = radens <li>: hålls kvar på samma plats på skärmen över
     *  bytet (scrollkompensationen i DayFilteredList). */
    onToggleExpand: (id: string, anchor?: HTMLElement | null) => void;
    /** Dagrubriken ("torsdag 9 juli") — panelens datumrad. */
    dayLabel: string;
}) {
    const [imgFailed, setImgFailed] = useState(false);
    const liRef = useRef<HTMLLIElement>(null);
    const hasImage = !!e.coverImage && !imgFailed;
    const dups = e.dups ?? [];
    // Statusbadgen är klockberoende → bara efter mount (deterministisk SSR).
    const status = nowTs === 0 ? null : statusOf(e, nowTs);

    // UTFÄLLNINGEN (Josef 2/9): ett vanligt klick på raden öppnar eventet HÄR
    // på stadssidan (EventExpanded) i stället för att hoppa till kartan.
    // Länken är kvar i HTML:n — crawlbar, och cmd/ctrl-klick öppnar kartan i
    // ny flik som förut (då skrivs seeden precis som innan). Ett av grupp-
    // radens övriga tillfällen (dups) fälls ut under SAMMA rad.
    const shown = expandedId === e.id ? e : (dups.find(d => d.id === expandedId) ?? null);
    const expanded = shown !== null;
    const pick: RowPick = (ev, target) => {
        if (isPlainClick(ev)) {
            ev.preventDefault();
            // Ankaret är radens <li> (dup-länkarna ligger i gruppradens li).
            onToggleExpand(target.id, ev.currentTarget.closest('li'));
            return;
        }
        seedMapHandoff(target);
    };
    const panel = shown && (
        <EventExpanded
            key={shown.id}
            e={shown}
            isDup={shown.id !== e.id}
            dayLabel={dayLabel}
            onClose={() => onToggleExpand(shown.id, liRef.current)}
            onMapClick={() => seedMapHandoff(shown)}
        />
    );
    // Utfälld rad markeras med blå kant (samma blå som chipsen/dagpillen).
    const liBase = `rounded-xl bg-white dark:bg-zinc-900 border transition-all [content-visibility:auto] ${
        expanded
            ? 'border-[#006AA7]/60 dark:border-sky-400/60 shadow-md'
            : 'border-slate-200 dark:border-zinc-800 hover:border-[#006AA7]/40 dark:hover:border-sky-400/40 hover:shadow-sm'
    } ${dimmed ? 'opacity-55' : ''}`;

    // Inforad (plats · tid · pris · antal) — samma stil/ikoner som eventkortets
    // närhetslista. Allt är server-strängar → deterministiskt vid SSR.
    const infoRow = (
        <div className="flex items-center gap-x-2 text-[11px] font-bold text-slate-500 dark:text-zinc-400 overflow-hidden">
            <span className="inline-flex items-center gap-1 min-w-0">
                <MapPin size={11} className="text-[#006AA7] dark:text-sky-400 shrink-0" />
                <span className="truncate">{e.place}</span>
            </span>
            {e.clock && (
                <span className="inline-flex items-center gap-1 shrink-0 whitespace-nowrap">
                    <Clock size={11} className="text-[#006AA7] dark:text-sky-400" />
                    kl {e.clock}
                </span>
            )}
            {e.price && (
                <span className="inline-flex items-center gap-1 shrink-0 whitespace-nowrap">
                    <Ticket size={11} className="text-[#006AA7] dark:text-sky-400" />
                    {e.price}
                </span>
            )}
            {e.attendees > 0 && (
                <span className="inline-flex items-center gap-1 shrink-0 whitespace-nowrap">
                    <Users size={11} className="text-[#006AA7] dark:text-sky-400" />
                    {e.attendees} kommer
                </span>
            )}
        </div>
    );

    // MED bild: omslagsbild kant till kant, titel + emoji + statusbadge överlagd
    // på en mörk gradient, inforaden under — spara-hjärtat överlagrat uppe till
    // höger (utanför Link:en så det inte navigerar). Utfälld växer bilden
    // (h-28 → h-52, utan animation) så man ser mer av den, och panelen ligger
    // under inforaden.
    // content-visibility:auto på raderna: rader utanför viewporten kostar
    // ingen layout/paint (stora listor = stor INP/LCP-vinst på mobil);
    // contain-intrinsic-size håller scrollhöjden någorlunda stabil.
    if (hasImage) {
        return (
            <li ref={liRef} className={`relative overflow-hidden [contain-intrinsic-size:auto_10rem] ${liBase}`}>
                <Link href={e.href} className="block" onClick={ev => pick(ev, e)} aria-expanded={expanded}>
                    <div className="relative">
                        {/* Ingen höjdanimation: EventExpanded mäter panelens läge
                            synkront vid mount och behöver den slutliga höjden. */}
                        <LazyRowImage
                            src={e.coverImage!}
                            className={expanded ? 'h-52' : 'h-28'}
                            onFailed={() => setImgFailed(true)}
                        />
                        <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 px-4 pb-2 pt-8 bg-gradient-to-t from-black/75 via-black/35 to-transparent">
                            <span className="text-lg leading-none shrink-0 drop-shadow" aria-hidden>{e.emoji}</span>
                            <h4 className="flex-1 min-w-0 font-black text-sm text-white truncate [text-shadow:0_1px_2px_rgba(0,0,0,0.8)]">{e.title}</h4>
                            {dups.length > 0 && (
                                <span className="shrink-0 px-1.5 py-0.5 rounded-full bg-white/25 backdrop-blur-sm text-[10px] font-black text-white tabular-nums" title={`${dups.length + 1} tillfällen`}>
                                    ×{dups.length + 1}
                                </span>
                            )}
                            {/* Kategorin nere till höger på bilden, vänster om
                                statusbadgen (Josef 2/9). */}
                            <span className="shrink-0 px-1.5 py-0.5 rounded-full bg-white/25 backdrop-blur-sm text-[10px] font-black text-white">
                                {categoryLabel(e.category)}
                            </span>
                            {status && <StatusBadge status={status} />}
                        </div>
                    </div>
                    {/* Inforaden under bilden döljs när eventet är öppet —
                        panelen visar samma uppgifter (Josef 2/9: "står 2 gånger"). */}
                    {!expanded && <div className="px-4 py-2">{infoRow}</div>}
                </Link>
                {dups.length > 0 && <div className="px-4 pb-2.5 -mt-0.5"><DupList dups={dups} repTitle={e.title} onPick={pick} activeId={expandedId} /></div>}
                {panel}
                <button
                    type="button"
                    onClick={() => onToggleSave(e.id)}
                    aria-pressed={isSaved}
                    aria-label={isSaved ? 'Ta bort från sparade' : 'Spara eventet'}
                    title={isSaved ? 'Sparat — finns under Sparade i din profil' : 'Spara eventet'}
                    className={`absolute top-2 right-2 z-10 flex items-center justify-center w-8 h-8 rounded-full bg-white/90 dark:bg-zinc-900/90 backdrop-blur shadow transition-colors ${
                        isSaved ? 'text-rose-500' : 'text-slate-400 dark:text-zinc-500 hover:text-rose-400'
                    }`}
                >
                    <Heart size={16} fill={isSaved ? 'currentColor' : 'none'} />
                </button>
            </li>
        );
    }

    // UTAN bild: kompakt rad — emoji-bricka, titel + statusbadge, inforad under.
    // En grupprad får dessutom ×N-brickan vid titeln och utfällningen under —
    // utfällningen ligger utanför Link:en (klick ska fälla ut, inte navigera),
    // så li:t är en kolumn med radinnehållet i en egen flex-div. Panelen
    // (EventExpanded) ligger sist i kolumnen.
    return (
        <li ref={liRef} className={`[contain-intrinsic-size:auto_4.5rem] ${liBase}`}>
            <div className="flex items-stretch">
                <Link href={e.href} className="flex-1 min-w-0 flex items-start gap-3 pl-4 py-3" onClick={ev => pick(ev, e)} aria-expanded={expanded}>
                    <span className="shrink-0 w-9 h-9 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-lg leading-none mt-0.5" aria-hidden>{e.emoji}</span>
                    <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                            <span className="text-sm font-bold text-slate-900 dark:text-zinc-100 leading-snug truncate">{e.title}</span>
                            {dups.length > 0 && (
                                <span className="shrink-0 px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-[10px] font-black text-slate-500 dark:text-zinc-400 tabular-nums" title={`${dups.length + 1} tillfällen`}>
                                    ×{dups.length + 1}
                                </span>
                            )}
                            {/* Kategorin — samma plats som på bildraderna (vänster
                                om statusbadgen), i den kompakta radens färger. */}
                            <span className="shrink-0 px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-[10px] font-black text-slate-500 dark:text-zinc-400">
                                {categoryLabel(e.category)}
                            </span>
                            {status && <StatusBadge status={status} />}
                        </span>
                        {!expanded && <span className="block mt-1">{infoRow}</span>}
                    </span>
                </Link>
                <button
                    type="button"
                    onClick={() => onToggleSave(e.id)}
                    aria-pressed={isSaved}
                    aria-label={isSaved ? 'Ta bort från sparade' : 'Spara eventet'}
                    title={isSaved ? 'Sparat — finns under Sparade i din profil' : 'Spara eventet'}
                    className={`shrink-0 flex items-center px-3.5 rounded-r-xl transition-colors ${
                        isSaved ? 'text-rose-500' : 'text-slate-300 dark:text-zinc-600 hover:text-rose-400'
                    }`}
                >
                    <Heart size={17} fill={isSaved ? 'currentColor' : 'none'} />
                </button>
            </div>
            {dups.length > 0 && <div className="pl-16 pr-4 pb-3 -mt-1"><DupList dups={dups} repTitle={e.title} onPick={pick} activeId={expandedId} /></div>}
            {panel}
        </li>
    );
}

export default function DayFilteredList({ days: serverDays, restCount, cityName, children }: {
    days: ListedDay[];
    restCount: number;
    cityName: string;
    /** Renderas mellan filterraden och daglistan (t.ex. kategorichips). */
    children?: ReactNode;
}) {
    // Urval + timstaplar bor i det DELADE dagfiltret (dayFilter.tsx) så att
    // kart-heron ovanför visar samma dag som listan. Timvalen behålls när man
    // byter dag — "kvällsfiltret" följer med.
    const { sel, setSel, hours, setHours, category, optIn, optInDays } = useDayFilter();
    // OPT-IN-KÄLLORNA (Josef 2/9): med växeln på sys stadens hämtade opt-in-
    // dagar in i serverns lista (samma radform; utils/cityOptIn). Av/ej hämtat
    // → serverns lista orörd, samma referens.
    const days = useMemo(
        () => (optIn && optInDays ? mergeListedDays(serverDays, optInDays as ListedDay[]) : serverDays),
        [serverDays, optIn, optInDays],
    );
    // Alla filterbyten (och mount-kollapsen nedan) renderar om stora listor —
    // som transitions är omrenderingen avbrytbar och blockerar aldrig tappen
    // (INP på mobil låg >500 ms när hela dagslistan ritades i klick-handlern).
    const [, startTransition] = useTransition();
    // Sparade event (hjärtan) + klockan. Båda sätts efter mount så att
    // SSR-HTML:en är deterministisk; innan dess är inget sparat/passerat.
    const [saved, setSaved] = useState<Set<string>>(new Set());
    // Inloggningsmodalen — öppnas när en utloggad trycker på ett hjärta.
    const { user } = useAuth();
    const [authOpen, setAuthOpen] = useState(false);
    const [nowTs, setNowTs] = useState(0);
    // Dagar vars "har redan varit"-sektion är uppfälld.
    const [openPast, setOpenPast] = useState<Set<string>>(new Set());
    // Dagar vars bildlösa svans är uppfälld — se IMGLESS_SHOWN.
    const [openImgless, setOpenImgless] = useState<Set<string>>(new Set());
    // Dag-för-dag-avtäckning (se filhuvudet): antal dagar som renderats.
    // Gäller först efter mount (nowTs) — pre-mount renderas alla dagar.
    const [revealed, setRevealed] = useState(1);
    // Det UTFÄLLDA eventet (Josef 2/9) — ett i taget, som ett kort. Id:t kan
    // vara en rads eget eller ett av dess dups; raden hittar det själv.
    const [expandedId, setExpandedId] = useState<string | null>(null);
    // SCROLLKOMPENSATION (Josef 2/9: "scrollar man ner förbi en jättelång
    // beskrivning och klickar på nästa hamnar man helt off"): när rad A:s
    // panel fälls ihop ovanför den rad B man just klickade på rycker B upp
    // lika många px som panelen var hög, och skärmen står kvar långt ner i
    // listan utan att B syns. Raden man klickade på hålls därför på SAMMA
    // plats på skärmen: toppen mäts i klicket, och skillnaden mot toppen
    // efter DOM-uppdateringen scrollas bort FÖRE målningen (layout-effekt,
    // instant) — sedan får panelens egen mjuka scroll visa resten. Att stänga
    // en rad man scrollat djupt ner i lyfter i stället fram den under naven
    // (anchorScrollDelta i utils/eventExpand).
    const scrollAnchorRef = useRef<{ el: HTMLElement; top: number } | null>(null);
    const toggleExpand = (id: string, anchor?: HTMLElement | null) => {
        scrollAnchorRef.current = anchor ? { el: anchor, top: anchor.getBoundingClientRect().top } : null;
        setExpandedId(prev => (prev === id ? null : id));
    };
    useLayoutEffect(() => {
        const a = scrollAnchorRef.current;
        if (!a) return;
        scrollAnchorRef.current = null;
        const delta = anchorScrollDelta(a.top, a.el.getBoundingClientRect().top, expandedId === null);
        if (delta) window.scrollBy({ top: delta, behavior: 'instant' });
    }, [expandedId]);
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

    const toggleImgless = (key: string) =>
        setOpenImgless(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key); else next.add(key);
            return next;
        });

    const toggleSave = (id: string) => {
        // Gilla kräver konto (Josef 22/8) — samma regel som på kartan. Redan
        // sparade rader får plockas bort utan inloggning: det är gamla poster
        // från localStorage-tiden, och de ska gå att städa bort.
        if (!user && !saved.has(id)) { setAuthOpen(true); return; }
        setSaved(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            try { localStorage.setItem(SAVED_KEY, JSON.stringify([...next])); } catch { /* privat läge */ }
            return next;
        });
    };

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

    const hourMatch = (e: { hour: number | null }) =>
        hours.length ? e.hour !== null && hours.includes(e.hour) : true;
    // KATEGORIN (CategoryChips → kontexten, Josef 2/9): stadssidans rader
    // bär alla kategorier och filtreras här på plats; på kategorisidan är
    // raderna redan servern-filtrerade och matchar alla.
    const catMatch = (e: { category?: string }) => category === null || e.category === category;
    // En grupprad (dups) matchar timfiltret om NÅGOT av tillfällena gör det,
    // och räknas som "har varit" först när ALLA tillfällen passerat — annars
    // försvinner kvällens sagostund för att morgonens redan varit.
    const rowMatch = (e: ListedEvent) => catMatch(e) && (hourMatch(e) || (e.dups ?? []).some(hourMatch));
    const rowPast = (e: ListedEvent) => isPast(e) && (e.dups ?? []).every(isPast);
    // Från nu och framåt: passerade rader göms bakom "har redan varit".
    const shownDays = visDays
        .map(d => {
            const rows = d.events.filter(rowMatch);
            return { ...d, upcoming: rows.filter(e => !rowPast(e)), past: rows.filter(rowPast) };
        })
        .filter(d => d.upcoming.length > 0 || d.past.length > 0);

    // Dag-för-dag-avtäckningen: pre-mount (nowTs 0) renderas ALLT — serverns
    // HTML ska vara hel och crawlbar. Efter mount renderas `revealed` dagar;
    // sentineln under listan fyller på nästa dag när den scrollas inom räckhåll.
    const dayLimit = nowTs === 0 ? shownDays.length : revealed;
    const renderDays = shownDays.slice(0, dayLimit);
    const hasMoreDays = renderDays.length < shownDays.length;

    // Filterbyte → börja om från första dagen i det nya urvalet, och fäll
    // ihop det öppna eventet (raden kan ha filtrerats bort).
    useEffect(() => { setRevealed(1); setExpandedId(null); }, [sel, hours, category]);

    // NÄSTA DAG-PILEN i dagrubriken (Josef 31/8): hoppar/scrollar till nästa
    // dags rubrik. Nästa dag kan vara OAVTÄCKT (dag-för-dag-avtäckningen
    // ovan) — då höjs revealed först och scrollen körs i effekten nedan när
    // sektionen faktiskt står i DOM (pendingScrollKey ligger kvar tills dess).
    const dayRefs = useRef(new Map<string, HTMLElement>());
    const [pendingScrollKey, setPendingScrollKey] = useState<string | null>(null);
    useEffect(() => {
        if (!pendingScrollKey) return;
        const el = dayRefs.current.get(pendingScrollKey);
        if (!el) return; // sektionen monteras av reveal-rendern — effekten körs om då
        setPendingScrollKey(null);
        // 57 px toppnav — nästa dags rubrik ska landa strax under naven,
        // precis där den sedan klistrar sig.
        window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 56, behavior: 'smooth' });
    }, [pendingScrollKey, revealed]);

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
    }, [revealed, hasMoreDays, sel, hours, category]);

    // Histogram = summan av de visade dagarnas hourCounts (sanna totaler).
    // Med en kategori vald räknas staplarna i stället ur radernas (och
    // dupsens) timmar — hourCounts är förbyggda över ALLA kategorier.
    const hist = category === null
        ? Array.from({ length: 24 }, (_, h) => visDays.reduce((s, d) => s + (d.hourCounts[h] ?? 0), 0))
        : Array.from({ length: 24 }, (_, h) => visDays.reduce((s, d) => s + d.events.reduce((t, e) =>
            t + [e, ...(e.dups ?? [])].filter(x => x.category === category && x.hour === h).length, 0), 0));
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
                <span className="shrink-0 mx-1 h-5 w-px bg-slate-200 dark:bg-zinc-800" aria-hidden />
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
                        <p className="text-[11px] font-bold text-slate-400 dark:text-zinc-500">
                            När på dagen? Tryck på staplarna för att filtrera.
                        </p>
                        {hours.length > 0 && (
                            <button
                                type="button"
                                onClick={() => startTransition(() => setHours([]))}
                                className="shrink-0 text-[11px] font-black text-[#006AA7] dark:text-sky-400 hover:underline"
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
                                            : c > 0 ? 'bg-slate-300 dark:bg-zinc-700 group-hover:bg-[#006AA7]/50 dark:group-hover:bg-sky-400/50'
                                            : 'bg-slate-100 dark:bg-zinc-800'
                                        }`}
                                        style={{ height: c > 0 ? Math.max(5, Math.round((c / histMax) * 44)) : 2 }}
                                    />
                                    <span
                                        aria-hidden
                                        className={`text-[9px] font-bold tabular-nums ${on ? 'text-[#006AA7] dark:text-sky-400' : 'text-slate-400 dark:text-zinc-500'}`}
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
                    const pastOpen = openPast.has(day.key);
                    // Bildsatta rader visas alltid; av de bildlösa visas max
                    // IMGLESS_SHOWN tills dagens "Visa fler" fälls upp.
                    // (Servern sorterar redan bild-först — splitten här gör
                    // kapningen robust även om ordningen skulle ändras.)
                    const withImg = day.upcoming.filter(e => !!e.coverImage);
                    const imgless = day.upcoming.filter(e => !e.coverImage);
                    const imglessOpen = openImgless.has(day.key);
                    const shownImgless = (nowTs === 0 || imglessOpen) ? imgless : imgless.slice(0, IMGLESS_SHOWN);
                    const imglessMore = imgless.length - IMGLESS_SHOWN;
                    // "Idag"/"Imorgon" är klockberoende → bara efter mount.
                    const rel = nowTs === 0 ? null : relativeDayLabel(day.key);
                    const nextDay = shownDays[di + 1];
                    return (
                        <section
                            key={day.key}
                            // Rad i pil-hoppens register (nästa dag-pilen scrollar hit).
                            ref={el => { if (el) dayRefs.current.set(day.key, el); else dayRefs.current.delete(day.key); }}
                        >
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
                            {di > 0 && <span aria-hidden className="block mb-3 h-px bg-slate-200 dark:bg-zinc-800" />}
                            <div className="sticky top-[57px] z-20 -mx-5 px-5 pt-2 pb-2.5 bg-slate-50/95 dark:bg-zinc-950/95 backdrop-blur-sm flex items-center gap-2">
                                <h2 className="flex items-center gap-2 min-w-0">
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
                                        <span className="text-[11px] font-black text-slate-400 dark:text-zinc-500 tabular-nums">
                                            {countEvents(day.upcoming)} event
                                        </span>
                                    )}
                                </h2>
                                {/* NÄSTA DAG-PILEN (Josef 31/8): längst till höger i
                                    rubrikraden — hoppar till nästa dags rubrik. Sitter
                                    i den KLISTRADE rubriken, så den finns alltid till
                                    hands medan dagens rader rullar förbi. Renderas
                                    inte på sista dagen (finns inget att hoppa till).
                                    Utanför h2:n — en knapp är inte en del av
                                    rubrikens text. */}
                                {nextDay && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            // Oavtäckt nästa dag? Montera den först —
                                            // scrollen körs av pendingScrollKey-effekten
                                            // när sektionen finns.
                                            if (di + 1 >= renderDays.length) setRevealed(di + 2);
                                            setPendingScrollKey(nextDay.key);
                                        }}
                                        aria-label={`Hoppa till nästa dag — ${nextDay.label}`}
                                        title={`Nästa dag: ${nextDay.label}`}
                                        className="ml-auto shrink-0 flex h-8 w-8 items-center justify-center rounded-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-400 shadow-sm hover:text-[#006AA7] dark:hover:text-sky-400 hover:border-[#006AA7]/40 dark:hover:border-sky-400/40 active:scale-95 transition-all"
                                    >
                                        <ChevronDown size={16} strokeWidth={2.5} />
                                    </button>
                                )}
                            </div>
                            {/* Historik: det som redan varit ligger hopfällt överst. */}
                            {day.past.length > 0 && (
                                <button
                                    type="button"
                                    onClick={() => togglePast(day.key)}
                                    aria-expanded={pastOpen}
                                    className="mb-2 inline-flex items-center gap-1.5 text-[11px] font-black text-slate-400 dark:text-zinc-500 hover:text-[#006AA7] dark:hover:text-sky-400 transition-colors"
                                >
                                    <span aria-hidden>🕐</span>
                                    {countEvents(day.past)} har redan varit · {pastOpen ? 'Dölj' : 'Visa'}
                                </button>
                            )}
                            <ul className="flex flex-col gap-2">
                                {pastOpen && day.past.map(e => (
                                    <EventRow key={e.id} e={e} dimmed isSaved={saved.has(e.id)} onToggleSave={toggleSave} nowTs={nowTs} expandedId={expandedId} onToggleExpand={toggleExpand} dayLabel={day.label} />
                                ))}
                                {withImg.map(e => (
                                    <EventRow key={e.id} e={e} isSaved={saved.has(e.id)} onToggleSave={toggleSave} nowTs={nowTs} expandedId={expandedId} onToggleExpand={toggleExpand} dayLabel={day.label} />
                                ))}
                                {shownImgless.map(e => (
                                    <EventRow key={e.id} e={e} isSaved={saved.has(e.id)} onToggleSave={toggleSave} nowTs={nowTs} expandedId={expandedId} onToggleExpand={toggleExpand} dayLabel={day.label} />
                                ))}
                                {nowTs !== 0 && imglessMore > 0 && (
                                    <li>
                                        <button
                                            type="button"
                                            onClick={() => toggleImgless(day.key)}
                                            aria-expanded={imglessOpen}
                                            className="w-full py-2.5 rounded-xl border border-dashed border-slate-300 dark:border-zinc-700 text-xs font-black text-slate-500 dark:text-zinc-400 hover:text-[#006AA7] dark:hover:text-sky-400 hover:border-[#006AA7]/40 dark:hover:border-sky-400/40 transition-colors"
                                        >
                                            {imglessOpen ? 'Visa färre ▴' : `Visa ${imglessMore} evenemang till ▾`}
                                        </button>
                                    </li>
                                )}
                            </ul>
                        </section>
                    );
                })}
            </div>

            {/* Sentinel för dag-för-dag-avtäckningen — renderas bara när fler
                dagar väntar (aldrig i SSR:en, där allt redan är utskrivet). */}
            {hasMoreDays && <div ref={sentinelRef} aria-hidden className="h-px" />}

            {shownDays.length === 0 && (
                <p className="mt-6 text-sm font-bold text-slate-500 dark:text-zinc-400">
                    Inga listade event {emptyPhrase} i {cityName}.{' '}
                    <Link href="/" className="text-[#006AA7] dark:text-sky-400">Se hela utbudet på kartan</Link>
                </p>
            )}

            {/* Visas först när alla dagar är avtäckta — annars ser det ut som
                att listan tar slut fast sentineln fyller på fler dagar. */}
            {sel.kind === 'period' && sel.period === 'all' && hours.length === 0 && category === null && !hasMoreDays && restCount > 0 && (
                <p className="mt-8 text-sm font-bold text-slate-500 dark:text-zinc-400">
                    …och {restCount} evenemang längre fram.{' '}
                    <Link href="/" className="text-[#006AA7] dark:text-sky-400">Utforska hela utbudet på kartan</Link>
                </p>
            )}

            {/* Utloggad tryckte på ett hjärta → samma inloggning som kartan. */}
            {authOpen && (
                <AuthModal
                    open
                    reason="Logga in för att gilla event"
                    onClose={() => setAuthOpen(false)}
                />
            )}
        </div>
    );
}
