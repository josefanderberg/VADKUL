'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useDayFilter } from './dayFilter';
import { isPlainClick } from '@/utils/eventExpand';
import { useAuth } from '@/context/AuthContext';
import { userService } from '@/services/userService';
import { SOURCE_DEFS } from '@/utils/sources';
import { CITY_OPT_IN_STORAGE_KEY, cityOptInDefault, cityOptInJsonHref } from '@/utils/cityOptIn';
import { categoryChipHref, activeCategorySlug } from '@/utils/categoryChips';

/**
 * Kategorichipsen på stads- och kategorisidorna ("Populärt i Stockholm") +
 * FLER-CHIPPEN sist i raden med opt-in-källorna.
 *
 * BYTE UTAN SIDLADDNING (Josef 2/9: "jag tycker ändå byte utan sidladdning
 * låter bättre"): chipsen är RIKTIGA länkar till kategorisidorna
 * (/evenemang/stockholm/barn) — det är dem Google följer och indexerar, och
 * cmd/ctrl-klick öppnar dem i ny flik — men ett vanligt klick på STADSSIDAN
 * navigerar inte: det byter URL:en med history.pushState (Next synkar
 * usePathname) och listan filtreras på plats, med dagfilter och scroll-
 * position kvar. Aktiv kategori läses ur URL:en, så bakåt/framåt i
 * webbläsaren fungerar av sig självt, och en omladdning ger den riktiga,
 * förrenderade kategorisidan.
 *
 * På KATEGORISIDAN (inPlace=false) saknar listan de andra kategoriernas
 * rader, så där är chipsen vanliga länkar (Nexts mjuka navigering); "Alla"
 * går till stadssidan — det är "man ska såklart kunna klicka för att komma
 * tillbaka och se alla event".
 *
 * FLER (Josef 2/9: "en Fler-knapp i slutet av kategorierna, och i den dyker
 * de tre upp som alternativ man kan aktivera"): sist i raden ligger en chip
 * som fäller ut Svenska kyrkan / PRO / Korpen som egna chips (SourceChips).
 * Källorna ligger utanför sidornas HTML, siffror och metadata (SEO-beslutet
 * 1/9) — slår man på en hämtas stadens opt-in.json och DayFilteredList syr
 * in just den källans rader. Standard = kartans regel: inget för utloggade
 * och under 65, kyrkan + PRO för inloggade 65+; ett eget val sparas i
 * localStorage och vinner sedan.
 */
export type CategoryChip = {
    slug: string;
    dataKey: string;
    emoji: string;
    label: string;
    count: number;
    /** Har kategorin en egen undersida (/evenemang/stad/kategori)? Annars är
     *  chippen bara ett filter och bär stadssidans adress + ?kategori=
     *  (utils/categoryChips — Josef 3/9: filter alltid, undersida bara med
     *  substans). */
    hasPage: boolean;
    /** Dokumenttiteln när kategorin är vald på plats (= kategorisidans
     *  <title>), så fliken säger samma sak som efter en omladdning. Används
     *  bara för chips MED undersida — en omladdning av ?kategori= ger
     *  stadssidans titel, så den behålls där. */
    title: string;
};

const BASE = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-bold transition-colors';
const IDLE = 'bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 hover:border-[#006AA7]/40 dark:hover:border-sky-400/40 hover:text-[#006AA7] dark:hover:text-sky-400';
const ON = 'bg-[#006AA7] border-[#006AA7] text-white';

