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
/** I kortets himmel. */
const SNÖ = snöflingor(42, 17, 110, [3, 7], [6, 10.5], 10);
/** Över hela skärmen bakom kortet (Josef 17/11: "mer snö"). */
const SNÖ_UTE = snöflingor(48, 1225, 0, [3, 8], [9, 16], 40);

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

/** Tomteskägget (#255): vitt med molnets blå kontur (helvitt försvann mot
 *  det vita molnet), lockigt i nederkanten. Hänger under leendet. */
function Tomteskägg({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 64 44" className={className} aria-hidden>
            <path
                d="M4 6 C10 10 18 12 32 12 C46 12 54 10 60 6 C62 14 60 22 56 27 C55 32 50 34 46 33 C44 38 39 40 35 38 C33 42 28 42 26 38 C22 40 17 38 16 33 C11 34 7 31 7 27 C3 22 2 14 4 6 Z"
                fill="#fff"
                stroke="#5b9bd5"
                strokeWidth="2.2"
                strokeLinejoin="round"
            />
            <path d="M20 20 C22 24 24 26 27 27 M37 27 C40 26 42 24 44 20 M31 22 C31 27 32 30 32 33" fill="none" stroke="#a9c9e6" strokeWidth="1.6" strokeLinecap="round" />
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
 * den — gaten ligger i page.tsx) och släpper ut användaren på kartan: himmel
 * med sol + drivande moln, logga som poppar in bokstav för bokstav,
 * live-räknare och en zoom-exit ner i kartan.
 * Återbesökare får allt direkt utan stagger (.welcome-fast).
 */
export default function WelcomeOverlay({ onCreateAccount, todayEventCount, weekEventCount, onClose, underCard = false, startCity }: WelcomeOverlayProps) {
    const [open, setOpen] = useState(true);
    const [closing, setClosing] = useState(false);
    const [returning, setReturning] = useState(false);
    const closingRef = useRef(false);
    const cardRef = useRef<HTMLDivElement>(null);
    const onCreateAccountRef = useRef(onCreateAccount);
    onCreateAccountRef.current = onCreateAccount;
    const onCloseRef = useRef(onClose);
    onCloseRef.current = onClose;
    const onChangeCityRef = useRef(startCity?.onChange);
    onChangeCityRef.current = startCity?.onChange;

    // Julvarianten (#255): rutan öppnas bara i webbläsaren (welcomeOpen sätts
    // efter mount), så besökarens egen kalender avgör utan SSR-skillnad.
    const [jul] = useState(() => ärJulsäsong(new Date()));

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
        setClosing(true);
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
            chip: 'bg-[#006AA7]/10',
            icon: <Hand size={19} className="text-[#006AA7]" />,
            text: <>Tryck <span className="font-bold text-slate-900">var som helst på kartan</span> för att se vad som händer just där.</>,
        },
        {
            chip: 'bg-emerald-100',
            icon: <CalendarPlus size={19} className="text-emerald-600" />,
            text: <>Med ett gratis konto kan du <span className="font-bold text-slate-900">lägga upp egna event</span> och spara favoriter.</>,
        },
    ];

    return (
        <div
            role="dialog"
            aria-modal={!underCard}
            aria-label="Välkommen till VADKUL"
            className={`fixed inset-0 ${underCard ? 'z-[1240]' : 'z-[2000]'} flex items-center justify-center p-4 ${closing ? 'welcome-backdrop-out' : ''}`}
            style={{ '--welcome-exit-ms': `${EXIT_MS}ms` } as React.CSSProperties}
        >
            {/* Duken är MEDVETET tunn (Josef 13/8): bakom den reser kartan genom
                Sverige med eventprickarna tända, och det är den resan som säljer
                in tjänsten — 60 % svart gjorde den till en grå yta. 32 % räcker
                för att kortet ska ha ro omkring sig, och prickarnas glöd
                (intro-glow i V2Map) punchar igenom.
                Ingen backdrop-blur: filter ovanpå WebGL-kartan är dyrt på svaga mobiler. */}
            <div className="welcome-backdrop absolute inset-0 bg-black/[0.32]" onClick={() => { track('welcome_dismiss'); dismiss('map'); }} />
            {/* Snön faller över hela skärmen bakom kortet (#255). Klick går
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
            <div
                ref={cardRef}
                className={`relative w-full max-w-sm max-h-[calc(100dvh-2rem)] overflow-y-auto overflow-x-hidden bg-white rounded-[28px] shadow-2xl ${
                    returning ? 'welcome-fast' : ''
                } ${closing ? 'welcome-card-out' : 'animate-in fade-in zoom-in-95 duration-300'}`}
            >
                {/* ── Himmel: sol + drivande moln + svävande maskot ── */}
                <div className="relative h-[132px] overflow-hidden" aria-hidden="true">
                    {/* Himlen ANDAS (1/9): gradientlagret är HÖGRE än headern
                        (164px mot 132) och glider sakta ner/upp — det blå når
                        ibland längre ner innan det vänder. */}
                    {/* Stoppen är explicita (to-white vid 75 % = 132px av 176)
                        så gradienten är HELT vit innan klippkanten i ALLA
                        andningsfaser — annars mötte en blåtonad rest kortets
                        vita kropp som en synlig kant (1/9). */}
                    {/* Julhimlen (#255) är en aning djupare vinterblå så att
                        snön syns; samma stopp, så den möter kortet lika vitt. */}
                    <div className={`welcome-sky absolute inset-x-0 top-0 h-[176px] bg-gradient-to-b ${jul ? 'from-[#86bfea] via-[#d3eafb]' : 'from-[#b8e0ff] via-[#e3f3ff]'} via-40% to-white to-[75%]`} />
                    {jul ? (
                        /* JULSTJÄRNAN (#255) i solens hörn, med samma
                           roterande strålar bakom sig. Hela stjärnan syns -
                           solen fick klippas av hörnet, en stjärna kan inte. */
                        <div className="welcome-sun-drift absolute top-2.5 right-4 w-[52px] h-[52px]">
                            <div className="welcome-rays absolute -inset-12 rounded-full blur-[5px] [mask-image:radial-gradient(circle,black_30%,transparent_72%)]" />
                            <svg viewBox="0 0 24 24" className="welcome-star absolute inset-0 w-full h-full">
                                <path d="M12 1.6l2.95 6.55 7.15.72-5.38 4.77 1.55 7.02L12 17.05l-6.27 3.61 1.55-7.02L1.9 8.87l7.15-.72z" fill="#FECC02" stroke="#F5B700" strokeWidth="0.6" strokeLinejoin="round" />
                            </svg>
                        </div>
                    ) : (
                        /* Solen driver sakta (wrappern) med roterande strålar
                           bakom sig; pulsen ligger kvar på själva solen. */
                        <div className="welcome-sun-drift absolute -top-7 -right-7 w-24 h-24">
                            {/* blur + radiell mask = mjuka strålar som tonar ut
                                mot spetsarna (skarpa conic-kanter såg klippta ut). */}
                            <div className="welcome-rays absolute -inset-16 rounded-full blur-[5px] [mask-image:radial-gradient(circle,black_30%,transparent_72%)]" />
                            <div className="welcome-sun absolute inset-0 rounded-full bg-[#FECC02]" />
                        </div>
                    )}

                    {/* SNÖN (#255): flingorna faller genom himlen och tonar ut
                        i det vita. Med reducerad rörelse står de stilla på sin
                        viloplats (top). */}
                    {jul && SNÖ.map((f, i) => (
                        <span
                            key={i}
                            className="welcome-snow absolute rounded-full bg-white"
                            style={{
                                left: `${f.left}%`,
                                top: f.top,
                                width: f.size,
                                height: f.size,
                                animationDuration: `${f.dur}s`,
                                animationDelay: `${f.delay}s`,
                                '--snow-sway': `${f.sway}px`,
                            } as React.CSSProperties}
                        />
                    ))}

                    {/* Småmoln som driver förbi i olika hastigheter */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/favicon.png" alt="" className="absolute top-3 w-14 h-14 opacity-40 animate-cloud-drift" style={{ animationDuration: '26s', animationDelay: '-4s' }} />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/favicon.png" alt="" className="absolute top-14 w-9 h-9 opacity-30 animate-cloud-drift" style={{ animationDuration: '38s', animationDelay: '-19s' }} />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/favicon.png" alt="" className="absolute top-8 w-11 h-11 opacity-25 animate-cloud-drift" style={{ animationDuration: '32s', animationDelay: '-11s' }} />

                    {/* Maskoten: stort glatt moln som svävar */}
                    <div className="absolute inset-x-0 top-5 flex justify-center">
                        {/* Luvan svävar MED molnet: animationen sitter på
                            wrappern när det är jul (#255). */}
                        <div className={`relative w-24 h-24 ${jul ? 'animate-welcome-float' : ''}`}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src="/favicon.png" alt="" className={`w-24 h-24 drop-shadow-[0_8px_16px_rgba(0,106,167,0.25)] ${jul ? '' : 'animate-welcome-float'}`} />
                            {jul && (
                                <>
                                    <Tomteskägg className="absolute top-[57px] left-[23px] w-[50px] h-[34px] drop-shadow-[0_3px_4px_rgba(0,106,167,0.18)]" />
                                    <Tomteluva className="absolute -top-[17px] left-[21px] w-[54px] h-[54px] drop-shadow-[0_2px_3px_rgba(0,0,0,0.15)]" />
                                </>
                            )}
                        </div>
                    </div>
                </div>

                <div className="relative px-7 pb-7 flex flex-col gap-5 -mt-2">
                    {/* ── Logga: bokstäver som poppar in + gult streck som ritas ── */}
                    <div className="flex flex-col items-center text-center gap-1.5">
                        <h2 className="text-[34px] font-black italic text-[#006AA7] font-sans tracking-tighter leading-none uppercase select-none">
                            {'VADKUL'.split('').map((ch, i) => (
                                <span key={i} className="welcome-letter inline-block" style={{ animationDelay: `${140 + i * 60}ms` }}>{ch}</span>
                            ))}
                        </h2>
                        <span className="welcome-underline block h-[5px] w-24 rounded-full bg-[#FECC02]" style={{ animationDelay: '560ms' }} />
                        {/* SIFFRAN ÄR RUBRIKEN. Den satt förut inbakad mitt i en
                            mening och läste som brödtext; nu är den det första
                            ögat landar på efter loggan. VECKANS antal, inte
                            dagens (Josef 11/8) — veckovolymen är det som visar
                            hur stor databasen faktiskt är. */}
                        {/* Tre rader (Josef 1/9 kväll, slutformen):
                            "13 996 event" / "den närmaste veckan i hela
                            Sverige" / "2 551 redan idag". Ordet event ligger
                            med gemener och tydligt mellanrum bredvid siffran —
                            versal-varianten med tracking läste som fastklistrad. */}
                        <p className="mt-1 flex items-baseline justify-center gap-2">
                            <span className="text-[38px] leading-none font-black tabular-nums text-[#006AA7]">
                                {shownCount > 0 ? shownCount.toLocaleString('sv-SE') : '…'}
                            </span>
                            <span className="text-[16px] font-black uppercase tracking-wide text-slate-500">event</span>
                        </p>
                        <p className="text-[13px] font-bold text-slate-500 leading-snug px-2">
                            den närmaste veckan i hela Sverige
                        </p>
                        {todayEventCount && todayEventCount > 0 ? (
                            <p className="mt-1.5 text-[16px] font-black text-slate-500 leading-none tabular-nums">
                                <span className="text-[19px] text-emerald-600">{shownToday.toLocaleString('sv-SE')}</span>
                                {' '}redan idag
                            </p>
                        ) : null}
                        {/* ("N börjar inom en timme"-badgen låg här — borttagen
                            26/8 på ägarbeslut: lägg inte tillbaka den.) */}
                    </div>

                    {/* (Här låg tre riktiga event ur datan. Borttaget 14/8: rutan
                        blev för mycket att läsa, och det man SJÄLV kan göra tas
                        nu i ett eget steg efter att rutan stängts.) */}

                    {/* ── Punkterna kaskadar in en och en ── */}
                    <ul className="flex flex-col gap-3.5">
                        {rows.map((row, i) => (
                            <li key={i} className="welcome-row flex items-center gap-3" style={{ animationDelay: `${640 + i * 110}ms` }}>
                                <span className={`shrink-0 grid place-items-center w-9 h-9 rounded-xl ${row.chip}`}>{row.icon}</span>
                                <span className="text-[13.5px] font-semibold text-slate-600 leading-snug">{row.text}</span>
                            </li>
                        ))}
                    </ul>

                    <div className="welcome-row flex flex-col gap-2" style={{ animationDelay: '1050ms' }}>
                        <button
                            type="button"
                            autoFocus
                            onClick={() => { track('welcome_explore_map'); dismiss(); }}
                            className="welcome-cta group relative w-full py-3.5 rounded-2xl bg-[#006AA7] hover:bg-[#005590] text-white font-black text-base shadow-lg shadow-[#006AA7]/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 overflow-hidden outline-none focus-visible:ring-4 focus-visible:ring-[#FECC02]/70"
                        >
                            Utforska kartan
                            <ArrowRight size={19} strokeWidth={2.5} className="transition-transform group-hover:translate-x-1" />
                        </button>
                        {/* Riktig sekundärknapp, inte textlänk (Josef 1/9 —
                            registreringar är målet): samma tyngd som primären
                            minus fyllningen. */}
                        <button
                            type="button"
                            onClick={() => { track('welcome_create_account'); dismiss('account'); }}
                            className="w-full py-3 rounded-2xl border-2 border-[#006AA7]/25 text-[#006AA7] hover:bg-[#006AA7]/5 hover:border-[#006AA7]/40 font-black text-sm active:scale-[0.98] transition-all outline-none focus-visible:ring-2 focus-visible:ring-[#006AA7]/40"
                        >
                            Skapa gratis konto
                        </button>
                        {/* Startstaden (8/10): byts här vid varje besök -
                            frågan efter rutan kommer bara en gång. */}
                        {startCity && (
                            <button
                                type="button"
                                onClick={() => { track('welcome_change_city'); dismiss('city'); }}
                                className="self-center inline-flex items-center gap-1.5 pt-1 text-[12.5px] font-bold text-slate-500 hover:text-[#006AA7] transition-colors outline-none focus-visible:underline"
                            >
                                <MapPin size={13} aria-hidden />
                                Kartan startar i {startCity.name ?? 'där du är'}
                                <span className="font-black text-[#006AA7]">· Byt</span>
                            </button>
                        )}
                    </div>

                    {/* KARTANS KÄLLOR (15/9): kartans egen ⓘ-attribution är
                        borttagen — 🔥 täckte hörnet. OSMF:s attributionsriktlinje
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
                        direkt blir medlem" — mejlfältet för appnyheter är
                        RIVET, lägg inte tillbaka det; medlemskapet säljs av
                        Skapa gratis konto-knappen). Kontaktvägen för
                        utloggade: rutan visas bara för dem. */}
                    <p className="welcome-row -mt-2 flex items-center justify-center gap-1.5 text-center text-[11px] font-semibold text-slate-400 leading-snug" style={{ animationDelay: '1150ms' }}>
                        <a
                            href="mailto:hej@vadkul.se"
                            onClick={() => track('welcome_contact_mail')}
                            title="Mejla hej@vadkul.se"
                            className="inline-flex items-center gap-1 font-black hover:text-[#006AA7] transition-colors"
                        >
                            Frågor?
                            <Mail size={12} aria-hidden />
                        </a>
                        <span aria-hidden>·</span>
                        <span>
                            Kartdata ©{' '}
                            <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener" className="underline hover:text-slate-600">OpenStreetMap</a>
                            {' '}· ©{' '}
                            <a href="https://carto.com/attributions" target="_blank" rel="noopener" className="underline hover:text-slate-600">CARTO</a>
                            {/* Höjdreliefen (#197) och vädret i stadsplattan (#202) - båda CC BY. */}
                            {' '}· Höjddata{' '}
                            <a href="https://github.com/tilezen/joerd/blob/master/docs/attribution.md" target="_blank" rel="noopener" className="underline hover:text-slate-600">Mapzen</a>
                            {' '}· Väder{' '}
                            <a href="https://www.smhi.se/data/om-smhis-data/villkor-for-anvandning" target="_blank" rel="noopener" className="underline hover:text-slate-600">SMHI</a>
                        </span>
                    </p>
                </div>
            </div>
        </div>
    );
}
