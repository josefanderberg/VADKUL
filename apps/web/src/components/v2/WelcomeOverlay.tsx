'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowRight, CalendarPlus, Hand, Mail, MapPin } from 'lucide-react';
import { logEvent } from 'firebase/analytics';
import { analytics } from '@/lib/firebase';
import { ärJulsäsong } from '@/utils/julsasong';

interface WelcomeOverlayProps {
    /** Öppna kontoskaparen (AuthModal) — anropas från sekundärknappen. */
    onCreateAccount: () => void;
    /** Antal event idag att visa inbakat i texten */
    todayEventCount?: number;
    /** Antal event den närmaste veckan — HUVUDSIFFRAN (Josef 11/8): dags-
     *  siffran sålde inte databasens storlek, veckovolymen gör det. */
    weekEventCount?: number;
    /** Fyrar när rutan stängts klart. Föräldern avmonterar den då — overlayn
     *  visas inte längre automatiskt vid sidladdning utan öppnas från
     *  info-knappen, och måste kunna öppnas igen efteråt. */
    onClose?: (toMap?: boolean) => void;
    /** Sant när ett eventkort är öppet (t.ex. djuplänk från en stadssida).
     *  Då lägger sig rutan UNDER kortet (Josef 29/8): den som klickat sig hit
     *  från en stadssida ska se eventet direkt, inte mötas av onboarding.
     *  Rutan väntar bakom och står kvar framför när kortet stängts. Även
     *  tangenterna (Escape/Tab-fällan) släpps så länge kortet ligger överst. */
    underCard?: boolean;
    /** Kartans startstad (Josef 8/10: "man kanske vill kunna välja"): en rad
     *  under knapparna som stänger rutan och öppnar stadsväljaren. name null
     *  = "där du är". Utelämnad (väljaren kommer ändå efter rutan) → döljs. */
    startCity?: { name: string | null; onChange: () => void };
    /** Sant när stadsväljaren kommer direkt efter "Utforska kartan" (första
     *  besöket). Då står duken kvar när texten lämnar - annars blinkar kartan
     *  fram mellan de två stegen (#268). */
    pickerFollows?: boolean;
}

/** Exit-animationens längd — skickas till CSS via --welcome-exit-ms så de inte kan glida isär. */
const EXIT_MS = 300;

/** Har besökaren sett intron förr? Då kör vi snabbspåret (ingen stagger). */
const SEEN_KEY = 'vadkul_seen_welcome_v3';

/** SSR saknar layout-fas — undvik Reacts useLayoutEffect-varning på servern. */
const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/**
 * Återbesöks-beslutet cachas per sidladdning: StrictMode kör effekten dubbelt i
 * dev, och utan cachen skulle körning 2 läsa flaggan som körning 1 just skrev
 * → "återbesök" redan vid första besöket.
 */
let seenDecision: boolean | null = null;

type Flinga = { left: number; top: number; size: number; dur: number; delay: number; sway: number };

/** Julvariantens snö (#255). Flingorna slumpas med ett FAST frö (ingen
 *  Math.random) - samma bild varje gång och ingen hydreringsskillnad.
 *  left i %, top = viloläget (det som syns med reducerad rörelse), storlek
 *  i px, fall- och starttid i s, sway = sidledsdrift i px. */
function snöflingor(antal: number, frö: number, maxTop: number, storlek: [number, number], fart: [number, number], drift: number): Flinga[] {
    let s = frö;
    const slump = () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
    return Array.from({ length: antal }, (_, i) => ({
        // Jämnt utspridda i sidled med lite skakning, så det inte klumpar sig.
        left: ((i + slump()) / antal) * 100,
        top: Math.round(slump() * maxTop),
        size: storlek[0] + Math.round(slump() * (storlek[1] - storlek[0])),
        dur: fart[0] + slump() * (fart[1] - fart[0]),
        delay: -slump() * fart[1],
        sway: Math.round((slump() * 2 - 1) * drift),
    }));
}
/** Över hela skärmen bakom texten (Josef 17/11: "mer snö"). */
const SNÖ_UTE = snöflingor(48, 1225, 0, [3, 8], [9, 16], 40);
/** Glittrande stjärnor (Josef 17/11: "massa glittrande stjärnor" i stället
 *  för julstjärnan). Samma fasta slump; top håller sig kring maskoten (rutans
 *  kvällshimmel revs med rutan i #268), dur = glittrets takt. */
