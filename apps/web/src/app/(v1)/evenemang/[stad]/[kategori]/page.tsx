import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
    CITIES, CATEGORY_PAGES, MIN_CATEGORY_EVENTS,
    categoryBySlug, getCityCategoryEvents, getCategoryCombos, dayLabel,
    todayKey, weekendKeys, weekKeys, countByDayKeys, topVenues, exampleTitles, svList,
} from '../../cityData';
import { EventDayList, buildEventsJsonLd, buildBreadcrumbJsonLd, buildFaqJsonLd, FaqSection, type Faq } from '../../EventList';
import TopNav from '../../TopNav';
import CityMapHero, { cityMapHref } from '../../CityMapHero';
import { DayFilterProvider } from '../../dayFilter';

// Kategorisidor per stad ("Konserter i Malmö", "Saker att göra med barn i
// Stockholm") — fångar de SPECIFIKA sökfraserna folk faktiskt googlar, som
// stadssidan är för bred för. Genereras BARA för kombinationer med
// ≥ MIN_CATEGORY_EVENTS kommande event (inga tunna sidor).
export const dynamic = 'force-static';
export const dynamicParams = false;

export async function generateStaticParams() {
    const combos = await getCategoryCombos();
    return combos.map(({ city, cat }) => ({ stad: city.slug, kategori: cat.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ stad: string; kategori: string }> }): Promise<Metadata> {
    const { stad, kategori } = await params;
    const city = CITIES.find(c => c.slug === stad);
    const cat = categoryBySlug(kategori);
    if (!city || !cat) return {};
    const { events } = await getCityCategoryEvents(city, cat.dataKey);
    // "idag & i veckan" i titeln fångar långsvansen ("konserter kalmar")
    // — siffrorna hålls färska av den dagliga auto-deployen.
    //
    // VECKOTALET, inte helgtalet (Josef 20/8) — se stadssidans metadata:
    // helgsiffran är noll halva veckan. Veckan = idag + 6 dagar och rymmer
    // alltså dagens event. Helg-långsvansen lever kvar i FAQ:n nedan
    // ("Vilka konserter är det i helgen i …?"), som svarar på just den frågan.
    const todayCount = countByDayKeys(events, [todayKey()]);
    const weekCount = countByDayKeys(events, weekKeys());
    const counts = todayCount > 0 || weekCount > 0
        ? ` ${todayCount} idag, ${weekCount} i veckan.`
        : '';
    const description = `${events.length} kommande evenemang: ${cat.intro(city.name)} i ${city.name} med omnejd.${counts} Se allt som händer på VADKUL-kartan, gratis.`;
    return {
        title: `${cat.h1(city.name)} — idag & i veckan`,
        description,
        alternates: { canonical: `/evenemang/${city.slug}/${cat.slug}` },
        openGraph: {
            title: `${cat.h1(city.name)} — ${events.length} evenemang på kartan`,
            description,
            url: `/evenemang/${city.slug}/${cat.slug}`,
        },
    };
}

export default async function CityCategoryPage({ params }: { params: Promise<{ stad: string; kategori: string }> }) {
    const { stad, kategori } = await params;
    const city = CITIES.find(c => c.slug === stad);
    const cat = categoryBySlug(kategori);
    if (!city || !cat) notFound();
    const { events, updatedAt } = await getCityCategoryEvents(city, cat.dataKey);

    // Korslänkar: stadens övriga kategorisidor + samma kategori i andra städer.
    const combos = await getCategoryCombos();
    const siblingCategories = combos
        .filter(c => c.city.slug === city.slug && c.cat.slug !== cat.slug);
    const sameCategoryElsewhere = combos
        .filter(c => c.cat.slug === cat.slug && c.city.slug !== city.slug)
        .sort((a, b) => b.count - a.count)
        .slice(0, 12);

    // Idag/helg-siffror + exempel + vanligaste platserna — samma sökfras-
    // matchande build-text som stadssidan, men kategorispecifik ("vilka
    // konserter är det i kalmar i helgen").
    const tKey = todayKey();
    const wkKeys = weekendKeys();
    const todayCount = countByDayKeys(events, [tKey]);
    const weekendCount = countByDayKeys(events, wkKeys);
    // Intro-raden visar VECKANS antal, precis som stadssidan (Josef 11/8 för
    // stadssidan, kategorisidan följde efter 20/8) — helg-siffran lever kvar i
    // FAQ:n som svarar på helg-frågan.
    const weekCount = countByDayKeys(events, weekKeys());
    const venues = topVenues(events, city.name);
    const todayEx = exampleTitles(events, [tKey]);
    const weekendEx = exampleTitles(events, wkKeys);

    const faqs: Faq[] = [
        {
            q: `Vilka ${cat.noun} är det i ${city.name} idag?`,
            a: todayCount > 0
                ? `Idag finns ${todayCount} ${cat.noun} i ${city.name} med omnejd${todayEx.length ? ` — till exempel ${svList(todayEx)}` : ''}.`
                : `Inga ${cat.noun} är listade i ${city.name} just idag — men ${events.length} kommande ligger i listan ovan och på VADKUL-kartan.`,
        },
        {
            q: `Vilka ${cat.noun} är det i helgen i ${city.name}?`,
            a: weekendCount > 0
                ? `I helgen finns ${weekendCount} ${cat.noun} i ${city.name}${weekendEx.length ? `, bland annat ${svList(weekendEx)}` : ''}.`
                : `Helgen har inga listade ${cat.noun} än — håll utkik i listan ovan, den uppdateras varje dag.`,
        },
        ...(venues.length >= 2 ? [{
            q: `Var brukar ${cat.noun} hållas i ${city.name}?`,
            a: `Platserna med flest kommande ${cat.noun} är ${svList(venues)}.`,
        }] : []),
    ];

    const jsonLd = buildEventsJsonLd(cat.h1(city.name), events, city.name, `/evenemang/${city.slug}/${cat.slug}`);
    const breadcrumbLd = buildBreadcrumbJsonLd([
        { name: 'VADKUL', path: '/' },
        { name: 'Evenemang', path: '/evenemang' },
        { name: city.name, path: `/evenemang/${city.slug}` },
        { name: cat.label, path: `/evenemang/${city.slug}/${cat.slug}` },
    ]);
    const faqLd = buildFaqJsonLd(faqs);

    return (
        <main className="min-h-screen bg-slate-50 text-slate-800">
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
            <TopNav
                backHref={`/evenemang/${city.slug}`}
                backLabel={`Alla evenemang i ${city.name}`}
                ctaLabel="Se allt på kartan"
                ctaHref={cityMapHref(city)}
            />
            <div className="max-w-2xl mx-auto px-5 pt-6 pb-10">
                <h1 className="text-3xl font-black text-[#006AA7] tracking-tight">
                    <span aria-hidden>{cat.emoji}</span> {cat.h1(city.name)}
                </h1>
                {/* Samma delade dagfilter som stadssidan: kart-heron och
                    daglistan är ETT filter (dayFilter.tsx). */}
                <DayFilterProvider>
                {/* Samma kart-hero som stadssidan, men bara kategorins event
                    som brickor (ingen Rekommenderat-ranking här — bildsatta
                    event prioriteras av pickBricks fallbacken). */}
                <CityMapHero
                    city={city}
                    events={events}
                    recommended={[]}
                    ctaLabel={`Öppna kartan över ${city.name}`}
                />
                <p className="mt-3 text-sm leading-relaxed text-slate-600 font-medium">
                    Just nu ligger <strong className="text-slate-900">{events.length} kommande evenemang</strong> med
                    {' '}{cat.intro(city.name)} i {city.name} med omnejd på VADKUL
                    {(todayCount > 0 || weekCount > 0) && (
                        <> — <strong className="text-slate-900">{todayCount} idag</strong> och{' '}
                        <strong className="text-slate-900">{weekCount} i veckan</strong></>
                    )}.
                    Allt är gratis att utforska, utan konto.
                    {venues.length >= 2 && <> Vanliga platser: {svList(venues)}.</>}
                </p>
                <p className="mt-1 text-xs font-bold text-slate-400">Uppdaterad {dayLabel(updatedAt)}</p>

                <EventDayList events={events} cityName={city.name} />
                </DayFilterProvider>

                <FaqSection faqs={faqs} />

                {siblingCategories.length > 0 && (
                    <div className="mt-10 pt-6 border-t border-slate-200">
                        <h2 className="text-sm font-black text-slate-900 mb-3">Mer i {city.name}</h2>
                        <div className="flex flex-wrap gap-2">
                            {siblingCategories.map(({ cat: c, count }) => (
                                <Link
                                    key={c.slug}
                                    href={`/evenemang/${city.slug}/${c.slug}`}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:border-[#006AA7]/40 hover:text-[#006AA7] transition-colors"
                                >
                                    <span aria-hidden>{c.emoji}</span>
                                    {c.label}
                                    <span className="text-slate-400 font-black">{count}</span>
                                </Link>
                            ))}
                        </div>
                    </div>
                )}

                {sameCategoryElsewhere.length > 0 && (
                    <div className="mt-8">
                        <h2 className="text-sm font-black text-slate-900 mb-3">{cat.label} i fler städer</h2>
                        <div className="flex flex-wrap gap-2">
                            {sameCategoryElsewhere.map(({ city: c }) => (
                                <Link
                                    key={c.slug}
                                    href={`/evenemang/${c.slug}/${cat.slug}`}
                                    className="px-3 py-1.5 rounded-full bg-white border border-slate-200 text-xs font-bold text-slate-600 hover:border-[#006AA7]/40 hover:text-[#006AA7] transition-colors"
                                >
                                    {c.name}
                                </Link>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </main>
    );
}
