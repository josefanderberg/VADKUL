import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
    CITIES, MIN_INDEXABLE_EVENTS, distKm,
    getCityEvents, getCityOptInEvents, getCityCategoryChips, countBySource, pickRecommended, dayLabel, cityTitle, categoryTitle,
    todayKey, weekendKeys, weekKeys, countByDayKeys, countsSentence, topVenues, exampleTitles, svList,
} from '../cityData';
import CategoryChips from '../CategoryChips';
import { EventDayList, buildEventsJsonLd, buildBreadcrumbJsonLd, buildFaqJsonLd, FaqSection, type Faq } from '../EventList';
import TopNav from '../TopNav';
import CityMapHero, { cityMapHref } from '../CityMapHero';
import { DayFilterProvider } from '../dayFilter';
import CityVisitBeacon from '@/components/analytics/CityVisitBeacon';
// Chipsen visar KARTANS ettords-etiketter (samma källa som kategorifiltret på
// kartan — Musik, Sport, Familj …), inte kategorisidornas långa SEO-namn.
import { categoryLabel } from '@/components/v2/v2MapLabel';

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
    // "idag/i helgen/i veckan" matchar hur folk faktiskt söker ("vad händer i
    // växjö idag", "…i helgen") — siffrorna bakas vid build och hålls
    // dagsfärska av den dagliga auto-deployen. Ordning och nollhantering:
    // se countsSentence i cityData.
    //
    // Svansen är MEDVETET kort ("gratis på VADKUL", inte "allt gratis på
    // VADKUL-kartan"): med tre tal ligger beskrivningen annars över Googles
    // ~155-teckengräns och kapas mitt i ordet — precis det utdrag Josef såg
    // 20/8 ("allt gratis på …").
    const todayCount = countByDayKeys(events, [todayKey()]);
    const weekendCountMeta = countByDayKeys(events, weekendKeys());
    const weekCount = countByDayKeys(events, weekKeys());
    const counts = countsSentence(todayCount, weekendCountMeta, weekCount);
    // "kommande" är struket (20/8): siffrorna direkt efter säger idag/helgen/
    // veckan, så ordet bar ingen egen information — och de tecknen behövdes
    // för att helgtalet skulle rymmas utan att svansen kapas.
    const description = `${events.length} evenemang i ${city.name} med omnejd.${counts} Konserter, marknader, sport och saker att göra med barn — gratis på VADKUL.`;
    return {
        title: cityTitle(city.name),
        description,
        // Säsongsvakt för småorterna: tunn sida → noindex (och ur sitemapen),
        // tills utbudet kommer tillbaka. Sidan finns kvar så länkar inte 404:ar.
        ...(city.small && events.length < MIN_INDEXABLE_EVENTS
            ? { robots: { index: false, follow: true } }
            : {}),
        alternates: { canonical: `/evenemang/${city.slug}` },
        openGraph: {
            title: `Vad händer i ${city.name}? ${events.length} evenemang på kartan`,
            description,
            url: `/evenemang/${city.slug}`,
            // Sidans openGraph ERSÄTTER rotens (Next slår inte ihop nästlade fält) —
            // utan de här saknade Facebook og:type/siteName (Sharing Debugger 4/9).
            type: 'website',
            siteName: 'VADKUL',
            locale: 'sv_SE',
        },
    };
}

