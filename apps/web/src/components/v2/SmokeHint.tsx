'use client';

import { useEffect, useRef, useState } from 'react';
import { buildSmokePuffs, smokeDirFor, SMOKE_BLOW_MS, SMOKE_GONE_MS, type SmokeDir, type SmokePuff } from '@/utils/smokePuff';

interface SmokeHintProps {
    children: React.ReactNode;
    /** Fyrar när röken lagt sig och tipset kan avmonteras. */
    onGone: () => void;
    /** Placeringen (absolute … -translate-x-1/2 o.s.v.). Ligger på en egen
     *  wrapper, så animationernas transform aldrig skriver över den. */
    className?: string;
    /** Lite större en stund - visningsrundans steg pekar ut tipset. */
    emphasized?: boolean;
    /** Vad trycket gör, för skärmläsare. */
    dismissLabel: string;
    /** Fördröjning innan tipset poppar fram (ms). */
    delayMs?: number;
}

/**
 * Ett tips som står kvar tills man trycker på det - och då AVDUNSTAR på
 * stället (#268, ägarbeslut 22/11, Josef: "den ska liksom avdunsta snabbt.
 * inte flyga iväg sådär"; ersätter blåset från 21/11 som svepte iväg pillen
 * åt sidan).
 *
 * Samma pill som HoverLabel, men den syns hela tiden och går att trycka på.
 * Pillen löses upp där den står och små ångpuffar stiger ur den. Pillens
 * upplösning och puffarnas utseende bor i globals.css (.smoke-hint-blown,
 * .smoke-puff), puffarnas banor i utils/smokePuff (testad).
 */
export default function SmokeHint({ children, onGone, className = '', emphasized = false, dismissLabel, delayMs = 0 }: SmokeHintProps) {
    const [blow, setBlow] = useState<{ dir: SmokeDir; puffs: SmokePuff[]; width: number; height: number } | null>(null);
    const blownRef = useRef(false);
    const onGoneRef = useRef(onGone);
    onGoneRef.current = onGone;
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

    const onClick = (e: React.MouseEvent<HTMLButtonElement>) => {
        if (blownRef.current) return;
        blownRef.current = true;
        const rect = e.currentTarget.getBoundingClientRect();
        // detail 0 = tangentbordet (Enter/mellanslag): inget tryckläge.
        const dir = smokeDirFor(e.detail === 0 ? null : e.clientX, rect.left, rect.width);
        setBlow({ dir, puffs: buildSmokePuffs(rect.width, rect.height, dir), width: rect.width, height: rect.height });
        // Med reducerad rörelse tonar pillen bara ut (CSS) - vänta inte ut ångan.
        const reduced = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        timerRef.current = setTimeout(() => onGoneRef.current(), reduced ? 220 : SMOKE_GONE_MS);
    };

    return (
        <span className={`${className} pointer-events-auto`}>
            <span
                className="relative block"
                style={{ '--smoke-dir': blow?.dir ?? 1, '--smoke-ms': `${SMOKE_BLOW_MS}ms` } as React.CSSProperties}
            >
                <button
                    type="button"
                    onClick={onClick}
                    aria-label={dismissLabel}
                    title={dismissLabel}
                    className={`block cursor-pointer outline-none transition-transform duration-300 focus-visible:ring-2 focus-visible:ring-[#FECC02]/80 rounded-full ${
                        blow ? '' : emphasized ? 'scale-110' : 'hover:scale-105 active:scale-95'
                    }`}
                >
                    {/* Poppen in och blåset ut ligger på var sitt element:
                        knappen bär hover-skalan, den inre pillen animationerna. */}
                    <span
                        className={`block whitespace-nowrap rounded-full bg-white/90 backdrop-blur-md px-2.5 py-1 text-xs font-bold text-slate-700 shadow-lg border border-white/50 ${
                            blow ? 'smoke-hint-blown' : 'smoke-hint-in'
                        }`}
                        style={{ '--d': `${delayMs}ms` } as React.CSSProperties}
                    >
                        {children}
                    </span>
                </button>
                {blow && (
                    <span aria-hidden className="pointer-events-none absolute inset-0">
                        {blow.puffs.map((p, i) => (
                            <span
                                key={i}
                                className="smoke-puff"
                                style={{
                                    left: p.x - p.size / 2,
                                    top: p.y - p.size / 2,
                                    width: p.size,
                                    height: p.size,
                                    '--puff-dx': `${p.dx}px`,
                                    '--puff-dy': `${p.dy}px`,
                                    '--puff-s': p.scale,
                                    '--puff-o': p.opacity,
                                    '--puff-ms': `${p.duration}ms`,
                                    '--puff-delay': `${p.delay}ms`,
                                } as React.CSSProperties}
                            />
                        ))}
                    </span>
                )}
            </span>
        </span>
    );
}
