import Link from 'next/link';

// Fast toppnav som delas av alla /evenemang-sidor (index, stad, kategori):
// tillbaka-länken till vänster, kart-pillen till höger — ligger kvar i toppen
// när listan scrollas. city-cta = samma glesa ljussvep som kartans hörn-pill
// (globals.css; kräver position + overflow-hidden).
export default function TopNav({ backHref, backLabel, ctaLabel = 'Öppna kartan', ctaHref = '/' }: {
    backHref: string;
    backLabel: string;
    ctaLabel?: string;
    /** Kart-länken — stadssidorna skickar ?plats=… så kartan öppnas inzoomad på staden. */
    ctaHref?: string;
}) {
    return (
        <nav className="sticky top-0 z-30 bg-slate-50/90 backdrop-blur-md border-b border-slate-200/70">
            <div className="max-w-2xl mx-auto px-5 py-3 flex items-center justify-between gap-3">
                <Link
                    href={backHref}
                    className="inline-flex items-center gap-1.5 text-sm font-black text-[#006AA7] hover:text-[#005590] transition-colors"
                >
                    ← {backLabel}
                </Link>
                <Link
                    href={ctaHref}
                    className="city-cta gold-glow-pulse relative overflow-hidden inline-flex items-center justify-center px-4 py-2 rounded-full bg-gradient-to-r from-[#006AA7] to-[#004B78] border-2 border-[#FECC02] text-white font-black text-xs shadow-md hover:scale-105 transition-all shrink-0"
                >
                    {ctaLabel}
                </Link>
            </div>
        </nav>
    );
}
