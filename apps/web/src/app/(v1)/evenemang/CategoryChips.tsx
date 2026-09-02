'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { useDayFilter } from './dayFilter';
import { isPlainClick } from '@/utils/eventExpand';

/**
 * Kategorichipsen på stads- och kategorisidorna ("Populärt i Stockholm").
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
 */
export type CategoryChip = {
    slug: string;
    dataKey: string;
    emoji: string;
    label: string;
    count: number;
    /** Dokumenttiteln när kategorin är vald på plats (= kategorisidans
     *  <title>), så fliken säger samma sak som efter en omladdning. */
    title: string;
};

export default function CategoryChips({ citySlug, cityName, cityTitle, allCount, categories, inPlace }: {
    citySlug: string;
    cityName: string;
    /** Stadssidans <title> — återställs när man går tillbaka till Alla. */
    cityTitle: string;
    allCount: number;
    categories: CategoryChip[];
    inPlace: boolean;
}) {
    const pathname = usePathname();
    const { setCategory } = useDayFilter();
    // /evenemang/<stad>/<kategori> → kategori-slug; stadssidan → null.
    const seg = pathname.split('/').filter(Boolean);
    const activeSlug = seg[0] === 'evenemang' && seg[1] === citySlug && seg[2] ? seg[2] : null;
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
        if (active) {
            document.title = `${active.title} – VADKUL`;
            titleTouchedRef.current = true;
        } else if (titleTouchedRef.current) {
            document.title = `${cityTitle} – VADKUL`;
        }
    }, [inPlace, active, cityTitle]);

    const go = (href: string) => (ev: React.MouseEvent<HTMLAnchorElement>) => {
        if (!inPlace || !isPlainClick(ev)) return; // modifierat klick → ny flik som vanligt
        ev.preventDefault();
        if (window.location.pathname !== href) window.history.pushState(null, '', href);
    };

    const base = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-bold transition-colors';
    const idle = 'bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 hover:border-[#006AA7]/40 dark:hover:border-sky-400/40 hover:text-[#006AA7] dark:hover:text-sky-400';
    const on = 'bg-[#006AA7] border-[#006AA7] text-white';
    const allHref = `/evenemang/${citySlug}`;

    return (
        <div className="mt-8">
            <h2 className="text-sm font-black text-slate-900 dark:text-zinc-100 mb-2">Populärt i {cityName}</h2>
            <div className="flex flex-wrap gap-2">
                <Link
                    href={allHref}
                    prefetch={inPlace ? false : undefined}
                    onClick={go(allHref)}
                    aria-current={active ? undefined : 'page'}
                    className={`${base} ${active ? idle : on}`}
                >
                    Alla
                    <span className={`font-black ${active ? 'text-slate-400 dark:text-zinc-500' : 'text-white/70'}`}>{allCount}</span>
                </Link>
                {categories.map(cat => {
                    const href = `/evenemang/${citySlug}/${cat.slug}`;
                    const isOn = active?.slug === cat.slug;
                    return (
                        <Link
                            key={cat.slug}
                            href={href}
                            prefetch={inPlace ? false : undefined}
                            onClick={go(href)}
                            aria-current={isOn ? 'page' : undefined}
                            className={`${base} ${isOn ? on : idle}`}
                        >
                            <span aria-hidden>{cat.emoji}</span>
                            {cat.label}
                            <span className={`font-black ${isOn ? 'text-white/70' : 'text-slate-400 dark:text-zinc-500'}`}>{cat.count}</span>
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}
