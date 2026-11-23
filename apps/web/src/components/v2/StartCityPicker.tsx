'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, LocateFixed, MapPin, Play, Search, X } from 'lucide-react';
import { logEvent } from 'firebase/analytics';
import { analytics } from '@/lib/firebase';
import { searchCities, type CityPoint } from '@/utils/cityPoints';
import { popularStartCities, startCityChips, START_CITY_COUNT, type StartCityChip } from '@/utils/startChoice';
import { focusedTile, scrollLeftFor, stepTile, tileFocus } from '@/utils/cityCarousel';
import { EVENT_CATEGORIES, type EventCategoryType } from '@/utils/categories';

interface StartCityPickerProps {
    /** Nuvarande val (markeras), null = "där jag är". */
    current: CityPoint | null;
    /** Är `current` ett riktigt svar? Första gången (aldrig besvarat) är
     *  ingen bricka märkt "Ditt val". */
    answered?: boolean;
    /** Kategoristeget visas bara i onboardingen - från profilen byter man
     *  bara stad (kategorierna har sitt eget filter i sökpanelen). */
    withCategories: boolean;
    /** Förvalda kategorier i steg 2: FAVORITERNA (#271) - en preferens som
     *  ger tjockare ram och förtur i listan/Nästa, inte kartans filter. */
    initialCategories: ReadonlySet<EventCategoryType>;
    /** Förvalt 🔥-läge (kartans nuvarande). */
    initialPopular: boolean;
    /** Sant när väljaren tar över direkt efter välkomstskärmen: duken står
     *  redan framme och ska inte tona in en gång till. */
    fromWelcome?: boolean;
    /** Klart. city null = "där jag är". filter bara när kategoristeget visats -
     *  samma regler som sökpanelens rad: Fler-källan utesluter kategorierna
     *  och 🔥 (Josef 8/10 kväll: "populära först … fler så man kan välja pro,
     *  svenska kyrkan och korpen"). */
    onDone: (choice: { city: CityPoint | null; filter?: { kats: EventCategoryType[]; pop: boolean } }) => void;
    /** "Hoppa över" - ett SVAR: dagens beteende, frågan kommer inte igen. */
    onSkip: () => void;
    /** Kryss/utanför/Escape - INGET svar (Josef 8/10: "man kanske vill kunna
     *  välja"): rutan stängs men frågan kommer igen nästa besök. */
    onDismiss: () => void;
    /** Trycket på "Där jag är" - DÅ (inte vid sidladdningen) ber sidan om
     *  platsen (Josef 10/10), redan innan kategoristeget är klart. */
    onPickHere?: () => void;
}

const CATEGORY_KEYS = (Object.keys(EVENT_CATEGORIES) as EventCategoryType[]).filter(k => k !== 'other');

/** Utgångens längd - samma som välkomstskärmens (--welcome-exit-ms). */
const EXIT_MS = 300;
/** Mellanrummet mellan karusellens brickor (gap-3). Brickans bredd + detta är
 *  avståndet där en granne räknas som helt ur fokus. */
const TILE_GAP_PX = 12;
/** Hjulet tar ett steg i taget: så här tätt får stegen komma (ms). */
const WHEEL_STEP_MS = 220;

/** Väljaren monteras bara i webbläsaren, men utan layout-fas på servern
 *  varnar React - samma skydd som i WelcomeOverlay. */
const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

function track(name: string) {
    analytics.then(a => { if (a) logEvent(a, name); }).catch(() => { /* analytics avstängt */ });
}

/**
 * Startstadsväljaren (ägarbeslut 8/10, förebild happymap.se): steg 1 = var
 * kartan ska öppna, steg 2 = vad man är sugen på (valfritt flerval som blir
 * kartans vanliga sparade filter). "Hoppa över" ger dagens beteende.
 *
 * INGEN RUTA, OCH STADSVALET ÄR EN KARUSELL (#268, ägarbeslut 21/11, Josef:
 * "det ska inte vara med bakgrund. utan det ska liksom ploppa fram texten",
 * "staden ska vara att man kan scrolla åt sidorna", "göra det på alla. men
 * man ska när man ser städer ser det som lite spelliknande"): texten står
 * direkt över den nedtonade kartan och poppar fram som i välkomstskärmen.
 * Städerna är brickor i en rad man drar i sidled, som banväljaren i ett
 * spel: brickan i mitten är den valda (störst, gul ram), grannarna krymper
 * och tonar ut, och den stora knappen under startar kartan där. Den vita
 * rutan och de radbrutna stadschipsen är RIVNA - bygg inte tillbaka dem.
 * Räkningen bor i utils/cityCarousel (testad), utseendet i globals.css
 * (.game-tile, .game-btn).
 */
