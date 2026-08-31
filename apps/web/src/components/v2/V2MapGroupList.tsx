'use client';

import { Fragment, useRef, useState } from 'react';
import { ChevronRight, Clock } from 'lucide-react';
import { LinkEvent } from '../../types';
import { eventEmoji, isEventPast } from './v2MapBricka';
import { EVENT_CATEGORIES, EventCategoryType } from '@/utils/categories';
import { nearestCityPoint } from '@/utils/cityPoints';

// ── Multi-event-lista ───────────────────────────────────────────────────────
// Öppnas när man klickar en bricka med FLERA event på samma koordinat: en liten
// panel (emoji + titel + tid per rad) så man kan välja vilket event i högen man
// vill öppna. Ankras till den klickade brickans ÖVRE HÖGRA hörn och följer
// punkten när kartan pannas/zoomas (V2Map projicerar om anchorPos på move/zoom).
// Saknas projicerad position (ogiltig koordinat) faller den tillbaka till
// top-center. Radval STÄNGER INTE listan — man ska kunna bläddra flera event på
// samma plats; den stängs av kart-klicket (V2Map nollar groupList själv).
// Kryss-knappen är BORTTAGEN 31/8 (Josef) — kartklicket är stängningen.
//
// PORTAL + FIXED: panelen renderas via portal till <body> (se V2Map) —
// V2Map-roten är z-0 och skapar en stacking context, så panelens z-index
// cappades annars vid 0 och zoomknapparna (portalade till body) ritades ÖVER
// panelen. Kartan är fullskärm (inset-0), så anchorPos px == viewport-px och
// position:fixed ger exakt samma placering som förr.
// Z-ORDNING (Josef 31/8): BARA zoomknapparna ska ligga under panelen —
// eventkortet, Nästa-pillen och övrigt krom ligger kvar ÖVER (se z-[1149]
// vid rot-diven nedan).
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
    /** Brickans projicerade skärmposition (px), null → fallback top-center.
     *  V2Map projicerar om den på move/zoom så listan följer kartan. */
    anchorPos: { x: number; y: number } | null;
    selectedEvent: LinkEvent | null;
    onSelect: (ev: LinkEvent) => void;
}

