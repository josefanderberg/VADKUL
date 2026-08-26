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
// opålitligt material. Nu visar varje rad FYRA tal: besök, idag, i veckan och
// totalt. Det är den information man faktiskt är ute efter, och den går att
// jämföra mellan städer på en blick.
//
// BESÖKEN (Josef 26/8): varje stadssida räknar sina besök (CityVisitBeacon →
// outreachStats/cityVisits) och topplistan hämtar siffrorna från
// /api/stats/city-visits (CDN-cachat 5 min). Default-sorteringen är BESÖK I
// VECKAN — "vilken stad leder den här veckan?" — och ett klick till på samma
// knapp växlar till besök totalt. Besökskolumnen visar talet för det läge
// knappen står i.
//
// Ingen kartbild per rad, trots att kartan är produkten: stads-heron
// (CityMapHero) renderar en RIKTIG MapLibre-canvas ovanpå kaklen, och 31 av dem
// i en lista blir 31 WebGL-kontexter — webbläsartaket ligger kring 8–16 och
// släpper de äldsta.
//
// Filterknapparna SORTERAR (de filtrerade förut bort perioder ur en enda
// sifferkolumn). Sorteringsnycklarna är samma som kolumnerna, så listan och
// rubrikerna aldrig kan säga olika saker.

type SortKey = 'visits' | 'today' | 'week' | 'total';
type CityVisits = Record<string, { week: number; total: number }>;

const SORTS: { key: SortKey; label: string }[] = [
    // Besök först (default) — vänster om Flest totalt (Josef 26/8).
    { key: 'visits', label: 'Flest besök' },
    { key: 'total', label: 'Flest totalt' },
    { key: 'week', label: 'Mest i veckan' },
    { key: 'today', label: 'Mest idag' },
];

export default function CityLeaderboard({ cities }: { cities: CityDayCounts[] }) {
    const [sort, setSort] = useState<SortKey>('visits');
    // Besöksknappens läge: veckan (default) ↔ totalt antal klick. Ett klick
    // till på den redan aktiva knappen växlar (Josef 26/8).
    const [visitsMode, setVisitsMode] = useState<'week' | 'total'>('week');
    // Omsorteringen renderar om hela listan — som transition blockerar det inte
    // tappen (INP, mobil).
    const [, startTransition] = useTransition();
    // Dag-/veckotalen får läsa klockan först EFTER mount: byggdagens "idag" är
    // inte besökarens, och en klockberoende siffra i server-HTML:en spräcker
    // hydreringen. Före mount visas bara totalen (och ett tankstreck där dags-
    // talen ska stå); alla stadslänkar ligger crawlbara i HTML:en oavsett.
    const [mounted, setMounted] = useState(false);
    useEffect(() => startTransition(() => setMounted(true)), []);

    // Besökssiffrorna hämtas efter mount (sidan är statisk). null = inte
    // laddat än → tankstreck i kolumnen och eventtotalen som sorteringsstöd.
    const [visits, setVisits] = useState<CityVisits | null>(null);
    useEffect(() => {
        let alive = true;
        fetch('/api/stats/city-visits')
            .then(r => (r.ok ? r.json() : null))
            .then(data => { if (alive && data) startTransition(() => setVisits(data)); })
            .catch(() => { /* utan siffror visas tankstreck — listan funkar ändå */ });
        return () => { alive = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleSort = (key: SortKey) => startTransition(() => {
        if (key === 'visits') {
            // Redan vald → växla veckan ↔ totalt antal klick.
            setVisitsMode(prev => (sort === 'visits' ? (prev === 'week' ? 'total' : 'week') : prev));
        }
        setSort(key);
    });

    const rows = useMemo(() => {
        const tKey = mounted ? todayKey() : null;
        const wKeys = mounted ? weekKeys() : null;
        return cities
            .map(c => ({
                ...c,
                today: tKey ? (c.byDay[tKey] ?? 0) : null,
                week: wKeys ? wKeys.reduce((sum, k) => sum + (c.byDay[k] ?? 0), 0) : null,
                visitCount: visits ? (visitsMode === 'week' ? visits[c.slug]?.week ?? 0 : visits[c.slug]?.total ?? 0) : null,
            }))
            // Innan klockan/besöken lästs finns bara eventtotalen att sortera
            // på — då hoppar listan rätt när siffrorna landar (samma mönster
            // som mounted-hoppet).
            .sort((a, b) => {
                const pick = (r: typeof a) =>
                    sort === 'total' ? r.total
                        : sort === 'visits' ? (r.visitCount ?? r.total)
                            : (sort === 'week' ? r.week : r.today) ?? r.total;
                return pick(b) - pick(a) || b.total - a.total;
            });
    }, [cities, sort, mounted, visits, visitsMode]);

    /** Sifferruta i raden. Aktiv sorteringskolumn markeras — annars är det inte
     *  uppenbart vilket av fyra tal listan är ordnad efter. */
    const Stat = ({ value, label, active }: { value: number | null; label: string; active: boolean }) => (
        <span className="w-[52px] shrink-0 text-right">
            <span className={`block text-sm font-black tabular-nums ${
                active ? 'text-[#006AA7]' : value ? 'text-slate-900' : 'text-slate-300'
            }`}>
                {value === null ? '–' : value.toLocaleString('sv-SE')}
            </span>
            <span className={`block text-[9px] font-bold uppercase tracking-wide ${
                active ? 'text-[#006AA7]/70' : 'text-slate-400'
            }`}>
                {label}
            </span>
        </span>
    );

    return (
        <div className="mt-8">
            {/* Sorteringsval. Besöksknappen bär sitt läge i etiketten så det
                syns vad ett klick till kommer att göra ("i veckan" ↔ "totalt"). */}
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
                                : 'bg-white border-slate-200 text-slate-600 hover:border-[#006AA7]/40 hover:text-[#006AA7]'
                        }`}
                    >
                        {s.key === 'visits'
                            ? `Flest besök ${visitsMode === 'week' ? 'i veckan' : 'totalt'}`
                            : s.label}
                    </button>
                ))}
            </div>

            {/* Topplistan */}
            <ol className="mt-4 flex flex-col gap-2">
                {rows.map((c, i) => (
                    <li
                        key={c.slug}
                        className="rounded-xl bg-white border border-slate-200 hover:border-[#006AA7]/40 hover:shadow-sm transition-all"
                    >
                        <Link href={`/evenemang/${c.slug}`} className="flex items-center gap-2 px-3 py-2.5 sm:gap-3 sm:px-4">
                            <span
                                className={`w-6 shrink-0 text-right text-base font-black tabular-nums ${
                                    i < 3 ? 'text-[#006AA7]' : 'text-slate-300'
                                }`}
                                aria-hidden
                            >
                                {i + 1}
                            </span>
                            {/* Ankartexten: stadsnamnet bär raden, och på lite
                                bredare skärmar följer hela frågan med (bättre
                                intern länktext för Google, men den får inte
                                tränga ut siffrorna på en telefon). */}
                            <span className="min-w-0 flex-1 truncate text-sm font-bold text-slate-900">
                                {c.name}
                                <span className="hidden font-semibold text-slate-400 sm:inline"> — vad händer?</span>
                            </span>
                            {/* Besöken vänster om idag (Josef 26/8) — talet
                                följer besöksknappens läge (veckan/totalt),
                                tankstreck tills API-svaret laddat. */}
                            <Stat
                                value={c.visitCount}
                                label={visitsMode === 'week' ? 'besök/v' : 'besök tot'}
                                active={sort === 'visits'}
                            />
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
