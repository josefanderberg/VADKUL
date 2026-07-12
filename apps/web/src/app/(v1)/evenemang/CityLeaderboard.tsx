'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, MapPin } from 'lucide-react';
import type { CityDayCounts, CityShowcaseItem } from './cityData';
import { PERIODS, periodKeys, type Period } from './periods';

// Topplista över städerna på /evenemang med klientfilter. Datat (antal per
// dag och stad) bakas in statiskt vid build — här räknar vi bara ut vilka
// datum "Idag"/"I helgen" motsvarar mot användarens riktiga klocka (delade
// helpers i periods.ts, samma som stadssidornas daglista) och sorterar om.
// Default-filtret är 'Alla', men periodräkningen slår till först EFTER mount:
// periodKeys läser new Date() och får inte köras vid SSR (byggdagens "idag" ≠
// besökarens → hydreringsmiss). Pre-mount räknas totalerna (som 'Alla') och
// alla stadslänkar ligger crawlbara i serverns HTML oavsett.
//
// Under varje stad ligger ett bildspel (CityShowcase): ETT bildsatt kommande
// event i taget, i samma formspråk som stadssidornas bildkort (bild + emoji/
// titel på en mörk gradient, info-rad under). Växlar automatiskt var 2:a
// sekund, med pilknappar för manuell växling. city.showcase byggs redan
// tidssorterat på servern (cityData.ts); tom array döljer sektionen helt
// (för få bildsatta event i den staden) — inte beroende av period-filtret
// ovan (bildspelet är en generell försmak, inte en del av den räknade listan).

type SortMode = 'count' | 'perCapita';

