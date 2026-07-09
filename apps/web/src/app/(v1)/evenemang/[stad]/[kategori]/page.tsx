import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
    CITIES, CATEGORY_PAGES, MIN_CATEGORY_EVENTS,
    categoryBySlug, getCityCategoryEvents, getCategoryCombos, dayLabel,
} from '../../cityData';
import { EventDayList, buildEventsJsonLd } from '../../EventList';

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
    const description = `${events.length} kommande evenemang: ${cat.intro(city.name)} i ${city.name} med omnejd. Se allt som händer på VADKUL-kartan, gratis.`;
    return {
        title: cat.h1(city.name),
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

    const jsonLd = buildEventsJsonLd(cat.h1(city.name), events, city.name, `/evenemang/${city.slug}/${cat.slug}`);

    return (
        <main className="min-h-screen bg-slate-50 text-slate-800">
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
            <div className="max-w-2xl mx-auto px-5 py-10">
                {/* Topprad: tillbaka-länken till vänster, kart-knappen till höger
                    (samma mönster som stadssidan). */}
                <div className="flex items-center justify-between gap-3">
                    <Link
                        href={`/evenemang/${city.slug}`}
                        className="inline-flex items-center gap-1.5 text-sm font-black text-[#006AA7] hover:text-[#005590] transition-colors"
                    >
                        ← Alla evenemang i {city.name}
                    </Link>
                    <Link
                        href="/"
                        className="inline-flex items-center px-4 py-2 rounded-full bg-[#006AA7] hover:bg-[#005590] text-white font-black text-xs shadow-md transition-colors shrink-0"
                    >
                        Se allt på kartan
                    </Link>
                </div>

                <h1 className="mt-5 text-3xl font-black text-[#006AA7] tracking-tight">
                    <span aria-hidden>{cat.emoji}</span> {cat.h1(city.name)}
                </h1>
                <p className="mt-3 text-sm leading-relaxed text-slate-600 font-medium">
                    Just nu ligger <strong className="text-slate-900">{events.length} kommande evenemang</strong> med
                    {' '}{cat.intro(city.name)} i {city.name} med omnejd på VADKUL.
                    Allt är gratis att utforska, utan konto.
                </p>
                <p className="mt-1 text-xs font-bold text-slate-400">Uppdaterad {dayLabel(updatedAt)}</p>

                <EventDayList events={events} cityName={city.name} />

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
