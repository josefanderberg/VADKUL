'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { CityDayCounts } from './cityData';
import { PERIODS, periodKeys, type Period } from './periods';

// Topplista över städerna på /evenemang med klientfilter. Datat (antal per
// dag och stad) bakas in statiskt vid build — här räknar vi bara ut vilka
// datum "Idag"/"I helgen" motsvarar mot användarens riktiga klocka (delade
// helpers i periods.ts, samma som stadssidornas daglista) och sorterar om.
// Default ('Alla' + 'Flest event') använder inget Date-anrop, så SSR-HTML:en
// är deterministisk (ingen hydreringsmiss) och alla stadslänkar ligger
// crawlbara i serverns HTML.

type SortMode = 'count' | 'perCapita';

const fmtPerCapita = (n: number) =>
    n.toLocaleString('sv-SE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export default function CityLeaderboard({ cities }: { cities: CityDayCounts[] }) {
    const [period, setPeriod] = useState<Period>('all');
    const [sort, setSort] = useState<SortMode>('count');

    const rows = useMemo(() => {
        const keys = periodKeys(period);
        return cities
            .map(c => {
                const count = keys ? keys.reduce((sum, k) => sum + (c.byDay[k] ?? 0), 0) : c.total;
                return { ...c, count, perCapita: (count / c.population) * 1000 };
            })
            .sort((a, b) =>
                sort === 'count'
                    ? b.count - a.count || b.total - a.total
                    : b.perCapita - a.perCapita || b.count - a.count,
            );
    }, [cities, period, sort]);

    const unit = PERIODS.find(p => p.key === period)!.unit;

    return (
        <div className="mt-8">
            {/* Periodfilter + sorteringsval */}
            <div className="flex flex-wrap items-center gap-2">
                {PERIODS.map(p => (
                    <button
                        key={p.key}
                        type="button"
                        onClick={() => setPeriod(p.key)}
                        aria-pressed={period === p.key}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-black transition-colors border ${
                            period === p.key
                                ? 'bg-[#006AA7] border-[#006AA7] text-white'
                                : 'bg-white border-slate-200 text-slate-600 hover:border-[#006AA7]/40 hover:text-[#006AA7]'
                        }`}
                    >
                        {p.label}
                    </button>
                ))}
                <span className="mx-1 h-5 w-px bg-slate-200" aria-hidden />
                <button
                    type="button"
                    onClick={() => setSort(s => (s === 'count' ? 'perCapita' : 'count'))}
                    className="px-3.5 py-1.5 rounded-full text-xs font-black bg-white border border-[#FECC02] text-slate-700 hover:bg-[#FECC02]/10 transition-colors"
                >
                    {sort === 'count' ? 'Sortera: flest event' : 'Sortera: per 1\u00a0000 inv\u00e5nare'}
                </button>
                <Link
                    href="/"
                    className="ml-auto inline-flex items-center justify-center px-4 py-1.5 rounded-full bg-[#006AA7] hover:bg-[#005590] text-white font-black text-xs shadow transition-colors"
                >
                    Öppna kartan
                </Link>
            </div>

            {/* Topplistan */}
            <ol className="mt-4 flex flex-col gap-2">
                {rows.map((c, i) => (
                    <li key={c.slug}>
                        <Link
                            href={`/evenemang/${c.slug}`}
                            className="flex items-center gap-3 rounded-xl bg-white border border-slate-200 px-4 py-3 hover:border-[#006AA7]/40 hover:shadow-sm transition-all"
                        >
                            <span
                                className={`w-7 shrink-0 text-right text-base font-black tabular-nums ${
                                    i < 3 ? 'text-[#006AA7]' : 'text-slate-300'
                                }`}
                                aria-hidden
                            >
                                {i + 1}
                            </span>
                            <span className="min-w-0 flex-1">
                                <span className="block text-sm font-bold text-slate-900">Vad händer i {c.name}?</span>
                                <span className="block text-xs text-slate-400 font-medium mt-0.5">
                                    ca {c.population.toLocaleString('sv-SE')} invånare
                                </span>
                            </span>
                            <span className="text-right shrink-0">
                                <span className={`block text-sm font-black tabular-nums ${c.count > 0 ? 'text-[#006AA7]' : 'text-slate-300'}`}>
                                    {c.count.toLocaleString('sv-SE')} <span className="text-[10px] font-bold text-slate-400">{unit}</span>
                                </span>
                                {/* Per-invånare-värdet visas alltid, inte bara i det sorteringsläget. */}
                                <span className={`block text-[10px] font-bold tabular-nums ${sort === 'perCapita' ? 'text-[#006AA7]' : 'text-slate-400'}`}>
                                    {fmtPerCapita(c.perCapita)} /1 000 inv.
                                </span>
                            </span>
                        </Link>
                    </li>
                ))}
            </ol>
        </div>
    );
}