export default function V2MapGroupList({ events, anchorPos, selectedEvent, onSelect }: V2MapGroupListProps) {
    // Passerade event ligger hopfällda tills man ber om dem.
    const [pastOpen, setPastOpen] = useState(false);
    // Scrollporten + raderna — nästa-bläddringen scrollar det valda eventet
    // högst upp i porten (se goNextInList).
    const listRef = useRef<HTMLUListElement | null>(null);
    const rowRefs = useRef(new Map<string, HTMLLIElement>());

    const vw = typeof window !== 'undefined' ? window.innerWidth : 1024;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 768;
    const W = Math.min(vw * 0.86, 320);          // listbredd (px)
    // Brickans ungefärliga bredd: nål-tippen sitter PÅ geo-punkten,
    // kroppen ~BRICK_W px bred (centrerad i x).
    const BRICK_W = 30, GAP = 6;
    // TOP_MARGIN är TOPPGRÄNSEN (klamp, inte fast position): navbaren OCH
    // dag/vecka-väljaren i standardläge — headern med platsnamnet får aldrig
    // hamna bakom dem. 116 låg för högt och kröp in under väljaren
    // (Josef 27/8: +53 px, intrimmat i steg).
    const TOP_MARGIN = 169, BOTTOM_MARGIN = 12;
    // MAX_ROWS 6 → 4 (Josef 31/8, intrimmat i steg: 3 blev för snålt): sex
    // rader gjorde panelen överdrivet hög på datorn.
    const HEADER_H = 46, ROW_H = 52, DAY_H = 30, PAST_H = 34, MAX_ROWS = 4;

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
    // Maxhöjden är EN dagrubrik + ett fåtal eventrader (Josef 31/8): TVÅ på
    // mobil (under Tailwinds sm-gräns — högre skymde halva kartan), FYRA på
    // datorn (MAX_ROWS — sex blev överdrivet högt även där). Resten nås via
    // nästa-knappen (som auto-scrollar, se goNextInList) eller egen scroll.
    const isMobile = vw < 640;
    // vh-klampen biter aldrig i normala fönster (radtaket är långt under
    // 55 vh) — den finns kvar som skydd för extremt låga fönster.
    const listMaxH = Math.min(vh * 0.55,
        HEADER_H + (showDays ? DAY_H : 0) + (isMobile ? 2 : MAX_ROWS) * ROW_H);
    const bodyH = upcoming.length * ROW_H
        + (showDays ? dayBuckets.length * DAY_H : 0)
        + (past.length > 0 ? PAST_H + (pastOpen ? past.length * ROW_H : 0) : 0);
    const contentH = Math.min(listMaxH, HEADER_H + bodyH);
    // TOM UTFYLLNAD i listbotten (Josef 31/8): nästa-bläddringen topp-ankrar
    // varje event, och för att även det SISTA ska kunna stå högst upp (med sin
    // dagrubrik över) fylls botten ut med en tom ruta — panelen håller då
    // samma höjd hela vägen ner. Bara när innehållet faktiskt scrollar; korta
    // högar ska inte bli högre än sitt innehåll.
    const scrollportH = listMaxH - HEADER_H;
    const overflowing = bodyH > scrollportH;
    const spacerH = Math.max(0, scrollportH - (showDays ? DAY_H : 0) - ROW_H
        - (past.length > 0 ? PAST_H : 0));
    // PLACERING (Josef 27/8, ersätter 26/8-kvällens fasta läge): förankrad vid
    // brickan igen — listan relaterar HORISONTELLT till brickans övre högra
    // hörn och FÖLJER kartan när man pannar (V2Map projicerar om anchorPos) —
    // men TOP_MARGIN är hård toppgräns så den aldrig kryper upp under
    // dag/vecka-väljaren, och botten klampas så HELA boxen alltid syns.
    const cornerX = anchorPos ? anchorPos.x + BRICK_W / 2 + GAP : vw / 2 - W / 2;
    const left = Math.max(8, Math.min(cornerX, vw - W - 8));
    const belowY = anchorPos ? anchorPos.y + GAP : TOP_MARGIN;
    const top = Math.max(TOP_MARGIN, Math.min(belowY, vh - contentH - BOTTOM_MARGIN));
    // PLATSRUBRIKEN: alla event i gruppen delar koordinat, men INTE nödvändigt-
    // vis lokal — event som bara geokodats till orten hamnar i samma hög mitt i
    // stan, och då är första eventets locationName ("Rotary Göteborg-City") en
    // lögn om de övriga 13 (Josef 27/8). Bara när HELA högen delar samma namn
    // är det en riktig lokal och namnet visas; annars räcker orten: närmsta
    // CITY_POINTS-ort, samma uppslag som stadsrutan högst upp.
    const firstName = events[0]?.locationName?.trim() || '';
    const sharedVenue = firstName !== '' && events.every(ev => (ev.locationName?.trim() || '') === firstName);
    const placeName = sharedVenue ? firstName : nearestCityPoint(events[0].lat, events[0].lng).name;
    // "Nästa" stegar markeringen till nästa KOMMANDE event (wrap), listan
    // hålls öppen precis som vid radval så man kan bläddra vidare. Står man
    // på ett passerat event (eller inget) börjar den om på första kommande.
    // Har ALLA varit bläddras hela listan som förr.
    const pool = upcoming.length > 0 ? dayBuckets.flatMap(b => b.events) : pastOrdered;
    const selIdx = pool.findIndex(ev => ev.id === selectedEvent?.id);
    const goNextInList = () => {
        const next = pool[(selIdx + 1) % pool.length];
        onSelect(next);
        // Auto-scrolla det nya eventet HÖGST UPP i porten med sin klistrade
        // dagrubrik ovanför (Josef 31/8) — bläddringen ska aldrig kräva egen
        // scroll, och vid wrap åker listan tillbaka till toppen av sig själv.
        // rAF: låt markeringsrendern landa innan positionen mäts.
        requestAnimationFrame(() => {
            const ul = listRef.current;
            const li = rowRefs.current.get(next.id);
            if (!ul || !li) return;
            // Faktisk rubrikhöjd hellre än DAY_H-uppskattningen — raden ska
            // stå kant i kant under den klistrade rubriken.
            const headH = showDays
                ? (ul.querySelector<HTMLLIElement>('li.sticky')?.offsetHeight ?? DAY_H)
                : 0;
            ul.scrollTo({ top: Math.max(0, li.offsetTop - headH), behavior: 'smooth' });
        });
    };

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
            <li
                key={ev.id}
                // Rad-registret för nästa-bläddringens auto-scroll (goNextInList).
                ref={el => { if (el) rowRefs.current.set(ev.id, el); else rowRefs.current.delete(ev.id); }}
            >
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
        // position:fixed — portalad till <body> (se filkommentaren högst upp).
        // z-[1149] (Josef 31/8): ÖVER zoomknapparna (1148) men UNDER allt annat
        // arbetskrom — Nästa-pillen/kategorikolumnen (1150), navbaren (1160)
        // och framför allt eventkortet (1250). Panelen är en väljare, inte en
        // modal: bara zoomknapparna ska vika sig för den.
        <div className="z-[1149] pointer-events-auto" style={{ position: 'fixed', left, top, width: W }}>
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
                    {/* Nästa-knappen bär räknaren "3/12" = vilket event i högen
                        man står på ("–" innan något valts). Bredare tryckyta än
                        gamla cirkeln (Josef 31/8). Kryss-knappen som stod här
                        är borttagen samma dag — kartklicket stänger listan. */}
                    <button
                        type="button"
                        onClick={goNextInList}
                        aria-label="Nästa event här"
                        title="Nästa event här"
                        className="shrink-0 h-8 rounded-full bg-[#006AA7] text-white hover:bg-[#005590] active:scale-95 flex items-center gap-1 pl-3 pr-1.5 transition-all"
                    >
                        <span className="text-[11px] font-black tabular-nums leading-none">
                            {selIdx >= 0 ? selIdx + 1 : '–'}/{pool.length}
                        </span>
                        <ChevronRight size={18} />
                    </button>
                </div>
                {/* relative: gör ul till offsetParent så radernas offsetTop är
                    scrollkoordinater rakt av (auto-scrollen i goNextInList). */}
                <ul ref={listRef} className="relative flex-1 min-h-0 overflow-y-auto overscroll-contain divide-y divide-slate-100 dark:divide-slate-800">
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
                    {/* Tomrutan som låter sista eventet topp-ankras — se
                        spacerH-kommentaren ovan. */}
                    {overflowing && <li aria-hidden className="pointer-events-none" style={{ height: spacerH }} />}
                </ul>
            </div>
        </div>
    );
}
