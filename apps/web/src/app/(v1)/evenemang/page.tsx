import Link from 'next/link';
import type { Metadata } from 'next';
import { getCityDayCounts } from './cityData';
import CityLeaderboard from './CityLeaderboard';

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
    // Sorteras i klienten (CityLeaderboard) — default = flest event totalt.
    const cities = await getCityDayCounts();
    const total = cities.reduce((sum, c) => sum + c.total, 0);

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

                <CityLeaderboard cities={cities} />
            </div>
        </main>
    );
}
