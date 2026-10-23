'use client';

// Troféerna bredvid ett namn (ägarbeslut 23/10, Josef: "det räcker med en
// symbol, men att det kanske syns om man klickar på den"): bara symbolen,
// och ett klick visar förklaringen i en liten ruta under (absolut, så den
// aldrig trycker isär namnraden). Data = users/{uid}.trophies via
// readTrophies (packages/kontrakt/src/trophies.ts) - inga egna läsningar här.
import { useState } from 'react';
import { describeTrophy, type TrophyMirror } from '@vadkul/kontrakt';

export default function TrophyBadges({ trophies }: { trophies: readonly TrophyMirror[] }) {
    const [openId, setOpenId] = useState<string | null>(null);
    if (trophies.length === 0) return null;
    const open = trophies.find(t => t.id === openId);
    const info = open ? describeTrophy(open) : null;
    return (
        <span className="relative inline-flex shrink-0">
            <span className="inline-flex items-center gap-0.5">
                {trophies.map(t => {
                    const d = describeTrophy(t);
                    return (
                        <button
                            key={t.id}
                            type="button"
                            onClick={e => { e.stopPropagation(); setOpenId(cur => (cur === t.id ? null : t.id)); }}
                            aria-expanded={openId === t.id}
                            aria-label={d.title}
                            title={d.title}
                            className="text-base leading-none px-0.5 rounded hover:scale-110 transition-transform"
                        >
                            {d.symbol}
                        </button>
                    );
                })}
            </span>
            {info && (
                <span
                    role="note"
                    className="absolute left-0 top-full mt-1 z-20 w-60 max-w-[calc(100vw-4rem)] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg px-3 py-2 text-[11px] leading-snug font-semibold text-slate-500 dark:text-slate-400"
                >
                    <span className="font-black text-slate-700 dark:text-slate-200">{info.title}.</span> {info.text}
                </span>
            )}
        </span>
    );
}