export default function CategoryChips({ citySlug, cityName, cityTitle, allCount, categories, sourceCounts, inPlace }: {
    citySlug: string;
    cityName: string;
    /** Stadssidans <title> — återställs när man går tillbaka till Alla. */
    cityTitle: string;
    allCount: number;
    /** Tom på småorterna (inga kategorisidor) — då visas bara Fler-chippen. */
    categories: CategoryChip[];
    /** Antal event per opt-in-källa (från servern) — Fler-radens siffror
     *  redan innan något hämtats. */
    sourceCounts: Record<string, number>;
    inPlace: boolean;
}) {
    const pathname = usePathname();
    const { setCategory } = useDayFilter();
    // Frågedelen (?kategori=) läses EFTER mount och hålls i egen state — inte
    // useSearchParams, som kräver en Suspense-gräns på statiska sidor. Vår
    // egen pushState uppdaterar den direkt; bakåt/framåt via popstate.
    // SSR: '' → ingen aktiv fråga, deterministisk hydrering.
    const [search, setSearch] = useState('');
    useEffect(() => {
        const read = () => setSearch(window.location.search);
        read();
        window.addEventListener('popstate', read);
        return () => window.removeEventListener('popstate', read);
    }, []);
    // /evenemang/<stad>/<kategori> eller /evenemang/<stad>?kategori=<slug>
    // → slug; stadssidan utan fråga → null (utils/categoryChips).
    const activeSlug = activeCategorySlug(pathname, search, citySlug);
    const active = activeSlug ? categories.find(c => c.slug === activeSlug) ?? null : null;

    // Kontexten (listan + heron) följer URL:en. Effekt, inte render: SSR:en
    // och första klientrendern ska vara identiska (category null = alla).
    useEffect(() => {
        setCategory(active?.dataKey ?? null);
    }, [active?.dataKey, setCategory]);

    // Dokumenttiteln följer med vid platsbytet (bara när vi bytt själva —
    // vid mount är titeln redan rätt från servern). Suffixet är rotlayoutens
    // title-template ('%s – VADKUL') — samma flik-titel som efter en riktig
    // sidladdning.
    const titleTouchedRef = useRef(false);
    useEffect(() => {
        if (!inPlace) return;
        if (active?.hasPage) {
            document.title = `${active.title} – VADKUL`;
            titleTouchedRef.current = true;
        } else if (titleTouchedRef.current) {
            document.title = `${cityTitle} – VADKUL`;
            titleTouchedRef.current = false;
        }
    }, [inPlace, active, cityTitle]);

    const go = (href: string) => (ev: React.MouseEvent<HTMLAnchorElement>) => {
        if (!inPlace || !isPlainClick(ev)) return; // modifierat klick → ny flik som vanligt
        ev.preventDefault();
        const cur = window.location.pathname + window.location.search;
        if (cur !== href) window.history.pushState(null, '', href);
        // Frågedelen är vår egen state (se ovan) — popstate fyrar inte för
        // pushState, så spegla den direkt.
        setSearch(window.location.search);
    };

    const hasCategories = categories.length > 0;
    const allHref = `/evenemang/${citySlug}`;

    return (
        <div className="mt-8">
            {hasCategories && (
                <h2 className="text-sm font-black text-slate-900 dark:text-zinc-100 mb-2">Populärt i {cityName}</h2>
            )}
            <div className="flex flex-wrap gap-2">
                {hasCategories && (
                    <Link
                        href={allHref}
                        prefetch={inPlace ? false : undefined}
                        onClick={go(allHref)}
                        aria-current={active ? undefined : 'page'}
                        className={`${BASE} ${active ? IDLE : ON}`}
                    >
                        Alla
                        <span className={`font-black ${active ? 'text-slate-400 dark:text-zinc-500' : 'text-white/70'}`}>{allCount}</span>
                    </Link>
                )}
                {categories.map(cat => {
                    const href = categoryChipHref(citySlug, cat.slug, cat.hasPage);
                    const isOn = active?.slug === cat.slug;
                    return (
                        <Link
                            key={cat.slug}
                            href={href}
                            prefetch={inPlace ? false : undefined}
                            onClick={go(href)}
                            aria-current={isOn ? 'page' : undefined}
                            className={`${BASE} ${isOn ? ON : IDLE}`}
                        >
                            <span aria-hidden>{cat.emoji}</span>
                            {cat.label}
                            <span className={`font-black ${isOn ? 'text-white/70' : 'text-slate-400 dark:text-zinc-500'}`}>{cat.count}</span>
                        </Link>
                    );
                })}
                <SourceChips citySlug={citySlug} sourceCounts={sourceCounts} />
            </div>
        </div>
    );
}

/** FLER-chippen + den utfällda källraden (se filhuvudet). Renderas inuti
 *  chip-radens flex-wrap: chippen ligger sist i raden och källraden bryter
 *  till en egen rad under (basis-full). */