const STJÄRNOR = snöflingor(26, 2412, 62, [5, 12], [1.6, 3.6], 0);

/** Fyruddig glittrande stjärna (#255). */
function Glitter({ size, style }: { size: number; style: React.CSSProperties }) {
    return (
        <svg viewBox="0 0 24 24" width={size} height={size} className="welcome-twinkle absolute" style={style} aria-hidden>
            <path d="M12 0 C12.9 7.6 16.4 11.1 24 12 C16.4 12.9 12.9 16.4 12 24 C11.1 16.4 7.6 12.9 0 12 C7.6 11.1 11.1 7.6 12 0 Z" fill="#FFF6C9" />
        </svg>
    );
}

/** Tomteluvan på maskoten (#255). Ritad för en 96 px stor maskot: rak,
 *  centrerad över molnets högsta topp, spetsen faller åt höger. */
function Tomteluva({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 64 64" className={className} aria-hidden>
            <path d="M11 46 C12 28 24 12 44 9 C46 20 48 33 53 46 Z" fill="#D62839" />
            <path d="M26 44 C28 31 35 19 44 12 C45 23 47 34 51 44 Z" fill="#B81F2F" opacity="0.45" />
            <rect x="5" y="41" width="54" height="13" rx="6.5" fill="#fff" stroke="#c9dbea" strokeWidth="1.5" />
            <circle cx="46" cy="9" r="6.5" fill="#fff" stroke="#c9dbea" strokeWidth="1.5" />
        </svg>
    );
}

function track(name: string) {
    analytics.then(a => { if (a) logEvent(a, name); }).catch(() => { /* analytics avstängt */ });
}

/**
 * Räknar upp mot `target` med ease-out. Tål att target ändras mitt i
 * (eventen laddar inkrementellt) — fortsätter då från nuvarande värde.
 */
