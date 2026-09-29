import { safeJsonLd } from '@/utils/jsonLd';
import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { svList } from '../../evenemang/cityData';
import { EventDayList, buildEventsJsonLd, buildBreadcrumbJsonLd } from '../../evenemang/EventList';
import TopNav from '../../evenemang/TopNav';
import { cityMapHref } from '../../evenemang/CityMapHero';
import { DayFilterProvider } from '../../evenemang/dayFilter';
import { getOrganizer, getNationalUpcomingCountRuntime, type Organizer } from '../organizerData';
import { ORGANIZER_PAGE_INDEX_MIN, organizerHref } from '@/utils/organizerPages';

// Arrangörssidan (29/9): alla kommande event från en arrangör, för besökarna
// (och Google). Statistiken för arrangören visas ALDRIG här - besökssiffror
// är inte publika (ägarbeslut 29/8); den går till arrangören per mejl.
//
// Renderas på begäran och cachas (ISR): 2 000+ arrangörer går inte att
// förrendera vid deploy. Datat ändras bara vid deploy, och varje deploy
// tömmer cachen; revalidate håller "kommande"-urvalet dagsfärskt däremellan.
// Listan filtrerar dessutom bort gårdagar i klienten (DayFilteredList).
export const revalidate = 21600;
export const dynamicParams = true;

export function generateStaticParams() {
    return [];
}

/** Arrangörens egen sajt, när den finns (inte för Facebook-arrangörer). */
function siteUrl(o: Organizer): string | null {
    const d = o.domains.find(x => !/(^|\.)facebook\.com$/.test(x));
    return d ? `https://${d}` : null;
}

function description(o: Organizer): string {
    const where = o.cities.length ? ` i ${svList(o.cities.map(c => c.name))}` : '';
    return `${o.events.length} kommande evenemang från ${o.name}${where}. Se datum, tider och platser - gratis på VADKUL-kartan.`;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
    const { slug } = await params;
    const o = await getOrganizer(slug);
    if (!o) return { title: 'Arrangör', robots: { index: false } };
    const desc = description(o);
    return {
        title: `${o.name}: evenemang och program`,
        description: desc,
        // Tunna sidor finns (länkarna ska inte 404:a) men bjuds inte ut.
        ...(o.events.length < ORGANIZER_PAGE_INDEX_MIN ? { robots: { index: false, follow: true } } : {}),
        alternates: { canonical: organizerHref(o.slug) },
        openGraph: {
            title: `${o.name} på VADKUL: ${o.events.length} kommande evenemang`,
            description: desc,
            url: organizerHref(o.slug),
            type: 'website',
            siteName: 'VADKUL',
            locale: 'sv_SE',
        },
    };
}

export default async function OrganizerPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const o = await getOrganizer(slug);
    if (!o) notFound();
    const nationalCount = await getNationalUpcomingCountRuntime();
    const home = o.cities[0] ?? null;
    const site = siteUrl(o);
    const path = organizerHref(o.slug);

    const jsonLd = buildEventsJsonLd(`Evenemang från ${o.name}`, o.events, home?.name ?? 'Sverige', path);
    const breadcrumbLd = buildBreadcrumbJsonLd([
        { name: 'VADKUL', path: '/' },
        ...(home ? [{ name: home.name, path: `/evenemang/${home.slug}` }] : []),
        { name: o.name, path },
    ]);
    const orgLd = {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: o.name,
        ...(site ? { url: site } : {}),
    };

    return (
        <main className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-800 dark:text-zinc-200">
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }} />
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumbLd) }} />
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(orgLd) }} />
            <TopNav ctaHref={home ? cityMapHref(home) : '/'} ctaCount={nationalCount} />
            <div className="max-w-2xl mx-auto px-5 pt-6 pb-10">
                <p className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500">Arrangör</p>
                <h1 className="mt-1 text-3xl font-black text-[#006AA7] dark:text-sky-400 tracking-tight">{o.name}</h1>
                <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-zinc-400 font-medium">
                    Just nu ligger <strong className="text-slate-900 dark:text-zinc-100">{o.events.length} kommande evenemang</strong> från
                    {' '}{o.name} på VADKUL
                    {o.cities.length > 0 && <>, i {svList(o.cities.map(c => c.name))}</>}.
                    {' '}Klicka på ett event för tid, plats och biljetter, eller se alla på kartan.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                    {site && (
                        <a
                            href={site}
                            target="_blank"
                            rel="noopener"
                            className="px-3 py-1.5 rounded-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs font-bold text-slate-600 dark:text-zinc-400 hover:border-[#006AA7]/40 hover:text-[#006AA7] dark:hover:text-sky-400 transition-colors"
                        >
                            {site.replace(/^https:\/\//, '')} ↗
                        </a>
                    )}
                    {/* Kartan filtrerad till arrangören (?arrangor=, 29/9):
                        alla deras kommande event, bricka överst för att släppa. */}
                    <Link
                        href={home ? `${cityMapHref(home)}&arrangor=${o.slug}` : `/?arrangor=${o.slug}`}
                        className="px-3 py-1.5 rounded-full bg-[#006AA7] border border-[#006AA7] text-xs font-bold text-white hover:bg-[#00598c] transition-colors"
                    >
                        Se alla på kartan →
                    </Link>
                </div>

                <DayFilterProvider>
                    <EventDayList events={o.events} cityName={home?.name ?? o.name} />
                </DayFilterProvider>

                <div className="mt-10 pt-6 border-t border-slate-200 dark:border-zinc-800">
                    {o.neighbours.length > 0 && home && (
                        <>
                            <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500 mb-3">Fler arrangörer i {home.name}</h2>
                            <div className="flex flex-wrap gap-2 mb-6">
                                {o.neighbours.map(n => (
                                    <Link
                                        key={n.slug}
                                        href={organizerHref(n.slug)}
                                        className="px-3 py-1.5 rounded-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs font-bold text-slate-600 dark:text-zinc-400 hover:border-[#006AA7]/40 dark:hover:border-sky-400/40 hover:text-[#006AA7] dark:hover:text-sky-400 transition-colors"
                                    >
                                        {n.name}
                                    </Link>
                                ))}
                            </div>
                        </>
                    )}
                    {home && (
                        <Link
                            href={`/evenemang/${home.slug}`}
                            className="text-sm font-black text-[#006AA7] dark:text-sky-400"
                        >
                            Allt som händer i {home.name} →
                        </Link>
                    )}
                    <p className="mt-6 text-xs text-slate-400 dark:text-zinc-500 font-medium">
                        Eventen hämtas automatiskt från {site ? site.replace(/^https:\/\//, '') : 'arrangörens egna kanaler'} och
                        {' '}visas gratis på VADKUL. Är du från {o.name}? Hör av dig till{' '}
                        <a href="mailto:info@vadkul.se" className="text-[#006AA7] dark:text-sky-400">info@vadkul.se</a>.
                    </p>
                </div>
            </div>
        </main>
    );
}
