import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CITIES, CATEGORY_PAGES, MIN_CATEGORY_EVENTS, getCityEvents, pickRecommended, dayLabel } from '../cityData';
import { EventDayList, buildEventsJsonLd } from '../EventList';

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
    const description = `${events.length} kommande evenemang i ${city.name} med omnejd — konserter, marknader, sport och saker att göra med barn. Se allt som händer på VADKUL-kartan, gratis.`;
    return {
        title: `Vad händer i ${city.name}? Evenemang & saker att göra`,
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

    const jsonLd = buildEventsJsonLd(`Evenemang i ${city.name}`, events, city.name, `/evenemang/${city.slug}`);
    const otherCities = CITIES.filter(c => c.slug !== city.slug);

    return (
        <main className="min-h-screen bg-slate-50 text-slate-800">
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
            <div className="max-w-2xl mx-auto px-5 py-10">
                {/* Topprad: tillbaka-länken till vänster, kart-knappen till höger. */}
                <div className="flex items-center justify-between gap-3">
                    <Link
                        href="/evenemang"
                        className="inline-flex items-center gap-1.5 text-sm font-black text-[#006AA7] hover:text-[#005590] transition-colors"
                    >
                        ← Tillbaka till Evenemang i Sverige
                    </Link>
                    <Link
                        href="/"
                        className="inline-flex items-center px-4 py-2 rounded-full bg-[#006AA7] hover:bg-[#005590] text-white font-black text-xs shadow-md transition-colors"
                    >
                        Se allt på kartan
                    </Link>
                </div>

                <h1 className="mt-5 text-3xl font-black text-[#006AA7] tracking-tight">
                    Vad händer i {city.name}?
                </h1>
                <p className="mt-3 text-sm leading-relaxed text-slate-600 font-medium">
                    Just nu ligger <strong className="text-slate-900">{events.length} kommande evenemang</strong> i
                    {' '}{city.name} med omnejd på VADKUL — konserter, marknader, föreläsningar,
                    sport och saker att göra med barn. Allt är gratis att utforska, utan konto.
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
