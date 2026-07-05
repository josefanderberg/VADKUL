import Link from 'next/link';
import type { Metadata } from 'next';
import { getCityCounts } from './cityData';

// Indexsida för stadssidorna — intern länknav som hjälper Google att hitta
// alla städer, och en naturlig landningssida för breda sök ("evenemang sverige").
export const dynamic = 'force-static';

export const metadata: Metadata = {
    title: 'Evenemang i Sverige — stad för stad',
    description:
        'Vad händer nära dig? VADKUL samlar tusentals evenemang i hela Sverige på en karta — välj din stad och se konserter, marknader, sport och barnaktiviteter.',
    alternates: { canonical: '/evenemang' },
};

export default async function CityIndexPage() {
    const counts = await getCityCounts();
    const total = counts.reduce((sum, c) => sum + c.count, 0);

    return (
        <main className="min-h-screen bg-slate-50 text-slate-800">
            <div className="max-w-2xl mx-auto px-5 py-10">
                <Link
                    href="/"
                    className="inline-flex items-center gap-1.5 text-sm font-black text-[#006AA7] hover:text-[#005590] transition-colors"
                >
                    ← Till kartan
                </Link>

                <h1 className="mt-5 text-3xl font-black text-[#006AA7] tracking-tight">
                    Evenemang i Sverige — stad för stad
                </h1>
                <p className="mt-3 text-sm leading-relaxed text-slate-600 font-medium">
                    VADKUL samlar allt som händer på en karta — just nu{' '}
                    <strong className="text-slate-900">{total.toLocaleString('sv-SE')} kommande evenemang</strong>{' '}
                    kring städerna nedan. Välj din stad, eller öppna kartan direkt.
                </p>

                <Link
                    href="/"
                    className="mt-5 inline-flex items-center justify-center px-6 py-3 rounded-2xl bg-[#006AA7] hover:bg-[#005590] text-white font-black text-sm shadow-lg transition-colors"
                >
                    Öppna kartan
                </Link>

                <ul className="mt-9 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {counts.map(({ city, count }) => (
                        <li key={city.slug}>
                            <Link
                                href={`/evenemang/${city.slug}`}
                                className="flex items-baseline justify-between gap-3 rounded-xl bg-white border border-slate-200 px-4 py-3 hover:border-[#006AA7]/40 hover:shadow-sm transition-all"
                            >
                                <span className="text-sm font-bold text-slate-900">Vad händer i {city.name}?</span>
                                <span className="text-xs font-black text-[#006AA7] whitespace-nowrap tabular-nums">
                                    {count} event
                                </span>
                            </Link>
                        </li>
                    ))}
                </ul>
            </div>
        </main>
    );
}
