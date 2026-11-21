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

/** Vindstråken som far förbi i blåsets riktning: läge i höjdled (andel av
 *  pillens höjd), bredd (px), start (ms) och hur mycket de stiger (px). */
const GUSTS = [
    { top: 0.2, width: 44, delay: 0, rise: -9 },
    { top: 0.55, width: 62, delay: 45, rise: -3 },
    { top: 0.85, width: 36, delay: 90, rise: 4 },
];

/**
 * Ett tips som står kvar tills man trycker på det - och då BLÅSES bort som
 * ett rökmoln (#268, ägarbeslut 21/11, Josef: "se stadssida uppe den info
 * texten till man antingen klickar på den texten och det försvinner som ett
 * rökmoln. alltså mjukt blås med kraftfullt").
 *
 * Samma pill som HoverLabel, men den syns hela tiden och går att trycka på.
 * Blåset kommer från sidan man tryckte på: pillen trycks ihop en aning mot
 * vinden, sveps iväg och löses upp, medan rökpuffar lossnar ur den i en våg
 * och vindstråk far förbi. Pillens rörelse och puffarnas utseende bor i
 * globals.css (.smoke-hint-blown, .smoke-puff, .smoke-gust), puffarnas banor
 * i utils/smokePuff (testad).
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
        // Med reducerad rörelse tonar pillen bara ut (CSS) - vänta inte ut röken.
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
                        {GUSTS.map((g, i) => (
                            <span
                                key={`g${i}`}
                                className="smoke-gust"
                                style={{
                                    top: Math.round(blow.height * g.top),
                                    left: blow.dir === 1 ? -8 : undefined,
                                    right: blow.dir === -1 ? -8 : undefined,
                                    width: g.width,
                                    '--gust-delay': `${g.delay}ms`,
                                    '--gust-dy': `${g.rise}px`,
                                } as React.CSSProperties}
                            />
                        ))}
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
