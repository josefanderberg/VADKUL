'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowRight, Hand, Heart } from 'lucide-react';
import { logEvent } from 'firebase/analytics';
import { analytics } from '@/lib/firebase';

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
    onClose?: () => void;
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
export default function WelcomeOverlay({ onCreateAccount, todayEventCount, weekEventCount, onClose }: WelcomeOverlayProps) {
    const [open, setOpen] = useState(true);
    const [closing, setClosing] = useState(false);
    const [returning, setReturning] = useState(false);
    const closingRef = useRef(false);
    const cardRef = useRef<HTMLDivElement>(null);
    const onCreateAccountRef = useRef(onCreateAccount);
    onCreateAccountRef.current = onCreateAccount;
    const onCloseRef = useRef(onClose);
    onCloseRef.current = onClose;

    const shownCount = useCountUp(weekEventCount ?? 0);

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

    const dismiss = useCallback((thenCreateAccount = false) => {
        if (closingRef.current) return;
        closingRef.current = true;
        setClosing(true);
        window.setTimeout(() => {
            setOpen(false);
            onCloseRef.current?.();
            if (thenCreateAccount) onCreateAccountRef.current();
        }, EXIT_MS);
    }, []);

    // Escape stänger; Tab hålls kvar inne i dialogen (kartkontrollerna ligger bakom).
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                track('welcome_dismiss');
                dismiss();
                return;
            }
            if (e.key !== 'Tab') return;
            const card = cardRef.current;
            if (!card) return;
            const focusables = card.querySelectorAll<HTMLElement>('button');
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
    }, [dismiss]);

    if (!open) return null;

    // Fyra rader generisk säljtext var det som stod här. Nu räcker TVÅ: siffran
    // ovanför bär "vad är det här", och de tre sakerna man själv kan göra
    // (tipsa/önska/skapa) har flyttat till ett EGET steg efter att rutan
    // stängts — de trängdes ihjäl här inne (Josef 14/8: "det blir för mycket").
    const rows = [
        {
            chip: 'bg-[#006AA7]/10',
            icon: <Hand size={19} className="text-[#006AA7]" />,
            text: <>Tryck <span className="font-bold text-slate-900">var som helst på kartan</span> för att se vad som händer just där.</>,
        },
        {
            chip: 'bg-rose-100',
            icon: <Heart size={19} className="text-rose-500" />,
            text: <>Spara favoriter, dela med vänner &amp; håll koll på din stad.</>,
        },
    ];

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-label="Välkommen till VADKUL"
            className={`fixed inset-0 z-[2000] flex items-center justify-center p-4 ${closing ? 'welcome-backdrop-out' : ''}`}
            style={{ '--welcome-exit-ms': `${EXIT_MS}ms` } as React.CSSProperties}
        >
            {/* Duken är MEDVETET tunn (Josef 13/8): bakom den reser kartan genom
                Sverige med eventprickarna tända, och det är den resan som säljer
                in tjänsten — 60 % svart gjorde den till en grå yta. 32 % räcker
                för att kortet ska ha ro omkring sig, och prickarnas glöd
                (intro-glow i V2Map) punchar igenom.
                Ingen backdrop-blur: filter ovanpå WebGL-kartan är dyrt på svaga mobiler. */}
            <div className="welcome-backdrop absolute inset-0 bg-black/[0.32]" onClick={() => { track('welcome_dismiss'); dismiss(); }} />
            <div
                ref={cardRef}
                className={`relative w-full max-w-sm max-h-[calc(100dvh-2rem)] overflow-y-auto overflow-x-hidden bg-white rounded-[28px] shadow-2xl ${
                    returning ? 'welcome-fast' : ''
                } ${closing ? 'welcome-card-out' : 'animate-in fade-in zoom-in-95 duration-300'}`}
            >
                {/* ── Himmel: sol + drivande moln + svävande maskot ── */}
                <div className="relative h-[132px] bg-gradient-to-b from-[#b8e0ff] via-[#e3f3ff] to-white overflow-hidden" aria-hidden="true">
                    {/* Sol i hörnet (svenskgul, klipps mjukt av kortets rundning) */}
                    <div className="welcome-sun absolute -top-7 -right-7 w-24 h-24 rounded-full bg-[#FECC02]" />

                    {/* Småmoln som driver förbi i olika hastigheter */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/favicon.png" alt="" className="absolute top-3 w-14 h-14 opacity-40 animate-cloud-drift" style={{ animationDuration: '26s', animationDelay: '-4s' }} />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/favicon.png" alt="" className="absolute top-14 w-9 h-9 opacity-30 animate-cloud-drift" style={{ animationDuration: '38s', animationDelay: '-19s' }} />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/favicon.png" alt="" className="absolute top-8 w-11 h-11 opacity-25 animate-cloud-drift" style={{ animationDuration: '32s', animationDelay: '-11s' }} />

                    {/* Maskoten: stort glatt moln som svävar */}
                    <div className="absolute inset-x-0 top-5 flex justify-center">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="/favicon.png" alt="" className="w-24 h-24 animate-welcome-float drop-shadow-[0_8px_16px_rgba(0,106,167,0.25)]" />
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
                        <p className="mt-1 flex items-baseline justify-center gap-2">
                            <span className="text-[38px] leading-none font-black tabular-nums text-[#006AA7]">
                                {shownCount > 0 ? shownCount.toLocaleString('sv-SE') : '…'}
                            </span>
                            <span className="text-[15px] font-black uppercase tracking-[0.1em] text-slate-500">event</span>
                        </p>
                        <p className="text-[13px] font-bold text-slate-500 leading-snug px-2">
                            den närmaste veckan i hela Sverige
                            {todayEventCount && todayEventCount > 0
                                ? <> — <span className="text-slate-700">{todayEventCount.toLocaleString('sv-SE')} redan idag</span></>
                                : null}
                        </p>
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
                        <button
                            type="button"
                            onClick={() => { track('welcome_create_account'); dismiss(true); }}
                            className="w-full py-2.5 rounded-2xl text-[#006AA7] hover:bg-slate-50 font-bold text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#006AA7]/40"
                        >
                            Skapa gratis konto
                        </button>
                        <p className="text-center text-[11px] font-semibold text-slate-400 mt-0.5">
                            Gratis att utforska — inget konto behövs.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