const fmtPerCapita = (n: number) =>
    n.toLocaleString('sv-SE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** Bildspel med ETT kort i taget — samma bildkorts-stil som stadssidornas
 *  rader (h-28-bild, emoji+titel på mörk gradient, info-rad under). Växlar
 *  automatiskt var 2:a sekund; pilknapparna växlar manuellt och nollställer
 *  auto-timern. Pausar när fliken är dold (visibilitychange) och vid
 *  hover/touch. Bilden laddas lat (IntersectionObserver, samma mönster som
 *  förr); en trasig bildlänk plockar bort eventet och nästa visas direkt. */
const SHOWCASE_STEP_MS = 2000;

function CityShowcase({ items }: { items: CityShowcaseItem[] }) {
    const holderRef = useRef<HTMLDivElement>(null);
    const [inView, setInView] = useState(false);
    // Rullande index — kan bli negativt (Föregående) eller växa fritt; det
    // visade kortet räknas ut med modulo mot listan utan trasiga bilder.
    const [idx, setIdx] = useState(0);
    const [broken, setBroken] = useState<Set<string>>(new Set());
    const [paused, setPaused] = useState(false);
    const [tabHidden, setTabHidden] = useState(false);
    // Bumpas vid manuellt pilklick → timer-effekten startar om intervallet.
    const [timerEpoch, setTimerEpoch] = useState(0);

    useEffect(() => {
        const el = holderRef.current;
        if (!el || typeof IntersectionObserver === 'undefined') return;
        const io = new IntersectionObserver(entries => {
            if (entries.some(en => en.isIntersecting)) { setInView(true); io.disconnect(); }
        }, { rootMargin: '200px' });
        io.observe(el);
        return () => io.disconnect();
    }, []);

    useEffect(() => {
        const onVis = () => setTabHidden(document.visibilityState === 'hidden');
        onVis();
        document.addEventListener('visibilitychange', onVis);
        return () => document.removeEventListener('visibilitychange', onVis);
    }, []);

    const alive = items.filter(it => !broken.has(it.id));
    const n = alive.length;

    useEffect(() => {
        if (!inView || paused || tabHidden || n < 2) return;
        const t = setInterval(() => setIdx(i => i + 1), SHOWCASE_STEP_MS);
        return () => clearInterval(t);
    }, [inView, paused, tabHidden, n, timerEpoch]);

    if (n === 0) return null;
    const item = alive[((idx % n) + n) % n];

    const manualStep = (dir: 1 | -1) => {
        setIdx(i => i + dir);
        setTimerEpoch(e => e + 1);
    };

    return (
        <div
            ref={holderRef}
            className="relative"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            onTouchStart={() => setPaused(true)}
            onTouchEnd={() => setPaused(false)}
            onTouchCancel={() => setPaused(false)}
        >
            <Link
                href={item.href}
                className="block rounded-xl overflow-hidden bg-white border border-slate-200 hover:border-[#006AA7]/40 hover:shadow-sm transition-all"
            >
                <div className="relative h-28 bg-slate-200">
                    {inView && (
                        // key = eventet: bytt kort monterar om bilden (fade-in
                        // spelas upp igen + onError gäller rätt event).
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            key={item.id}
                            src={item.coverImage}
                            alt=""
                            loading="lazy"
                            decoding="async"
                            referrerPolicy="no-referrer"
                            onError={() => setBroken(prev => new Set(prev).add(item.id))}
                            className="w-full h-full object-cover animate-in fade-in duration-300"
                        />
                    )}
                    <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 px-4 pb-2 pt-8 bg-gradient-to-t from-black/75 via-black/35 to-transparent">
                        <span className="text-lg leading-none shrink-0 drop-shadow" aria-hidden>{item.emoji}</span>
                        <h3 className="flex-1 min-w-0 font-black text-sm text-white truncate [text-shadow:0_1px_2px_rgba(0,0,0,0.8)]">
                            {item.title}
                        </h3>
                    </div>
                </div>
                <div className="px-4 py-2 flex items-center gap-x-2 text-[11px] font-bold text-slate-500 overflow-hidden">
                    <span className="whitespace-nowrap shrink-0">{item.when}</span>
                    <span className="inline-flex items-center gap-1 min-w-0">
                        <MapPin size={11} className="text-[#006AA7] shrink-0" />
                        <span className="truncate">{item.locationName}</span>
                    </span>
                </div>
            </Link>
            {n > 1 && (
                <>
                    <button
                        type="button"
                        onClick={() => manualStep(-1)}
                        aria-label="Föregående event"
                        className="absolute left-2 top-14 -translate-y-1/2 z-10 flex items-center justify-center w-8 h-8 rounded-full bg-white/90 backdrop-blur shadow text-slate-500 hover:text-[#006AA7] transition-colors"
                    >
                        <ChevronLeft size={16} />
                    </button>
                    <button
                        type="button"
                        onClick={() => manualStep(1)}
                        aria-label="Nästa event"
                        className="absolute right-2 top-14 -translate-y-1/2 z-10 flex items-center justify-center w-8 h-8 rounded-full bg-white/90 backdrop-blur shadow text-slate-500 hover:text-[#006AA7] transition-colors"
                    >
                        <ChevronRight size={16} />
                    </button>
                </>
            )}
        </div>
    );
}

export default function CityLeaderboard({ cities }: { cities: CityDayCounts[] }) {
    const [period, setPeriod] = useState<Period>('all');
    const [sort, setSort] = useState<SortMode>('count');
    // Se filhuvudet: dagfiltren får läsa klockan först efter mount, annars
    // spricker hydreringen. Pre-mount → totalerna (keys = null), som 'Alla'
    // — vilket med default 'Alla' också är exakt vad som visas efter mount.
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    const rows = useMemo(() => {
        const keys = mounted ? periodKeys(period) : null;
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
    }, [cities, period, sort, mounted]);

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
            </div>

            {/* Topplistan */}
            <ol className="mt-4 flex flex-col gap-2">
                {rows.map((c, i) => (
                    <li
                        key={c.slug}
                        className="rounded-xl bg-white border border-slate-200 hover:border-[#006AA7]/40 hover:shadow-sm transition-all overflow-hidden"
                    >
                        <Link
                            href={`/evenemang/${c.slug}`}
                            className="flex items-center gap-3 px-4 py-3"
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
                        {c.showcase.length > 0 && (
                            <div className="border-t border-slate-100 px-4 py-2.5">
                                <CityShowcase items={c.showcase} />
                            </div>
                        )}
                    </li>
                ))}
            </ol>
        </div>
    );
}
