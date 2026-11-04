/**
 * BOOST-STJÄRNAN ⭐ (Josef 4/11 2026, andra betalande kunden: "ha en stjärna
 * längst upp åt vänster på eventkortet och även i listan under ... så de
 * syns ännu längre"). Samma kvitto som kartbrickans ⭐-badge (v2MapBricka
 * drawStar): en liten guldrund platta med stjärnan, uppe till vänster på
 * eventkortet, på listraderna under kortet, i väljarlistan och i sök-/
 * sparat-raderna. Boostad = isFeaturedAt(featuredUntil) - passerad boost
 * visar ingen stjärna.
 *
 * `pill` = kortets variant med texten BOOSTAT (härkomst-raden, bredvid
 * "Skapat på VADKUL"); utan = bara den runda stjärnan (rader), `small` för
 * den som hänger på emoji-cirkeln i de kompakta raderna.
 */
export default function BoostStar({ pill = false, small = false, className = '', title = 'Boostat event' }: {
    pill?: boolean;
    small?: boolean;
    className?: string;
    title?: string;
}) {
    if (pill) {
        return (
            <span
                title={title}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#fbbf24] text-[#78350f] text-[10px] font-black uppercase tracking-wider shadow-sm whitespace-nowrap ${className}`}
            >
                <span aria-hidden className="text-[11px] leading-none">⭐</span>
                Boostat
            </span>
        );
    }
    return (
        <span
            role="img"
            aria-label={title}
            title={title}
            className={`inline-flex items-center justify-center rounded-full bg-[#fbbf24] ring-2 ring-white dark:ring-zinc-900 shadow leading-none ${
                small ? 'w-4 h-4 text-[9px]' : 'w-5 h-5 text-[11px]'
            } ${className}`}
        >
            ⭐
        </span>
    );
}
