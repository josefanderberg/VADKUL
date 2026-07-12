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
// titel på en mörk gradient, info-rad under). Växlingen dirigeras GEMENSAMT
// av CityLeaderboard (ägarbeslut 2026-07-12: inte så ofta, aldrig samtidigt):
// var CASCADE_TICK_MS byter EN stad bild — uppifrån och ned bland de bildspel
// som just nu syns i viewporten, runt och runt i samma rytm. Pilknapparna
// växlar manuellt; kortet står då över i MANUAL_HOLD_MS innan det går in i
// ledet igen. city.showcase byggs redan tidssorterat på servern (cityData.ts);
// tom array döljer sektionen helt (för få bildsatta event i den staden) —
// inte beroende av period-filtret ovan (bildspelet är en generell försmak,
// inte en del av den räknade listan).

type SortMode = 'count' | 'perCapita';

const fmtPerCapita = (n: number) =>
    n.toLocaleString('sv-SE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

// Gemensam takt: var CASCADE_TICK_MS byter EN stads bildspel — uppifrån och
// ned bland de synliga, runt och runt. Per kort blir det alltså tick × antal
// synliga bildspel mellan bytena (lugnt, och aldrig två samtidigt).
const CASCADE_TICK_MS = 4000;
// Efter ett manuellt pilklick står kortet över i så här länge innan det går
// in i ledet igen — autobytet ska inte trampa på användarens val direkt.
const MANUAL_HOLD_MS = 10_000;

/** Det en stads bildspel anmäler till dirigenten i CityLeaderboard. */
interface ShowcaseHandle {
    /** Byt till nästa kort (dirigentens tur-ordning). */
    advance: () => void;
    /** Får kortet bytas just nu? (synligt, ≥2 kort, inte hovrat/manuellt nyss) */
    isEligible: () => boolean;
}
type ShowcaseRegistry = Map<string, ShowcaseHandle>;

/** Bildspel med ETT kort i taget — samma bildkorts-stil som stadssidornas
 *  rader (h-28-bild, emoji+titel på mörk gradient, info-rad under). Byter
 *  ALDRIG på egen hand — det registrerar sig hos dirigenten (registry) som
 *  turas om uppifrån och ned. Pilknapparna växlar manuellt och ger kortet
 *  MANUAL_HOLD_MS paus innan det går in i ledet igen. Hover/touch pausar.
 *  Bilden laddas lat (IntersectionObserver, samma mönster som förr); en
 *  trasig bildlänk plockar bort eventet och nästa visas direkt. */
function CityShowcase({ items, slug, registry }: {
    items: CityShowcaseItem[];
    slug: string;
    registry: ShowcaseRegistry;
}) {
    const holderRef = useRef<HTMLDivElement>(null);
    // Latchad "har synts" för lazy-laddningen av bilden…
    const [inView, setInView] = useState(false);
    // …och LÖPANDE synlighet för dirigenten (av-latchas när man scrollar förbi).
    const visibleRef = useRef(false);
    // Rullande index — kan bli negativt (Föregående) eller växa fritt; det
    // visade kortet räknas ut med modulo mot listan utan trasiga bilder.
    const [idx, setIdx] = useState(0);
    const [broken, setBroken] = useState<Set<string>>(new Set());
    // Hover/touch-paus + manuell vilotid — bara dirigenten läser dem, ingen
    // rendering hänger på dem → refs i stället för state.
    const pausedRef = useRef(false);
    const holdUntilRef = useRef(0);

    useEffect(() => {
        const el = holderRef.current;
        if (!el || typeof IntersectionObserver === 'undefined') return;
        const io = new IntersectionObserver(entries => {
            for (const en of entries) {
                visibleRef.current = en.isIntersecting;
                if (en.isIntersecting) setInView(true);
            }
        }, { rootMargin: '200px' });
        io.observe(el);
        return () => io.disconnect();
    }, []);

    const alive = items.filter(it => !broken.has(it.id));
    const n = alive.length;
    const aliveCountRef = useRef(n);
    aliveCountRef.current = n;

    // Anmäl kortet till dirigenten. Nyckeln (stads-slugen) matchar radordningen
    // i CityLeaderboard så kaskaden går uppifrån och ned i den visade listan.
    useEffect(() => {
        registry.set(slug, {
            advance: () => setIdx(i => i + 1),
            isEligible: () =>
                visibleRef.current
                && !pausedRef.current
                && aliveCountRef.current >= 2
                && Date.now() >= holdUntilRef.current,
        });
        return () => { registry.delete(slug); };
    }, [registry, slug]);

    if (n === 0) return null;
    const item = alive[((idx % n) + n) % n];

    const manualStep = (dir: 1 | -1) => {
        setIdx(i => i + dir);
        holdUntilRef.current = Date.now() + MANUAL_HOLD_MS;
    };

    return (
        <div
            ref={holderRef}
            className="relative"
            onMouseEnter={() => { pausedRef.current = true; }}
            onMouseLeave={() => { pausedRef.current = false; }}
            onTouchStart={() => { pausedRef.current = true; }}
            onTouchEnd={() => { pausedRef.current = false; }}
            onTouchCancel={() => { pausedRef.current = false; }}
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

    // ── Bildspels-dirigenten ─────────────────────────────────────────────────
    // EN gemensam takt för alla städers bildspel: varje tick byter EN stad —
    // uppifrån och ned i den visade listan bland de som kvalar (synliga i
    // viewporten, ≥2 kort, inte hovrade eller i manuell vilotid), runt och
    // runt. Kvalar förra stadens kort inte längre (utscrollat/borttaget)
    // börjar varvet om uppifrån.
    const showcaseRegistry = useRef<ShowcaseRegistry>(new Map());
    const rowOrderRef = useRef<string[]>([]);
    rowOrderRef.current = rows.map(r => r.slug);
    const lastAdvancedRef = useRef<string | null>(null);
    useEffect(() => {
        const t = setInterval(() => {
            if (document.visibilityState === 'hidden') return;
            const reg = showcaseRegistry.current;
            const eligible = rowOrderRef.current.filter(s => reg.get(s)?.isEligible());
            if (eligible.length === 0) return;
            const lastIdx = lastAdvancedRef.current ? eligible.indexOf(lastAdvancedRef.current) : -1;
            const next = eligible[(lastIdx + 1) % eligible.length];
            reg.get(next)!.advance();
            lastAdvancedRef.current = next;
        }, CASCADE_TICK_MS);
        return () => clearInterval(t);
    }, []);

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
                                <CityShowcase items={c.showcase} slug={c.slug} registry={showcaseRegistry.current} />
                            </div>
                        )}
                    </li>
                ))}
            </ol>
        </div>
    );
}