function SourceChips({ citySlug, sourceCounts }: { citySlug: string; sourceCounts: Record<string, number> }) {
    const { optInSources, setOptInSources, optInDays, setOptInDays, optInTotals, setOptInTotals } = useDayFilter();
    const { user } = useAuth();
    const [open, setOpen] = useState(false);
    const [status, setStatus] = useState<'idle' | 'loading' | 'failed'>('idle');

    // Standardläget efter mount (aldrig vid SSR): eget val i localStorage
    // vinner; annars 65+-regeln, som kräver profilens ålder (Firestore-
    // läsning — bara för inloggade, precis som kartan gör). Finns förvalda
    // källor fälls raden ut så man ser vad som är på.
    useEffect(() => {
        let cancelled = false;
        let stored: string | null = null;
        try { stored = localStorage.getItem(CITY_OPT_IN_STORAGE_KEY); } catch { /* privat läge */ }
        const apply = (keys: string[]) => {
            setOptInSources(keys);
            if (keys.length > 0) setOpen(true);
        };
        const own = cityOptInDefault(stored, false, undefined);
        if (own.length > 0 || stored || !user) {
            apply(own);
            return;
        }
        userService.getUserProfile(user.uid)
            .then(profile => {
                if (cancelled) return;
                const age = (profile as { age?: unknown } | null)?.age;
                apply(cityOptInDefault(null, true, age));
            })
            .catch(() => { /* ingen profil → förblir tomt */ });
        return () => { cancelled = true; };
    }, [user, setOptInSources]);

    // Hämta stadens opt-in-lista (alla tre källorna) första gången någon
    // källa är på — sedan filtreras den i klienten.
    useEffect(() => {
        if (optInSources.length === 0 || optInDays !== null || status === 'loading') return;
        let cancelled = false;
        setStatus('loading');
        fetch(cityOptInJsonHref(citySlug))
            .then(r => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
            .then((json: { totals?: Record<string, number>; days: unknown[] }) => {
                if (cancelled) return;
                setOptInDays(json.days as never);
                if (json.totals) setOptInTotals(json.totals);
                setStatus('idle');
            })
            .catch(() => { if (!cancelled) setStatus('failed'); });
        return () => { cancelled = true; };
        // status medvetet utanför deps: effekten ska inte köras om av sin egen
        // 'loading'-skrivning, bara av att en källa slås på.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [optInSources, optInDays, citySlug, setOptInDays, setOptInTotals]);

    const toggleSource = (key: string) => {
        const next = optInSources.includes(key)
            ? optInSources.filter(k => k !== key)
            : [...optInSources, key].sort();
        setOptInSources(next);
        if (status === 'failed') setStatus('idle'); // nytt försök
        try { localStorage.setItem(CITY_OPT_IN_STORAGE_KEY, JSON.stringify(next)); } catch { /* privat läge */ }
    };

    const anyOn = optInSources.length > 0;
    const counts = optInTotals ?? sourceCounts;

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                aria-expanded={open}
                aria-label={open ? 'Dölj fler källor' : 'Visa fler källor'}
                className={`${BASE} ${anyOn ? ON : IDLE}`}
            >
                Fler
                {anyOn && <span className="font-black text-white/70">{optInSources.length}</span>}
                <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
            </button>
            {open && (
                <div className="basis-full flex flex-wrap items-center gap-2 pt-1">
                    <span className="text-[11px] font-bold text-slate-400 dark:text-zinc-500">Visa även:</span>
                    {SOURCE_DEFS.map(s => {
                        const on = optInSources.includes(s.key);
                        const n = counts[s.key];
                        return (
                            <button
                                key={s.key}
                                type="button"
                                onClick={() => toggleSource(s.key)}
                                aria-pressed={on}
                                className={`${BASE} ${on ? ON : `${IDLE} border-dashed`}`}
                            >
                                <span aria-hidden>{on ? '✓' : '+'}</span>
                                {s.label}
                                {n !== undefined && (
                                    <span className={`font-black ${on ? 'text-white/70' : 'text-slate-400 dark:text-zinc-500'}`}>{n}</span>
                                )}
                            </button>
                        );
                    })}
                    {status === 'loading' && <span className="text-[11px] font-bold text-slate-400 dark:text-zinc-500">Hämtar…</span>}
                    {status === 'failed' && <span className="text-[11px] font-bold text-rose-500">Kunde inte hämtas — tryck igen</span>}
                </div>
            )}
        </>
    );
}
