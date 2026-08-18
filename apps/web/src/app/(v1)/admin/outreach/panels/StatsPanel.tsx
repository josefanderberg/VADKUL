'use client';

// Statistik — det vi redan VET, räknat direkt ur loggen (inga nya mätpunkter):
// totaler, utfallsfördelning, toppinlägg på engagemang, variant- och
// länkplacerings-jämförelsen. Små n visas ÄRLIGT ("n = 3") — slutsatser dras
// först när underlaget bär, precis som OutreachNote-regeln (n < 5 gråas).

import { useMemo } from 'react';
import type { OutreachLogEntry } from '@/types/outreach';
import { useLog } from './useLog';

const fmtDate = (ms?: number) =>
    ms ? new Date(ms).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' }) : '—';

/** Engagemangssumman där siffror finns — likes + kommentarer väger lika. */
const engagement = (e: OutreachLogEntry) => (e.likes ?? 0) + (e.comments ?? 0);
const hasNumbers = (e: OutreachLogEntry) =>
    e.likes !== undefined || e.comments !== undefined || e.shares !== undefined;

const OUTCOME_LABEL: Record<string, string> = {
    'publicerat-direkt': '✅ Publicerat direkt',
    'godkänt-uppe': '✅ Godkänt/uppe',
    'krävde-godkännande': '🔒 Krävde godkännande',
    'borttagen': '❌ Borttagen',
    'nekad': '❌ Nekad',
    'okänt': '❓ Okänt',
};

