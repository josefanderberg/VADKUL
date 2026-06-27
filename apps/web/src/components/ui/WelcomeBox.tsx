'use client';

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
    return (
        <div className="fixed top-[88px] left-1/2 -translate-x-1/2 z-[1200] pointer-events-auto animate-in fade-in slide-in-from-top-2 duration-300">
            <div
                className="relative rounded-2xl bg-white/95 backdrop-blur-md shadow-xl border border-slate-200/70 pl-5 pr-7 py-4 min-w-[260px]"
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
                    <div className="flex flex-col items-center justify-start px-1">
                        <span className="text-[32px] font-extrabold leading-none tabular-nums text-slate-800">
                            {today}
                        </span>
                        <span className="mt-1.5 text-center text-[11px] font-semibold uppercase tracking-wide leading-tight text-slate-500">
                            <span className="whitespace-nowrap">event</span>
                            <br />
                            idag
                        </span>
                    </div>

                    <div className="w-px self-stretch bg-slate-200" />

                    <div className="flex flex-col items-center justify-start px-1">
                        <span className="text-[32px] font-extrabold leading-none tabular-nums text-orange-500">
                            {withinHour}
                        </span>
                        {/* "inom N" hålls ihop på egen rad (whitespace-nowrap) så
                            "inom" och siffran aldrig splittras; tidsenheten bryts
                            alltid ner till rad två → deterministiskt "inom 1 / timme". */}
                        <span className="mt-1.5 text-center text-[11px] font-semibold uppercase tracking-wide leading-tight text-slate-500">
                            <span className="whitespace-nowrap">inom {withinHours}</span>
                            <br />
                            {withinHours === 1 ? 'timme' : 'timmar'}
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