export default function StartCityPicker({ current, answered = true, withCategories, initialCategories, initialPopular, fromWelcome = false, onDone, onSkip, onDismiss, onPickHere }: StartCityPickerProps) {
    const [step, setStep] = useState<'city' | 'categories'>('city');
    const [query, setQuery] = useState('');
    const [city, setCity] = useState<CityPoint | null>(current);
    const [kats, setKats] = useState<Set<EventCategoryType>>(() => new Set(initialCategories));
    const [pop, setPop] = useState(initialPopular);
    const [closing, setClosing] = useState(false);
    const closingRef = useRef(false);
    const stageRef = useRef<HTMLDivElement>(null);

    const popular = useMemo(() => popularStartCities(12), []);
    const hits = useMemo(() => searchCities(query, 8), [query]);
    const searching = query.trim().length >= 2;
    // Radens brickor: sökträffarna medan man söker, annars det gällande
    // valet först, "Där jag är" och snabbvalen (utils/startChoice).
    const tiles: StartCityChip[] = useMemo(() => (
        searching
            ? hits.map(c => ({ key: c.name, city: c, selected: answered && current?.name === c.name }))
            : startCityChips(current, answered, popular)
    ), [searching, hits, current, answered, popular]);
    const tileKey = tiles.map(t => t.key).join('|');

    // ── Karusellen ──────────────────────────────────────────────────────────
    // Brickan i mitten är valet. Fokus per bricka (0-1) skrivs DIREKT till
    // DOM som --f under scrollen - en setState per bildruta hade renderat om
    // hela väljaren 60 gånger i sekunden. State byts bara när en NY bricka
    // tar mitten.
    const scrollerRef = useRef<HTMLDivElement>(null);
    const tileRefs = useRef<(HTMLDivElement | null)[]>([]);
    const [focus, setFocus] = useState(0);
    const focusRef = useRef(0);
    const rafRef = useRef(0);
    const wheelAtRef = useRef(0);
    // En beställd rullning (pil, hjul, piltangent, tryck på en granne) sätter
    // valet DIREKT och håller det tills raden är framme. Annars hade mätningen
    // under glidet pekat ut varje bricka på vägen (startknappens text hade
    // poppat om för var och en), och två snabba pilklick hade räknat från
    // samma bricka. Fingret i raden släpper beställningen.
    const pendingRef = useRef<number | null>(null);
    const pendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const tileCenter = (el: HTMLDivElement) => el.offsetLeft + el.offsetWidth / 2;

    const measure = useCallback(() => {
        const sc = scrollerRef.current;
        if (!sc) return;
        const viewCenter = sc.scrollLeft + sc.clientWidth / 2;
        const centers = tileRefs.current.map(el => {
            if (!el) return Infinity;
            const c = tileCenter(el);
            el.style.setProperty('--f', tileFocus(c, viewCenter, el.offsetWidth + TILE_GAP_PX).toFixed(3));
            return c;
        });
        const best = focusedTile(centers, viewCenter);
        if (best < 0) return;
        if (pendingRef.current !== null) {
            if (best === pendingRef.current) pendingRef.current = null; // framme
            return;
        }
        if (best !== focusRef.current) {
            focusRef.current = best;
            setFocus(best);
        }
    }, []);

    const onScroll = useCallback(() => {
        if (rafRef.current) return;
        rafRef.current = requestAnimationFrame(() => { rafRef.current = 0; measure(); });
    }, [measure]);

    const scrollToTile = useCallback((index: number, smooth = true) => {
        const sc = scrollerRef.current;
        const el = tileRefs.current[index];
        if (!sc || !el) return;
        if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
        pendingRef.current = smooth ? index : null;
        if (smooth) {
            // Säkerhetsnät: står raden redan där (inga scrollhändelser kommer)
            // eller avbryts glidet, släpps beställningen ändå.
            pendingTimerRef.current = setTimeout(() => { pendingRef.current = null; measure(); }, 900);
        }
        if (index !== focusRef.current) {
            focusRef.current = index;
            setFocus(index);
        }
        sc.scrollTo({ left: scrollLeftFor(tileCenter(el), sc.clientWidth, sc.scrollWidth), behavior: smooth ? 'smooth' : 'auto' });
    }, [measure]);

    // Fingret (eller musen) tar raden: valet följer mätningen igen.
    const releasePending = useCallback(() => {
        pendingRef.current = null;
        if (pendingTimerRef.current) { clearTimeout(pendingTimerRef.current); pendingTimerRef.current = null; }
    }, []);

    // Ny rad (sökning, tillbaka från kategoristeget): ställ valet i mitten -
    // det man redan valt om det finns i raden, annars första brickan. Före
    // första målningen, så brickorna aldrig syns i fel storlek.
    useIsoLayoutEffect(() => {
        if (step !== 'city') return;
        tileRefs.current.length = tiles.length;
        const start = Math.max(0, tiles.findIndex(t => (t.city?.name ?? null) === (city?.name ?? null)));
        // -1 så scrollToTile alltid sätter valet, även när raden krympt.
        focusRef.current = -1;
        scrollToTile(start, false);
        measure();
        // tiles/city läses bara när raden byts (tileKey) - ett val ska inte
        // ställa om raden under fingret.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tileKey, step, measure, scrollToTile]);

    useEffect(() => {
        const onResize = () => measure();
        window.addEventListener('resize', onResize);
        return () => {
            window.removeEventListener('resize', onResize);
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
            if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
        };
    }, [measure]);

    // Utgången: texten zoomar ner i kartan (samma som välkomstskärmen), sedan
    // körs svaret.
    const leave = useCallback((then: () => void) => {
        if (closingRef.current) return;
        closingRef.current = true;
        setClosing(true);
        window.setTimeout(then, EXIT_MS);
    }, []);

    const dismiss = useCallback(() => {
        track('startstad_dismiss');
        leave(onDismiss);
    }, [leave, onDismiss]);
    const dismissRef = useRef(dismiss);
    dismissRef.current = dismiss;
    const stepRef = useRef(step);
    stepRef.current = step;
    const tileCountRef = useRef(tiles.length);
    tileCountRef.current = tiles.length;

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') { dismissRef.current(); return; }
            // Piltangenterna bläddrar i karusellen - utom i sökfältet, där de
            // flyttar markören.
            if (stepRef.current !== 'city' || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
            if (document.activeElement instanceof HTMLInputElement) return;
            e.preventDefault();
            scrollToTile(stepTile(focusRef.current, e.key === 'ArrowRight' ? 1 : -1, tileCountRef.current));
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [scrollToTile]);

    // Vanligt (lodrätt) scrollhjul tar ETT steg i taget. Rullar man i sidled
    // (styrplatta) sköter webbläsaren det själv.
    const onWheel = (e: React.WheelEvent<HTMLDivElement>) => {
        if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) { releasePending(); return; }
        const now = performance.now();
        if (now - wheelAtRef.current < WHEEL_STEP_MS) return;
        wheelAtRef.current = now;
        scrollToTile(stepTile(focusRef.current, e.deltaY > 0 ? 1 : -1, tiles.length));
    };

    const pickCity = (c: CityPoint | null) => {
        setCity(c);
        track(c ? 'startstad_city' : 'startstad_here');
        if (!c) onPickHere?.();
        if (withCategories) { setStep('categories'); stageRef.current?.scrollTo({ top: 0 }); }
        else leave(() => onDone({ city: c }));
    };

    const toggleKat = (k: EventCategoryType) => { setKats(prev => {
        const next = new Set(prev);
        if (next.has(k)) next.delete(k); else next.add(k);
        return next;
    }); };

    const focused: StartCityChip | undefined = tiles[focus];
    const ctaLabel = !focused ? 'Välj en stad' : focused.city ? `Starta i ${focused.city.name}` : 'Starta där jag är';

    // Radens plats i poppen (ms från start), som i välkomstskärmen.
    const d = (ms: number) => ({ '--d': `${ms}ms` } as React.CSSProperties);

    const chipBase = 'px-3.5 py-2 rounded-full text-sm font-bold transition-colors active:scale-[0.97] outline-none focus-visible:ring-2 focus-visible:ring-[#FECC02]/80';
    const chipOff = 'bg-white/15 text-white ring-1 ring-inset ring-white/30 hover:bg-white/25';
    const chipOn = 'bg-white text-[#006AA7] [text-shadow:none]';
    const roundBtn = 'grid h-9 w-9 place-items-center rounded-full bg-white/15 text-white ring-1 ring-inset ring-white/30 hover:bg-white/30 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#FECC02]/80';

    return (
        <div
            role="dialog"
            aria-modal
            aria-label="Välj startstad"
            data-start-screen
            className={`fixed inset-0 z-[2000] flex items-center justify-center p-4 ${closing ? 'welcome-backdrop-out' : ''}`}
            style={{ '--welcome-exit-ms': `${EXIT_MS}ms` } as React.CSSProperties}
        >
            {/* Samma duk som välkomstskärmen: kartan tonas ner, ingen ruta. */}
            <div className={`welcome-backdrop absolute inset-0 ${fromWelcome ? 'welcome-backdrop-held' : ''}`} onClick={dismiss} />
            <div
                ref={stageRef}
                className={`welcome-stage relative w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto overflow-x-hidden no-scrollbar px-3 pt-3 pb-4 text-white ${closing ? 'welcome-card-out' : ''}`}
            >
                <button
                    type="button"
                    onClick={dismiss}
                    aria-label="Stäng"
                    className={`${roundBtn} absolute top-2 right-2 z-20`}
                >
                    <X size={18} />
                </button>
                {step === 'city' ? (
                    <div key="city" className="flex flex-col items-center gap-4">
                        <div className="flex flex-col gap-1.5 px-10 text-center">
                            <h2 className="welcome-row welcome-row-big welcome-logo text-[28px] font-black italic uppercase leading-none tracking-tight text-white" style={d(0)}>
                                Var vill du börja?
                            </h2>
                            <p className="welcome-row text-[13px] font-semibold leading-snug text-white/85" style={d(110)}>
                                Kartan öppnar där varje gång du kommer tillbaka. Du kan ändra det sen.
                            </p>
                        </div>

                        {/* KARUSELLEN. Brickorna snäpper mot mitten; kanterna
                            tonar ut så man ser att raden fortsätter. Fingret
                            sköter webbläsaren (scroll-snap), musen har pilarna,
                            hjulet och piltangenterna. pt/pb ger "Ditt val"-
                            märket och brickornas skugga plats innanför
                            scrollkanten. */}
                        <div className="relative w-full">
                            {tiles.length === 0 ? (
                                <p className="welcome-row py-10 text-center text-sm font-semibold text-white/85" style={d(0)}>
                                    Hittar ingen ort som heter så.
                                </p>
                            ) : (
                                <>
                                    <div
                                        ref={scrollerRef}
                                        onScroll={onScroll}
                                        onWheel={onWheel}
                                        onTouchStart={releasePending}
                                        onPointerDown={e => { if (e.pointerType !== 'mouse') releasePending(); }}
                                        role="listbox"
                                        aria-label="Städer"
                                        aria-orientation="horizontal"
                                        // På pekskärm går raden ända ut i spaltens kanter
                                        // (-mx-3), så mer av grannbrickorna syns. Med
                                        // muspekare lämnar den i stället en ränna på var
                                        // sida åt pilarna, så de inte ligger över
                                        // grannbrickans namn.
                                        className="relative flex items-center gap-3 overflow-x-auto no-scrollbar snap-x snap-mandatory pt-4 pb-8 [mask-image:linear-gradient(to_right,transparent,black_13%,black_87%,transparent)] -mx-3 [@media(hover:hover)]:mx-10"
                                    >
                                        {/* Utfyllnad så första och sista brickan kan stå i mitten. */}
                                        <span aria-hidden className="shrink-0 w-[calc(50%-4.75rem-0.75rem)]" />
                                        {tiles.map((tile, i) => (
                                            <div
                                                key={tile.key}
                                                ref={el => { tileRefs.current[i] = el; }}
                                                className="welcome-chip shrink-0 snap-center"
                                                style={d(220 + Math.min(i, 5) * 60)}
                                            >
                                                <button
                                                    type="button"
                                                    role="option"
                                                    aria-selected={i === focus}
                                                    data-focus={i === focus}
                                                    // Brickan i mitten startar; en granne rullas in i mitten.
                                                    onClick={() => (i === focusRef.current ? pickCity(tile.city) : scrollToTile(i))}
                                                    className="game-tile relative flex h-[5.5rem] w-[9.5rem] flex-col items-center justify-center gap-1.5 rounded-[22px] px-2.5 text-white outline-none focus-visible:ring-4 focus-visible:ring-white/80"
                                                >
                                                    {tile.selected && (
                                                        <span className="absolute -top-2.5 right-2 rounded-full bg-[#FECC02] px-2 py-0.5 text-[9px] font-black uppercase not-italic tracking-wider text-[#00314f] shadow-md [text-shadow:none]">
                                                            Ditt val
                                                        </span>
                                                    )}
                                                    {tile.city
                                                        ? <MapPin size={20} strokeWidth={2.6} aria-hidden />
                                                        : <LocateFixed size={20} strokeWidth={2.6} aria-hidden />}
                                                    <span className="block max-w-full truncate text-[17px] font-black italic uppercase leading-none tracking-tight">
                                                        {tile.city?.name ?? 'Där jag är'}
                                                    </span>
                                                </button>
                                            </div>
                                        ))}
                                        <span aria-hidden className="shrink-0 w-[calc(50%-4.75rem-0.75rem)]" />
                                    </div>
                                    {/* Pilarna: bara där det finns en muspekare. */}
                                    <button
                                        type="button"
                                        aria-label="Föregående stad"
                                        disabled={focus <= 0}
                                        onClick={() => scrollToTile(stepTile(focus, -1, tiles.length))}
                                        className={`${roundBtn} !hidden [@media(hover:hover)]:!grid absolute left-0 top-[3.75rem] z-10 -translate-y-1/2 disabled:opacity-0`}
                                    >
                                        <ChevronLeft size={20} strokeWidth={3} />
                                    </button>
                                    <button
                                        type="button"
                                        aria-label="Nästa stad"
                                        disabled={focus >= tiles.length - 1}
                                        onClick={() => scrollToTile(stepTile(focus, 1, tiles.length))}
                                        className={`${roundBtn} !hidden [@media(hover:hover)]:!grid absolute right-0 top-[3.75rem] z-10 -translate-y-1/2 disabled:opacity-0`}
                                    >
                                        <ChevronRight size={20} strokeWidth={3} />
                                    </button>
                                    {/* Var i raden man står: en prick per bricka, mittens är gul och lång. */}
                                    <div aria-hidden className="welcome-row -mt-3 flex items-center justify-center gap-1.5" style={d(420)}>
                                        {tiles.map((tile, i) => (
                                            <span
                                                key={tile.key}
                                                className={`h-1.5 rounded-full transition-all duration-300 ${i === focus ? 'w-5 bg-[#FECC02]' : 'w-1.5 bg-white/45'}`}
                                            />
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>

                        <button
                            type="button"
                            autoFocus
                            disabled={!focused}
                            onClick={() => focused && pickCity(focused.city)}
                            className="welcome-row game-btn flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-[17px] font-black italic uppercase leading-none tracking-tight outline-none focus-visible:ring-4 focus-visible:ring-white/80"
                            style={d(500)}
                        >
                            <Play size={17} fill="currentColor" strokeWidth={0} aria-hidden />
                            {/* key = etiketten: byts staden i mitten poppar texten till. */}
                            <span key={ctaLabel} className="game-label-swap max-w-[16rem] truncate py-0.5">{ctaLabel}</span>
                        </button>

                        {/* Sökfältet ligger UNDER raden med flit: med tangentbordet
                            uppe står träffarna och startknappen kvar ovanför fältet. */}
                        <label className="welcome-row relative block w-full" style={d(580)}>
                            <span className="sr-only">Sök ort</span>
                            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/70" aria-hidden />
                            <input
                                type="search"
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                placeholder={`Sök bland ${START_CITY_COUNT} orter`}
                                autoComplete="off"
                                enterKeyHint="search"
                                onKeyDown={e => { if (e.key === 'Enter' && focused) pickCity(focused.city); }}
                                className="w-full rounded-2xl bg-white/15 py-3 pl-10 pr-4 text-[16px] font-semibold text-white placeholder:text-white/65 ring-1 ring-inset ring-white/30 outline-none focus:ring-2 focus:ring-[#FECC02]/80 [text-shadow:none]"
                            />
                        </label>

                        <button
                            type="button"
                            onClick={() => { track('startstad_skip'); leave(onSkip); }}
                            className="welcome-row py-1 text-xs font-bold text-white/75 hover:text-white transition-colors"
                            style={d(660)}
                        >
                            {withCategories ? 'Hoppa över' : 'Avbryt'}
                        </button>
                    </div>
                ) : (
                    <div key="categories" className="flex flex-col items-center gap-4">
                        <button
                            type="button"
                            onClick={() => setStep('city')}
                            aria-label="Tillbaka till stad"
                            className={`${roundBtn} absolute top-2 left-2 z-20`}
                        >
                            <ArrowLeft size={18} />
                        </button>
                        <div className="flex flex-col gap-1.5 px-10 text-center">
                            <h2 className="welcome-row welcome-row-big welcome-logo text-[28px] font-black italic uppercase leading-none tracking-tight text-white" style={d(0)}>
                                Vad gillar du?
                            </h2>
                            <p className="welcome-row text-[13px] font-semibold leading-snug text-white/85" style={d(110)}>
                                {city ? `Vi visar det först i ${city.name}.` : 'Vi visar det först där du är.'} Du ser allt annat också.
                            </p>
                        </div>

                        <div className="welcome-row flex flex-wrap justify-center gap-2" style={d(220)}>
                            <button
                                type="button"
                                aria-pressed={pop}
                                onClick={() => setPop(v => !v)}
                                className={`${chipBase} ${pop ? 'bg-[#ea580c] text-white [text-shadow:none]' : chipOff}`}
                            >
                                <span aria-hidden className="mr-1">🔥</span>
                                Populära
                            </button>
                            {CATEGORY_KEYS.map(k => {
                                const on = kats.has(k);
                                return (
                                    <button
                                        key={k}
                                        type="button"
                                        aria-pressed={on}
                                        onClick={() => toggleKat(k)}
                                        className={`${chipBase} ${on ? chipOn : chipOff}`}
                                    >
                                        <span aria-hidden className="mr-1">{EVENT_CATEGORIES[k].emoji}</span>
                                        {EVENT_CATEGORIES[k].label}
                                    </button>
                                );
                            })}
                            {/* Inga källchips här (#283, ägarbeslut 23/11): "Fler …" med
                                kyrkan, PRO och Korpen var "visa bara källan" och släckte
                                kategorierna. Källorna nås via Fler i sökpanelen. */}
                        </div>

                        <button
                            type="button"
                            autoFocus
                            onClick={() => { track('startstad_done'); leave(() => onDone({ city, filter: { kats: [...kats], pop } })); }}
                            className="welcome-row game-btn group flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-[17px] font-black italic uppercase leading-none tracking-tight outline-none focus-visible:ring-4 focus-visible:ring-white/80"
                            style={d(340)}
                        >
                            <span className="py-0.5">{kats.size > 0 || pop ? 'Visa kartan' : 'Visa allt'}</span>
                            <ArrowRight size={19} strokeWidth={3} className="transition-transform group-hover:translate-x-1" aria-hidden />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
