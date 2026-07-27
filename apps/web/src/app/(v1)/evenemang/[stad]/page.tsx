import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
    CITIES, CATEGORY_PAGES, MIN_CATEGORY_EVENTS, getCityEvents, pickRecommended, dayLabel,
    todayKey, weekendKeys, countByDayKeys, topVenues, exampleTitles, svList,
} from '../cityData';
import { EventDayList, buildEventsJsonLd, buildBreadcrumbJsonLd, buildFaqJsonLd, FaqSection, type Faq } from '../EventList';
import TopNav from '../TopNav';

// Statiska stads-landningssidor ("Vad händer i Malmö?") byggda ur eventdatat —
// det är de här sidorna som ger Google något att indexera (kartan är klient-
// renderad och osynlig för sökmotorer). Genereras vid build; deploy = färsk data.
export const dynamic = 'force-static';
export const dynamicParams = false;

export function generateStaticParams() {
    return CITIES.map(c => ({ stad: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ stad: string }> }): Promise<Metadata> {
    const { stad } = await params;
    const city = CITIES.find(c => c.slug === stad);
    if (!city) return {};
    const { events } = await getCityEvents(city);
    // "idag/i helgen" i titel+beskrivning matchar hur folk faktiskt söker
    // ("vad händer i växjö idag") — siffrorna bakas vid build och hålls
    // dagsfärska av den dagliga auto-deployen.
    const todayCount = countByDayKeys(events, [todayKey()]);
    const weekendCount = countByDayKeys(events, weekendKeys());
    const counts = todayCount > 0 || weekendCount > 0
        ? ` ${todayCount} idag, ${weekendCount} i helgen.`
        : '';
    const description = `${events.length} kommande evenemang i ${city.name} med omnejd.${counts} Konserter, marknader, sport och saker att göra med barn — allt gratis på VADKUL-kartan.`;
    return {
        title: `Vad händer i ${city.name}? Evenemang & saker att göra idag`,
        description,
        alternates: { canonical: `/evenemang/${city.slug}` },
        openGraph: {
            title: `Vad händer i ${city.name}? ${events.length} evenemang på kartan`,
            description,
            url: `/evenemang/${city.slug}`,
        },
    };
}

export default async function CityPage({ params }: { params: Promise<{ stad: string }> }) {
    const { stad } = await params;
    const city = CITIES.find(c => c.slug === stad);
    if (!city) notFound();
    const { events, updatedAt } = await getCityEvents(city);

    // Kategorichips: bara kategorier med nog många event för en egen sida.
    const perKey = new Map<string, number>();
    for (const e of events) perKey.set(e.category, (perKey.get(e.category) ?? 0) + 1);
    const cityCategories = CATEGORY_PAGES
        .map(cat => ({ cat, count: perKey.get(cat.dataKey) ?? 0 }))
        .filter(c => c.count >= MIN_CATEGORY_EVENTS);

    // Rekommenderat = unika/påkostade händelser (rankingen i cityData), men
    // visas närmast-i-tid-först och styrs av filterraden överst på sidan.
    const recommended = pickRecommended(events);

    // Idag/helg-siffror + vanligaste platserna — unik, sökfras-matchande text
    // per stad ("vad händer i X idag/i helgen", platsnamnen är entiteter
    // Google känner igen). Allt ur samma build-data som listan.
    const tKey = todayKey();
    const wkKeys = weekendKeys();
    const todayCount = countByDayKeys(events, [tKey]);
    const weekendCount = countByDayKeys(events, wkKeys);
    const venues = topVenues(events, city.name);
    const todayEx = exampleTitles(events, [tKey]);
    const weekendEx = exampleTitles(events, wkKeys);

    const faqs: Faq[] = [
        {
            q: `Vad händer i ${city.name} idag?`,
            a: todayCount > 0
                ? `Idag finns ${todayCount} evenemang i ${city.name} med omnejd${todayEx.length ? ` — till exempel ${svList(todayEx)}` : ''}. Alla visas gratis på VADKUL-kartan.`
                : `Inga event är listade i ${city.name} just idag — men ${events.length} kommande evenemang ligger på kartan, ${weekendCount > 0 ? `varav ${weekendCount} redan i helgen` : 'gratis att utforska'}.`,
        },
        {
            q: `Vad kan man göra i helgen i ${city.name}?`,
            a: weekendCount > 0
                ? `I helgen finns ${weekendCount} evenemang i ${city.name}${weekendEx.length ? `, bland annat ${svList(weekendEx)}` : ''}. Hela helgprogrammet finns i listan ovan och på kartan.`
                : `Helgens program är inte publicerat än — just nu ligger ${events.length} kommande evenemang i ${city.name} på VADKUL.`,
        },
        ...(venues.length >= 2 ? [{
            q: `Var händer det mest i ${city.name}?`,
            a: `Platserna med flest kommande evenemang är ${svList(venues)}.`,
        }] : []),
        {
            q: 'Kostar det något att använda VADKUL?',
            a: 'Nej. Kartan och alla eventlistor är gratis och kräver inget konto.',
        },
    ];

    const jsonLd = buildEventsJsonLd(`Evenemang i ${city.name}`, events, city.name, `/evenemang/${city.slug}`);
    const breadcrumbLd = buildBreadcrumbJsonLd([
        { name: 'VADKUL', path: '/' },
        { name: 'Evenemang', path: '/evenemang' },
        { name: city.name, path: `/evenemang/${city.slug}` },
    ]);
    const faqLd = buildFaqJsonLd(faqs);
    const otherCities = CITIES.filter(c => c.slug !== city.slug);

    return (
        <main className="min-h-screen bg-slate-50 text-slate-800">
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
            <TopNav backHref="/evenemang" backLabel="Evenemang i Sverige" ctaLabel="Se allt på kartan" />
            <div className="max-w-2xl mx-auto px-5 pt-6 pb-10">
                <h1 className="text-3xl font-black text-[#006AA7] tracking-tight">
                    Vad händer i {city.name}?
                </h1>
                <p className="mt-3 text-sm leading-relaxed text-slate-600 font-medium">
                    Just nu ligger <strong className="text-slate-900">{events.length} kommande evenemang</strong> i
                    {' '}{city.name} med omnejd på VADKUL
                    {(todayCount > 0 || weekendCount > 0) && (
                        <> — <strong className="text-slate-900">{todayCount} idag</strong> och{' '}
                        <strong className="text-slate-900">{weekendCount} i helgen</strong></>
                    )}. Konserter, marknader, föreläsningar,
                    sport och saker att göra med barn. Allt är gratis att utforska, utan konto.
                    {venues.length >= 2 && <> Mest händer på {svList(venues)}.</>}
                </p>
                <p className="mt-1 text-xs font-bold text-slate-400">Uppdaterad {dayLabel(updatedAt)}</p>

                {/* Filterraden (Idag/Imorgon/I helgen + timstaplar) ligger överst
                    i sektionen och styr allt under: Rekommenderat, kategori-
                    chipsen (children) och dag-för-dag-listan. */}
                <EventDayList events={events} cityName={city.name} recommended={recommended}>
                    {cityCategories.length > 0 && (
                        <div className="mt-8">
                            <h2 className="text-sm font-black text-slate-900 mb-2">Populärt i {city.name}</h2>
                            <div className="flex flex-wrap gap-2">
                                {cityCategories.map(({ cat, count }) => (
                                    <Link
                                        key={cat.slug}
                                        href={`/evenemang/${city.slug}/${cat.slug}`}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:border-[#006AA7]/40 hover:text-[#006AA7] transition-colors"
                                    >
                                        <span aria-hidden>{cat.emoji}</span>
                                        {cat.label}
                                        <span className="text-slate-400 font-black">{count}</span>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    )}
                </EventDayList>

                <FaqSection faqs={faqs} />

                <div className="mt-10 pt-6 border-t border-slate-200">
                    <h2 className="text-sm font-black text-slate-900 mb-3">Evenemang i fler städer</h2>
                    <div className="flex flex-wrap gap-2">
                        {otherCities.map(c => (
                            <Link
                                key={c.slug}
                                href={`/evenemang/${c.slug}`}
                                className="px-3 py-1.5 rounded-full bg-white border border-slate-200 text-xs font-bold text-slate-600 hover:border-[#006AA7]/40 hover:text-[#006AA7] transition-colors"
                            >
                                {c.name}
                            </Link>
                        ))}
                    </div>
                    <p className="mt-6 text-xs text-slate-400 font-medium">
                        Eventen hämtas från öppna källor — arrangörers webbplatser, biljettplattformar och
                        föreningskalendrar. Fel i ett event? Rapportera det via eventkortet på{' '}
                        <Link href="/" className="text-[#006AA7]">kartan</Link>.
                    </p>
                </div>
            </div>
        </main>
    );
}
