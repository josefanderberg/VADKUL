'use client';

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface WelcomeBoxProps {
    /** Antal unika event idag. */
    today: number;
    /** Antal event som börjar inom withinHours timmar. */
    withinHour: number;
    /** Tidsfönstret i timmar (oftast 1) — styr labeln "inom N timme/timmar". */
    withinHours: number;
    /** Stäng rutan. */
    onDismiss: () => void;
}

/**
 * Ren, "seriös" informationsruta som ersätter det lekfulla startmolnet
 * (CloudPopup). Visar dagens två nyckeltal: antal event idag + antal som börjar
 * inom en timme. Kompakt kort, neutral grå för "idag" och orange för "inom 1
 * timme" (matchar de imminenta eventens kant på kartan). Visas BARA när vald dag
 * är idag — gaten ligger i V2Map (cloudStats.isToday).
 */
export default function WelcomeBox({ today, withinHour, withinHours, onDismiss }: WelcomeBoxProps) {
    // Stäng automatiskt efter 20 s. Ref:en gör att timern sätts EN gång (vid mount)
    // och inte nollställs om föräldern råkar skicka en ny onDismiss vid re-render.
    const onDismissRef = useRef(onDismiss);
    onDismissRef.current = onDismiss;
    useEffect(() => {
        const t = setTimeout(() => onDismissRef.current(), 20000);
        return () => clearTimeout(t);
    }, []);

    return (
        <div className="fixed top-[88px] left-1/2 -translate-x-1/2 z-[1200] pointer-events-auto animate-in fade-in slide-in-from-top-2 duration-300">
            <div
                role="button"
                tabIndex={0}
                onClick={onDismiss}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onDismiss(); } }}
                title="Stäng"
                className="relative cursor-pointer rounded-2xl bg-white/95 backdrop-blur-md shadow-xl border border-slate-200/70 pl-5 pr-7 py-4 min-w-[260px]"
                style={{ fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}
            >
                <button
                    type="button"
                    onClick={onDismiss}
                    aria-label="Stäng"
                    className="absolute top-2 right-2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                    <X size={16} />
                </button>

                <div className="flex items-stretch justify-center gap-5">
                    <div className="flex flex-col items-center justify-end px-1">
                        {/* Etiketten på EN rad ovanför siffran (ingen radbrytning). */}
                        <span className="text-[11px] font-semibold uppercase tracking-wide leading-none text-slate-500 whitespace-nowrap">
                            event idag
                        </span>
                        <span className="mt-1.5 text-[32px] font-extrabold leading-none tabular-nums text-slate-800">
                            {today}
                        </span>
                    </div>

                    <div className="w-px self-stretch bg-slate-200" />

                    <div className="flex flex-col items-center justify-end px-1">
                        <span className="text-[11px] font-semibold uppercase tracking-wide leading-none text-slate-500 whitespace-nowrap">
                            inom {withinHours} {withinHours === 1 ? 'timme' : 'timmar'}
                        </span>
                        <span className="mt-1.5 text-[32px] font-extrabold leading-none tabular-nums text-orange-500">
                            {withinHour}
                        </span>
                    </div>
                </div>

                <div className="mt-3 text-center text-[11px] font-medium text-slate-400">
                    Alla spontana event i Sverige
                </div>
            </div>
        </div>
    );
}