export default function StatsPanel() {
    const { entries, error, busy } = useLog();

    const s = useMemo(() => {
        if (!entries) return null;
        // Statistiken bygger på BEKRÄFTADE gruppinlägg (loggregeln) — utkast
        // och andra kanaler redovisas separat.
        const fb = entries.filter(e => e.channel === 'fb-grupp' && e.confirmedByOwner);
        const withNumbers = fb.filter(hasNumbers);

        const outcomes = new Map<string, number>();
        for (const e of fb) outcomes.set(e.outcome, (outcomes.get(e.outcome) ?? 0) + 1);

        const top = [...withNumbers].sort((a, b) => engagement(b) - engagement(a)).slice(0, 5);

        const byPlacement = (p: string) => withNumbers.filter(e => e.linkPlacement === p);
        const avg = (list: OutreachLogEntry[], f: (e: OutreachLogEntry) => number) =>
            list.length ? Math.round(list.reduce((sum, e) => sum + f(e), 0) / list.length * 10) / 10 : 0;

        const variants = new Map<string, OutreachLogEntry[]>();
        for (const e of withNumbers) {
            if (!e.variant) continue;
            const list = variants.get(e.variant);
            if (list) list.push(e); else variants.set(e.variant, [e]);
        }

        return {
            fbCount: fb.length,
            groupsCovered: new Set(fb.map(e => e.contactId)).size,
            likes: fb.reduce((sum, e) => sum + (e.likes ?? 0), 0),
            comments: fb.reduce((sum, e) => sum + (e.comments ?? 0), 0),
            shares: fb.reduce((sum, e) => sum + (e.shares ?? 0), 0),
            withNumbersCount: withNumbers.length,
            unfollowed: fb.filter(e => !e.outcomeCheckedAt).length,
            outcomes: [...outcomes.entries()].sort((a, b) => b[1] - a[1]),
            top,
            placement: (['i-inlägget', 'i-första-kommentaren'] as const).map(p => {
                const list = byPlacement(p);
                return { p, n: list.length, likes: avg(list, e => e.likes ?? 0), comments: avg(list, e => e.comments ?? 0) };
            }),
            variants: [...variants.entries()]
                .map(([v, list]) => ({ v, n: list.length, likes: avg(list, e => e.likes ?? 0), comments: avg(list, e => e.comments ?? 0) }))
                .sort((a, b) => b.n - a.n),
            otherChannels: entries.filter(e => e.channel !== 'fb-grupp').length,
        };
    }, [entries]);

    if (error) return <p className="text-sm font-bold text-rose-600">{error}</p>;
    if (!s) return <p className="text-sm font-bold text-slate-400">{busy ? 'Räknar…' : 'Ingen logg.'}</p>;

    return (
        <div className="flex flex-col gap-6">
            {/* Totalerna */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                <Tile label="Bekräftade gruppinlägg" value={s.fbCount} />
                <Tile label="Grupper täckta" value={s.groupsCovered} />
                <Tile label="👍 Likes totalt" value={s.likes} />
                <Tile label="💬 Kommentarer" value={s.comments} />
                <Tile label="↗ Delningar" value={s.shares} />
                <Tile label="Ouppföljda utfall" value={s.unfollowed} warn={s.unfollowed > 0} />
            </div>
            <p className="text-[11px] font-bold text-slate-400 -mt-3">
                Engagemangssiffror finns på {s.withNumbersCount} av {s.fbCount} inlägg — resten är ännu inte
                uppföljda (Idag-fliken påminner). {s.otherChannels > 0 && `Utanför grupperna: ${s.otherChannels} rader (mejl/kampanj) — se Logg.`}
            </p>

            {/* Utfallen */}
            <section>
                <h2 className="text-base font-black text-slate-900 mb-2">Utfall</h2>
                <ul className="flex flex-col gap-1.5">
                    {s.outcomes.map(([outcome, n]) => (
                        <li key={outcome} className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-600 w-44 shrink-0">{OUTCOME_LABEL[outcome] ?? outcome}</span>
                            <div className="flex-1 h-3 rounded-full bg-slate-100 overflow-hidden">
                                <div className="h-full rounded-full bg-[#006AA7]" style={{ width: `${(n / s.fbCount) * 100}%` }} />
                            </div>
                            <span className="text-xs font-black tabular-nums text-slate-700 w-8 text-right">{n}</span>
                        </li>
                    ))}
                </ul>
            </section>

            {/* Toppinläggen */}
            <section>
                <h2 className="text-base font-black text-slate-900 mb-2">Toppinlägg (likes + kommentarer)</h2>
                <ul className="flex flex-col gap-2">
                    {s.top.map(e => (
                        <li key={e.id} className="rounded-xl border border-slate-200 bg-white p-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                            <span className="text-sm font-black text-slate-800">{e.contactName}</span>
                            <span className="text-[11px] font-bold text-slate-400">{fmtDate(e.postedAt)}</span>
                            <span className="text-[11px] font-bold text-slate-600">
                                👍 {e.likes ?? 0} · 💬 {e.comments ?? 0} · ↗ {e.shares ?? 0}
                            </span>
                            {e.variant && <span className="text-[10px] font-black text-slate-400">variant {e.variant}</span>}
                            {e.outcome === 'borttagen' && <span className="text-[10px] font-black text-rose-500">togs bort ändå</span>}
                        </li>
                    ))}
                    {s.top.length === 0 && <p className="text-sm font-semibold text-slate-400">Inga inlägg med siffror ännu.</p>}
                </ul>
            </section>

            {/* A/B:t — länkplaceringen */}
            <section>
                <h2 className="text-base font-black text-slate-900 mb-2">Länk i inlägget vs i första kommentaren</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {s.placement.map(row => (
                        <div key={row.p} className="rounded-xl border border-slate-200 bg-white p-3">
                            <p className="text-xs font-black text-slate-700">{row.p} <span className="text-slate-400">(n = {row.n})</span></p>
                            <p className="text-[11px] font-bold text-slate-500 mt-1">
                                snitt 👍 {row.likes} · 💬 {row.comments}
                            </p>
                        </div>
                    ))}
                </div>
                <p className="text-[11px] font-bold text-slate-400 mt-1.5">
                    Endast inlägg med uppföljda siffror räknas — dra inga slutsatser under n = 5 per sida.
                </p>
            </section>

            {/* Varianterna */}
            {s.variants.length > 0 && (
                <section>
                    <h2 className="text-base font-black text-slate-900 mb-2">Per variant</h2>
                    <ul className="flex flex-col gap-1.5">
                        {s.variants.map(row => (
                            <li key={row.v} className="flex items-center gap-3 text-xs font-bold text-slate-600">
                                <span className="w-24 shrink-0 font-black">{row.v}</span>
                                <span>n = {row.n}</span>
                                <span>snitt 👍 {row.likes} · 💬 {row.comments}</span>
                            </li>
                        ))}
                    </ul>
                </section>
            )}
        </div>
    );
}

function Tile({ label, value, warn = false }: { label: string; value: number; warn?: boolean }) {
    return (
        <div className="rounded-xl border border-slate-200 bg-white p-3">
            <p className={`text-xl font-black tabular-nums ${warn ? 'text-amber-600' : 'text-slate-800'}`}>
                {value.toLocaleString('sv-SE')}
            </p>
            <p className="text-[10px] font-bold text-slate-400 mt-0.5">{label}</p>
        </div>
    );
}
