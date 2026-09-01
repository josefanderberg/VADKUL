'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, useTransition } from 'react';
import type { CityDayCounts } from './cityData';
import { todayKey, weekKeys } from './periods';

// Topplista över städerna på /evenemang. Eventdatat (antal per dag och stad)
// bakas in statiskt vid build — här räknar vi bara ut vilka datum "idag"/"i
// veckan" motsvarar mot användarens riktiga klocka (delade helpers i
// periods.ts) och sorterar om.
//
// RADEN ÄR SIFFRORNA (Josef 14/8). Under varje stad låg tidigare ett bildspel
// som växlade mellan bildsatta event. Det är borttaget: bilderna kommer från
// skrapade omslag och är delvis skräp (platshållare, trasiga länkar — kortet
// hade en egen "broken"-lista för att gömma dem), och ingen layout räddar
// opålitligt material. Nu visar varje rad TRE tal: idag, i veckan och totalt.
// Det är den information man faktiskt är ute efter, och den går att jämföra
// mellan städer på en blick.
//
// INGA BESÖKSSIFFROR (Josef 29/8): besökskolumnen + "Flest besök"-sorteringen
// från 26/8 är BORTTAGNA på ägarbeslut — trafiksiffror är interna
// (outreach-konsolen), inte publika. Insamlingen (CityVisitBeacon →
// outreachStats/cityVisits) är kvar; det publika läs-API:et
// /api/stats/city-visits är raderat. Lägg inte tillbaka kolumnen.
//
// Ingen kartbild per rad, trots att kartan är produkten: stads-heron
// (CityMapHero) renderar en RIKTIG MapLibre-canvas ovanpå kaklen, och 31 av dem
// i en lista blir 31 WebGL-kontexter — webbläsartaket ligger kring 8–16 och
// släpper de äldsta.
//
// Filterknapparna SORTERAR (de filtrerade förut bort perioder ur en enda
// sifferkolumn). Sorteringsnycklarna är samma som kolumnerna, så listan och
// rubrikerna aldrig kan säga olika saker.

type SortKey = 'today' | 'week' | 'total';

const SORTS: { key: SortKey; label: string }[] = [
    { key: 'total', label: 'Flest totalt' },
    { key: 'week', label: 'Mest i veckan' },
    { key: 'today', label: 'Mest idag' },
];

export default function CityLeaderboard({ cities }: { cities: CityDayCounts[] }) {
    const [sort, setSort] = useState<SortKey>('total');
    // Omsorteringen renderar om hela listan — som transition blockerar det inte
    // tappen (INP, mobil).
    const [, startTransition] = useTransition();
    // Dag-/veckotalen får läsa klockan först EFTER mount: byggdagens "idag" är
    // inte besökarens, och en klockberoende siffra i server-HTML:en spräcker
    // hydreringen. Före mount visas bara totalen (och ett tankstreck där dags-
    // talen ska stå); alla stadslänkar ligger crawlbara i HTML:en oavsett.
    const [mounted, setMounted] = useState(false);
    useEffect(() => startTransition(() => setMounted(true)), []);

    const handleSort = (key: SortKey) => startTransition(() => setSort(key));

    const rows = useMemo(() => {
        const tKey = mounted ? todayKey() : null;
        const wKeys = mounted ? weekKeys() : null;
        return cities
            .map(c => ({
                ...c,
                today: tKey ? (c.byDay[tKey] ?? 0) : null,
                week: wKeys ? wKeys.reduce((sum, k) => sum + (c.byDay[k] ?? 0), 0) : null,
            }))
            // Innan klockan lästs finns bara eventtotalen att sortera på — då
            // hoppar listan rätt när dagstalen landar (mounted-hoppet).
            .sort((a, b) => {
                const pick = (r: typeof a) =>
                    sort === 'total' ? r.total : ((sort === 'week' ? r.week : r.today) ?? r.total);
                return pick(b) - pick(a) || b.total - a.total;
            });
    }, [cities, sort, mounted]);

    /** Sifferruta i raden. Aktiv sorteringskolumn markeras — annars är det inte
     *  uppenbart vilket av tre tal listan är ordnad efter. */
    const Stat = ({ value, label, active }: { value: number | null; label: string; active: boolean }) => (
        <span className="w-[52px] shrink-0 text-right">
            <span className={`block text-sm font-black tabular-nums ${
                active ? 'text-[#006AA7] dark:text-sky-400' : value ? 'text-slate-900 dark:text-zinc-100' : 'text-slate-300 dark:text-zinc-600'
            }`}>
                {value === null ? '–' : value.toLocaleString('sv-SE')}
            </span>
            <span className={`block text-[9px] font-bold uppercase tracking-wide ${
                active ? 'text-[#006AA7]/70 dark:text-sky-400/70' : 'text-slate-400 dark:text-zinc-500'
            }`}>
                {label}
            </span>
        </span>
    );

    return (
        <div className="mt-8">
            {/* Sorteringsval */}
            <div className="flex flex-wrap items-center gap-2">
                {SORTS.map(s => (
                    <button
                        key={s.key}
                        type="button"
                        onClick={() => handleSort(s.key)}
                        aria-pressed={sort === s.key}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-black transition-colors border ${
                            sort === s.key
                                ? 'bg-[#006AA7] border-[#006AA7] text-white'
                                : 'bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:border-[#006AA7]/40 dark:hover:border-sky-400/40 hover:text-[#006AA7] dark:hover:text-sky-400'
                        }`}
                    >
                        {s.label}
                    </button>
                ))}
            </div>

            {/* Topplistan */}
            <ol className="mt-4 flex flex-col gap-2">
                {rows.map((c, i) => (
                    <li
                        key={c.slug}
                        className="rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 hover:border-[#006AA7]/40 dark:hover:border-sky-400/40 hover:shadow-sm transition-all"
                    >
                        <Link href={`/evenemang/${c.slug}`} className="flex items-center gap-2 px-3 py-2.5 sm:gap-3 sm:px-4">
                            <span
                                className={`w-6 shrink-0 text-right text-base font-black tabular-nums ${
                                    i < 3 ? 'text-[#006AA7] dark:text-sky-400' : 'text-slate-300 dark:text-zinc-600'
                                }`}
                                aria-hidden
                            >
                                {i + 1}
                            </span>
                            {/* Ankartexten: stadsnamnet bär raden, och på lite
                                bredare skärmar följer hela frågan med (bättre
                                intern länktext för Google, men den får inte
                                tränga ut siffrorna på en telefon). */}
                            <span className="min-w-0 flex-1 truncate text-sm font-bold text-slate-900 dark:text-zinc-100">
                                {c.name}
                                <span className="hidden font-semibold text-slate-400 dark:text-zinc-500 sm:inline"> — vad händer?</span>
                            </span>
                            <Stat value={c.today} label="idag" active={sort === 'today'} />
                            <Stat value={c.week} label="i veckan" active={sort === 'week'} />
                            <Stat value={c.total} label="totalt" active={sort === 'total'} />
                        </Link>
                    </li>
                ))}
            </ol>
        </div>
    );
}