export default async function CityPage({ params }: { params: Promise<{ stad: string }> }) {
    const { stad } = await params;
    const city = CITIES.find(c => c.slug === stad);
    if (!city) notFound();
    const { events, updatedAt } = await getCityEvents(city);
    // Fler-radens siffror per opt-in-källa (kyrkan/PRO/Korpen). Själva
    // eventen går ALDRIG in i sidan — de hämtas ur stadens opt-in.json.
    const sourceCounts = countBySource((await getCityOptInEvents(city)).events);

    // Kategorichips = FILTER (från 3 event, alla orter). hasPage säger om
    // kategorin också har en egen undersida (5 i storstad / 10 i småort) —
    // annars filtrerar chippen på plats under ?kategori= (Josef 3/9).
    const cityCategories = getCityCategoryChips(city, events);

    // Unika/påkostade händelser (rankingen i cityData) — går numera BARA till
    // kart-heron, som väljer sina brickor ur dem. Den egna "Rekommenderat"-
    // karusellen i listan är borttagen 9/8 (ägarbeslut: urvalet höll inte).
    const recommended = pickRecommended(events);

    // Idag/helg-siffror + vanligaste platserna — unik, sökfras-matchande text
    // per stad ("vad händer i X idag/i helgen", platsnamnen är entiteter
    // Google känner igen). Allt ur samma build-data som listan.
    const tKey = todayKey();
    const wkKeys = weekendKeys();
    const todayCount = countByDayKeys(events, [tKey]);
    const weekendCount = countByDayKeys(events, wkKeys);
    // Intro-raden visar VECKANS antal (Josef 11/8, ersatte helg-talet) —
    // helg-siffran lever kvar i metadata/FAQ som matchar helg-sökfraserna.
    const weekCount = countByDayKeys(events, weekKeys());
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
    // "Fler städer": de 12 NÄRMASTE, inte alla. Med 71 städer i listan blev
    // full-mesh-länkningen (70 länkar på varje sida) sitewide-boilerplate;
    // närhetsurvalet är dessutom det enda som är relevant för läsaren.
    // /evenemang-indexet länkar fortfarande allihop — det är navet.
    const otherCities = CITIES
        .filter(c => c.slug !== city.slug)
        .map(c => ({ c, d: distKm(city.lat, city.lng, c.lat, c.lng) }))
        .sort((a, b) => a.d - b.d)
        .slice(0, 12)
        .map(x => x.c);

    return (
        <main className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-800 dark:text-zinc-200">
            {/* Besöksräknaren: en ping per webbläsare/dag → topplistans
                besök-kolumn på /evenemang. Sidan är statisk, så räknandet
                måste ske klient-side. */}
            <CityVisitBeacon stad={city.slug} />
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
            <TopNav backHref="/evenemang" backLabel="Evenemang i Sverige" ctaLabel="Se allt på kartan" ctaHref={cityMapHref(city)} />
            <div className="max-w-2xl mx-auto px-5 pt-6 pb-10">
                <h1 className="text-3xl font-black text-[#006AA7] dark:text-sky-400 tracking-tight">
                    Vad händer i {city.name}?
                </h1>
                {/* Providern gör kart-heron och daglistan till SAMMA filter:
                    dagchips på kartan styr listan och tvärtom, och kart-
                    popupens klick scrollar till raden (dayFilter.tsx). */}
                <DayFilterProvider>
                {/* Kart-heron direkt under H1: sidans "startskärms-krok" — man
                    ser kartan och stadens brickor innan man läser något alls. */}
                <CityMapHero
                    city={city}
                    events={events}
                    recommended={recommended}
                    ctaLabel={`Öppna kartan över ${city.name}`}
                />
                <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-zinc-400 font-medium">
                    Just nu ligger <strong className="text-slate-900 dark:text-zinc-100">{events.length} kommande evenemang</strong> i
                    {' '}{city.name} med omnejd på VADKUL
                    {(todayCount > 0 || weekCount > 0) && (
                        <> — <strong className="text-slate-900 dark:text-zinc-100">{todayCount} idag</strong> och{' '}
                        <strong className="text-slate-900 dark:text-zinc-100">{weekCount} i veckan</strong></>
                    )}. Konserter, marknader, föreläsningar,
                    sport och saker att göra med barn. Allt är gratis att utforska, utan konto.
                    {venues.length >= 2 && <> Mest händer på {svList(venues)}.</>}
                </p>
                <p className="mt-1 text-xs font-bold text-slate-400 dark:text-zinc-500">Uppdaterad {dayLabel(updatedAt)}</p>

                {/* Filterraden (Idag/Imorgon/I helgen + timstaplar) ligger överst
                    i sektionen och styr allt under: kategorichipsen (children)
                    och dag-för-dag-listan. */}
                <EventDayList events={events} cityName={city.name}>
                    {/* Kategorichipsen: riktiga länkar till kategorisidorna
                        (Google), men ett vanligt klick filtrerar listan PÅ
                        PLATS och byter URL:en (Josef 2/9) — se CategoryChips. */}
                    {/* Renderas även på småorterna (tom kategorilista): då
                        blir raden bara Fler-chippen med opt-in-källorna
                        (kyrkan/PRO/Korpen), som hämtas först när någon slås
                        på — utanför HTML:n och siffrorna. */}
                    <CategoryChips
                        inPlace
                        citySlug={city.slug}
                        cityName={city.name}
                        cityTitle={cityTitle(city.name)}
                        allCount={events.length}
                        categories={cityCategories.map(({ cat, count, hasPage }) => ({
                            slug: cat.slug,
                            dataKey: cat.dataKey,
                            emoji: cat.emoji,
                            label: categoryLabel(cat.dataKey),
                            count,
                            hasPage,
                            title: categoryTitle(cat, city.name),
                        }))}
                        sourceCounts={sourceCounts}
                    />
                </EventDayList>
                </DayFilterProvider>

                <FaqSection faqs={faqs} />

                <div className="mt-10 pt-6 border-t border-slate-200 dark:border-zinc-800">
                    <h2 className="text-sm font-black text-slate-900 dark:text-zinc-100 mb-3">Evenemang i fler städer</h2>
                    <div className="flex flex-wrap gap-2">
                        {otherCities.map(c => (
                            <Link
                                key={c.slug}
                                href={`/evenemang/${c.slug}`}
                                className="px-3 py-1.5 rounded-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs font-bold text-slate-600 dark:text-zinc-400 hover:border-[#006AA7]/40 dark:hover:border-sky-400/40 hover:text-[#006AA7] dark:hover:text-sky-400 transition-colors"
                            >
                                {c.name}
                            </Link>
                        ))}
                    </div>
                    <p className="mt-6 text-xs text-slate-400 dark:text-zinc-500 font-medium">
                        Eventen hämtas från öppna källor — arrangörers webbplatser, biljettplattformar och
                        föreningskalendrar. Fel i ett event? Rapportera det via eventkortet på{' '}
                        <Link href="/" className="text-[#006AA7] dark:text-sky-400">kartan</Link>.
                    </p>
                </div>
            </div>
        </main>
    );
}