function useCountUp(target: number, durationMs = 1200) {
    const [value, setValue] = useState(0);
    const fromRef = useRef(0);
    useEffect(() => {
        const from = fromRef.current;
        if (target === from) return;
        // Dold flik pausar rAF → visa slutvärdet direkt i stället för att fastna på 0.
        if (document.visibilityState === 'hidden') {
            fromRef.current = target;
            setValue(target);
            return;
        }
        let raf = 0;
        const t0 = performance.now();
        const tick = (t: number) => {
            const p = Math.min(1, (t - t0) / durationMs);
            const eased = 1 - Math.pow(1 - p, 3);
            const v = Math.round(from + (target - from) * eased);
            setValue(v);
            fromRef.current = v;
            if (p < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [target, durationMs]);
    return value;
}

/**
 * Onboarding-skärm som visas vid VARJE besök för UTLOGGADE (inloggade slipper
 * den - gaten ligger i page.tsx) och släpper ut användaren på kartan.
 *
 * INGEN RUTA (#268, ägarbeslut 21/11, Josef: "det ska inte vara med bakgrund.
 * utan det ska liksom ploppa fram texten. snyggt mjukt pop men mjukt i
 * början"): texten står direkt över kartan, som tonas ner bakom, och poppar
 * fram rad för rad - maskoten, loggan bokstav för bokstav, siffran, raderna,
 * knapparna. Den vita rutan med himmel, sol och småmoln är RIVEN - bygg inte
 * tillbaka den. Poppen och duken bor i globals.css (welcome-plopp).
 * Återbesökare får samma pop i halva tiden (.welcome-fast).
 */
export default function WelcomeOverlay({ onCreateAccount, todayEventCount, weekEventCount, onClose, underCard = false, startCity, pickerFollows = false }: WelcomeOverlayProps) {
    const [open, setOpen] = useState(true);
    // 'hold' = texten lämnar men duken står kvar åt stadsväljaren som följer.
    const [closing, setClosing] = useState<false | 'fade' | 'hold'>(false);
    const [returning, setReturning] = useState(false);
    const closingRef = useRef(false);
    const cardRef = useRef<HTMLDivElement>(null);
    const onCreateAccountRef = useRef(onCreateAccount);
    onCreateAccountRef.current = onCreateAccount;
    const onCloseRef = useRef(onClose);
    onCloseRef.current = onClose;
    const onChangeCityRef = useRef(startCity?.onChange);
    onChangeCityRef.current = startCity?.onChange;
    const pickerFollowsRef = useRef(pickerFollows);
    pickerFollowsRef.current = pickerFollows;

    // Julvarianten (#255): rutan öppnas bara i webbläsaren (welcomeOpen sätts
    // efter mount), så besökarens egen kalender avgör utan SSR-skillnad.
    const [jul] = useState(() => ärJulsäsong(new Date()));
    // Luvan är en SVG som ritas direkt, molnet en bild som laddas - utan den
    // här grinden svävade luvan ensam tills molnet kom (Josef 17/11: "gör så
    // tomteluvan först visas när molnet renderats klart"). decode() väntar
    // tills bilden är avkodad och kan målas, inte bara nedladdad. Bilden kan
    // redan vara klar (cache) innan onLoad hinner kopplas, därav kollen vid mount.
    const maskotRef = useRef<HTMLImageElement>(null);
    const [maskotKlar, setMaskotKlar] = useState(false);
    const maskotLaddad = useCallback(() => {
        const img = maskotRef.current;
        if (!img) return;
        img.decode().then(() => setMaskotKlar(true), () => setMaskotKlar(true));
    }, []);
    useEffect(() => {
        if (maskotRef.current?.complete && maskotRef.current.naturalWidth > 0) maskotLaddad();
    }, [maskotLaddad]);

    const shownCount = useCountUp(weekEventCount ?? 0);
    // Idag-siffran räknas upp precis som veckosiffran (Josef 1/9).
    const shownToday = useCountUp(todayEventCount ?? 0);

    // Före första målningen så snabbspåret inte flimrar fram ur intro-animationen.
    useIsoLayoutEffect(() => {
        if (seenDecision === null) {
            try {
                seenDecision = !!localStorage.getItem(SEEN_KEY);
                localStorage.setItem(SEEN_KEY, '1');
            } catch {
                seenDecision = false; // privat läge — kör fulla intron
            }
        }
        if (seenDecision) setReturning(true);
    }, []);

    // 'map' = klick bredvid/Escape (Josef 8/10 kväll: "klicka på sidan för
    // att stänga den och komma direkt till sin plats") - rakt till kartan,
    // ingen stadsfråga efteråt.
    const dismiss = useCallback((then: 'account' | 'city' | 'map' | null = null) => {
        if (closingRef.current) return;
        closingRef.current = true;
        // Stadsväljaren tar över direkt ("Byt", eller första besökets
        // "Utforska kartan")? Då lämnar bara texten - duken står kvar.
        setClosing(then === 'city' || (then === null && pickerFollowsRef.current) ? 'hold' : 'fade');
        window.setTimeout(() => {
            setOpen(false);
            onCloseRef.current?.(then === 'map');
            if (then === 'account') onCreateAccountRef.current();
            if (then === 'city') onChangeCityRef.current?.();
        }, EXIT_MS);
    }, []);

    // Escape stänger; Tab hålls kvar inne i dialogen (kartkontrollerna ligger bakom).
    // Under ett eventkort släpps tangenterna helt — annars stal Tab-fällan
    // fokus från kortet (chattfältet m.m.) och Escape stängde rutan osynligt.
    useEffect(() => {
        if (underCard) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                track('welcome_dismiss');
                dismiss('map');
                return;
            }
            if (e.key !== 'Tab') return;
            const card = cardRef.current;
            if (!card) return;
            // Inte bara knappar längre: mejlfältet och kontaktlänken (7/10)
            // ska också ingå i Tab-fällan.
            const focusables = card.querySelectorAll<HTMLElement>('button, input, a[href]');
            if (focusables.length === 0) return;
            const first = focusables[0];
            const last = focusables[focusables.length - 1];
            const active = document.activeElement;
            if (e.shiftKey && (active === first || !card.contains(active))) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && (active === last || !card.contains(active))) {
                e.preventDefault();
                first.focus();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [dismiss, underCard]);

    if (!open) return null;

    // Fyra rader generisk säljtext var det som stod här. Nu räcker TVÅ: siffran
    // ovanför bär "vad är det här", och de tre sakerna man själv kan göra
    // (tipsa/önska/skapa) har flyttat till ett EGET steg efter att rutan
    // stängts — de trängdes ihjäl här inne (Josef 14/8: "det blir för mycket").
    // Rad 2 säljer KONTOT (Josef 1/9: "jag vill ju att folk ska registrera
    // sig och skapa egna event — det hade varit ett mål"): sedan actionrutan
    // (steg 2) revs 26/8 nämndes "lägg upp egna event" ingenstans i
    // onboardingen. Grönt — egna/VADKUL-event är gröna i produkten.
    // (Spara/dela-raden fick lämna plats; max TVÅ rader, Josef 14/8.)
    const rows = [
        {
            icon: <Hand size={19} className="text-white" />,
            text: <>Tryck <span className="font-black text-white">var som helst på kartan</span> för att se vad som händer just där.</>,
        },
        {
            icon: <CalendarPlus size={19} className="text-emerald-300" />,
            text: <>Med ett gratis konto kan du <span className="font-black text-white">lägga upp egna event</span> och spara favoriter.</>,
        },
    ];

    // Varje rads plats i poppen (ms från start). CSS:en gångrar med takten,
    // så återbesökare får samma ordning i halva tiden.
    const d = (ms: number) => ({ '--d': `${ms}ms` } as React.CSSProperties);

    // Det finns ingen ruta att trycka bredvid längre: ett tryck var som helst
    // som inte träffar en knapp eller länk går rakt till kartan (Josef 8/10:
    // "klicka på sidan för att stänga den och komma direkt till sin plats").
    const onStageClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if ((e.target as HTMLElement).closest('button, a, input')) return;
        track('welcome_dismiss');
        dismiss('map');
    };

    return (
        <div
            role="dialog"
            aria-modal={!underCard}
            aria-label="Välkommen till VADKUL"
            data-start-screen
            className={`fixed inset-0 ${underCard ? 'z-[1240]' : 'z-[2000]'} flex items-center justify-center p-4 ${closing === 'fade' ? 'welcome-backdrop-out' : ''}`}
            style={{ '--welcome-exit-ms': `${EXIT_MS}ms` } as React.CSSProperties}
        >
            {/* DUKEN (#268): ingen ruta bakom texten, så kartan tonas ner i
                stället - mörkast bakom textens mitt, tunnare mot kanterna
                (.welcome-backdrop i globals.css). Fortfarande genomskinlig:
                kartan med eventbrickorna ska synas bakom (Josef 13/8).
                Ingen backdrop-blur: filter ovanpå WebGL-kartan är dyrt på
                svaga mobiler. */}
            <div className="welcome-backdrop absolute inset-0" onClick={() => { track('welcome_dismiss'); dismiss('map'); }} />
            {/* Snön faller över hela skärmen bakom texten (#255). Klick går
                igenom till duken; döljs helt med reducerad rörelse (CSS). */}
            {jul && (
                <div className="welcome-snow-screen absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
                    {SNÖ_UTE.map((f, i) => (
                        <span
                            key={i}
                            className="welcome-snow-big absolute top-0 rounded-full bg-white"
                            style={{
                                left: `${f.left}%`,
                                width: f.size,
                                height: f.size,
                                animationDuration: `${f.dur}s`,
                                animationDelay: `${f.delay}s`,
                                '--snow-sway': `${f.sway}px`,
                            } as React.CSSProperties}
                        />
                    ))}
                </div>
            )}
            {/* SPALTEN. Ingen bakgrund, ingen ram - bara texten (cardRef
                heter så för Tab-fällans skull). px/py ger skuggor, maskotens
                svävning och poppens överslag plats innanför scrollkanten. */}
            <div
                ref={cardRef}
                onClick={onStageClick}
                className={`welcome-stage relative w-full max-w-sm max-h-[calc(100dvh-2rem)] overflow-y-auto overflow-x-hidden no-scrollbar px-3 py-3 flex flex-col items-center gap-5 text-white ${
                    returning ? 'welcome-fast' : ''
                } ${closing ? 'welcome-card-out' : ''}`}
            >
                {/* ── Maskoten: det glada molnet poppar först och svävar sedan.
                    Göms på låga skärmar så knapparna alltid ryms. ── */}
                <div
                    className={`welcome-row welcome-row-big relative w-full shrink-0 ${jul ? 'h-[128px]' : 'h-[112px]'} [@media(max-height:640px)]:hidden`}
                    style={d(0)}
                    aria-hidden="true"
                >
                    {/* GLITTRANDE STJÄRNOR (#255) kring maskoten under jul.
                        (En stor gul julstjärna prövades och togs bort samma
                        dag, Josef 17/11. Snö i själva rutan likaså - snön
                        faller bara över skärmen.) */}
                    {jul && STJÄRNOR.map((s, i) => (
                        <Glitter
                            key={i}
                            size={s.size}
                            style={{ left: `${s.left}%`, top: s.top, animationDuration: `${s.dur}s`, animationDelay: `${s.delay}s` }}
                        />
                    ))}
                    {/* Med tomteluvan längre ner så luvan får luft uppåt
                        (Josef 17/11). */}
                    <div className={`absolute inset-x-0 ${jul ? 'top-7' : 'top-3'} flex justify-center`}>
                        {/* Luvan svävar MED molnet: animationen sitter på
                            wrappern när det är jul (#255). */}
                        <div className={`relative w-24 h-24 ${jul ? 'animate-welcome-float' : ''}`}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                ref={maskotRef}
                                src="/favicon.png"
                                alt=""
                                onLoad={maskotLaddad}
                                className={`w-24 h-24 drop-shadow-[0_10px_18px_rgba(0,20,45,0.5)] ${jul ? '' : 'animate-welcome-float'}`}
                            />
                            {/* (Ett tomteskägg prövades och togs bort samma
                                dag, Josef 17/11: "ta bort skägget". Molnet
                                ritat som SVG prövades också och lades ned -
                                bilden används.) */}
                            {jul && <Tomteluva className={`absolute -top-[17px] left-[21px] w-[54px] h-[54px] drop-shadow-[0_2px_3px_rgba(0,0,0,0.15)] ${maskotKlar ? '' : 'invisible'}`} />}
                        </div>
                    </div>
                </div>

                {/* ── Logga: bokstäver som poppar in + gult streck som ritas ── */}
                <div className="flex flex-col items-center text-center gap-1.5 -mt-2">
                    <h2 className="welcome-logo text-[40px] font-black italic text-white font-sans tracking-tighter leading-none uppercase select-none">
                        {'VADKUL'.split('').map((ch, i) => (
                            <span key={i} className="welcome-letter inline-block" style={d(160 + i * 55)}>{ch}</span>
                        ))}
                    </h2>
                    <span className="welcome-underline block h-[5px] w-28 rounded-full bg-[#FECC02] shadow-[0_2px_8px_rgba(0,20,45,0.5)]" style={d(520)} />
                    {/* SIFFRAN ÄR RUBRIKEN. VECKANS antal, inte dagens (Josef
                        11/8) - veckovolymen är det som visar hur stor
                        databasen faktiskt är. Tre rader (Josef 1/9 kväll):
                        "13 996 event" / "den närmaste veckan i hela Sverige"
                        / "2 551 redan idag". */}
                    <p className="welcome-row welcome-row-big mt-2 flex items-baseline justify-center gap-2" style={d(620)}>
                        <span className="text-[46px] leading-none font-black tabular-nums text-white">
                            {shownCount > 0 ? shownCount.toLocaleString('sv-SE') : '…'}
                        </span>
                        <span className="text-[17px] font-black uppercase tracking-wide text-[#FECC02]">event</span>
                    </p>
                    <p className="welcome-row text-[14px] font-bold text-white/90 leading-snug px-2" style={d(720)}>
                        den närmaste veckan i hela Sverige
                    </p>
                    {todayEventCount && todayEventCount > 0 ? (
                        <p className="welcome-row mt-1 text-[16px] font-black text-white/90 leading-none tabular-nums" style={d(800)}>
                            <span className="text-[20px] text-emerald-300">{shownToday.toLocaleString('sv-SE')}</span>
                            {' '}redan idag
                        </p>
                    ) : null}
                    {/* ("N börjar inom en timme"-badgen låg här - borttagen
                        26/8 på ägarbeslut: lägg inte tillbaka den.) */}
                </div>

                {/* (Här låg tre riktiga event ur datan. Borttaget 14/8: rutan
                    blev för mycket att läsa, och det man SJÄLV kan göra tas
                    nu i ett eget steg efter att rutan stängts.) */}

                {/* ── Punkterna poppar in en och en ── */}
                <ul className="flex flex-col gap-3 w-full max-w-[19.5rem]">
                    {rows.map((row, i) => (
                        <li key={i} className="welcome-row flex items-center gap-3 text-left" style={d(900 + i * 90)}>
                            <span className="shrink-0 grid place-items-center w-9 h-9 rounded-xl bg-white/15 ring-1 ring-inset ring-white/25">{row.icon}</span>
                            <span className="text-[13.5px] font-semibold text-white/90 leading-snug">{row.text}</span>
                        </li>
                    ))}
                </ul>

                <div className="flex flex-col gap-2.5 w-full">
                    <button
                        type="button"
                        autoFocus
                        onClick={() => { track('welcome_explore_map'); dismiss(); }}
                        className="welcome-row welcome-cta group relative w-full py-3.5 rounded-2xl bg-[#006AA7] hover:bg-[#005590] text-white font-black text-base [text-shadow:none] shadow-xl shadow-black/30 ring-1 ring-inset ring-white/30 active:scale-[0.98] transition-[background-color,transform] flex items-center justify-center gap-2 overflow-hidden outline-none focus-visible:ring-4 focus-visible:ring-[#FECC02]/70"
                        style={d(1100)}
                    >
                        Utforska kartan
                        <ArrowRight size={19} strokeWidth={2.5} className="transition-transform group-hover:translate-x-1" />
                    </button>
                    {/* Riktig sekundärknapp, inte textlänk (Josef 1/9 -
                        registreringar är målet): samma tyngd som primären
                        minus fyllningen. */}
                    <button
                        type="button"
                        onClick={() => { track('welcome_create_account'); dismiss('account'); }}
                        className="welcome-row w-full py-3 rounded-2xl border-2 border-white/45 bg-white/10 hover:bg-white/20 hover:border-white/70 text-white font-black text-sm active:scale-[0.98] transition-[background-color,border-color,transform] outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                        style={d(1180)}
                    >
                        Skapa gratis konto
                    </button>
                    {/* Startstaden (8/10): byts här vid varje besök -
                        frågan efter rutan kommer bara en gång. */}
                    {startCity && (
                        <button
                            type="button"
                            onClick={() => { track('welcome_change_city'); dismiss('city'); }}
                            className="welcome-row self-center inline-flex items-center gap-1.5 pt-1 text-[12.5px] font-bold text-white/85 hover:text-white transition-colors outline-none focus-visible:underline"
                            style={d(1260)}
                        >
                            <MapPin size={13} aria-hidden />
                            Kartan startar i {startCity.name ?? 'där du är'}
                            <span className="font-black text-[#FECC02]">· Byt</span>
                        </button>
                    )}
                </div>

                {/* KARTANS KÄLLOR (15/9): kartans egen ⓘ-attribution är
                    borttagen - 🔥 täckte hörnet. OSMF:s attributionsriktlinje
                    godkänner attribution i en startruta som visas när man
                    öppnar sidan, så länge den går att hitta igen via "Om"
                    (profilpanelens Om VADKUL / inloggningsrutans länk öppnar
                    just den här rutan). CARTO (baskartans kakel) kräver också
                    att nämnas. Ta INTE bort raden utan att lägga tillbaka
                    attributionen på kartan. */}
                {/* FRÅGOR? + mejlikon PÅ SAMMA RAD som kartkällorna
                    (ägarbeslut 7/10 kväll, Josef: "Det räcker med en
                    frågor? och mailikon på samma rad som det med kartan.
                    inte att man skiver in mail för nyheter. bättre man
                    direkt blir medlem" - mejlfältet för appnyheter är
                    RIVET, lägg inte tillbaka det; medlemskapet säljs av
                    Skapa gratis konto-knappen). Kontaktvägen för
                    utloggade: rutan visas bara för dem. */}
                <p className="welcome-row -mt-1.5 flex flex-wrap items-center justify-center gap-x-1.5 text-center text-[11px] font-semibold text-white/70 leading-snug" style={d(1340)}>
                    <a
                        href="mailto:hej@vadkul.se"
                        onClick={() => track('welcome_contact_mail')}
                        title="Mejla hej@vadkul.se"
                        className="inline-flex items-center gap-1 font-black hover:text-white transition-colors"
                    >
                        Frågor?
                        <Mail size={12} aria-hidden />
                    </a>
                    <span aria-hidden>·</span>
                    <span>
                        Kartdata ©{' '}
                        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener" className="underline hover:text-white">OpenStreetMap</a>
                        {' '}· ©{' '}
                        <a href="https://carto.com/attributions" target="_blank" rel="noopener" className="underline hover:text-white">CARTO</a>
                        {/* Vädret i stadsplattan (#202) - CC BY. (Höjddata Mapzen
                            försvann med höjdreliefen från #197, riven i #203; #260.) */}
                        {' '}· Väder{' '}
                        <a href="https://www.smhi.se/data/om-smhis-data/villkor-for-anvandning" target="_blank" rel="noopener" className="underline hover:text-white">SMHI</a>
                    </span>
                </p>
            </div>
        </div>
    );
}
