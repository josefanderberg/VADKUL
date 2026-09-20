import Link from 'next/link';
import TopNavProfile from './TopNavProfile';

// Fast toppnav som delas av alla /evenemang-sidor (index, stad, kategori):
// KART-INGÅNGEN längst till vänster, profilknappen till höger — ligger kvar i
// toppen när listan scrollas. city-cta = samma glesa ljussvep som kartans
// hörn-pill (globals.css; kräver position + overflow-hidden).
//
// OMBYGGD 20/9 (ägarbeslut):
//  - Kart-länken flyttad från höger till VÄNSTER och är sidans huvudsakliga
//    väg vidare — inte en liten pill i hörnet.
//  - Den bär nu HELA landets eventsiffra ("Se alla 45 992 event på kartan")
//    och läses som en ingång/portal, inte som en knapp. Färgerna,
//    gradienten, guldkanten och ljussvepet är OFÖRÄNDRADE — det är formen
//    och texten som ändrats, inte det visuella språket.
//  - Tillbaka-länken är VALFRI. Stadssidan skickar ingen: "Evenemang i
//    Sverige" (listan med alla städer) togs bort — ingen vill dit.
//    Kategorisidan skickar fortfarande sin, för den går till stadssidan.
export default function TopNav({ backHref, backLabel, ctaLabel = 'Öppna kartan', ctaHref = '/', ctaCount }: {
    /** Utelämnad → ingen tillbaka-länk (stadssidan). */
    backHref?: string;
    backLabel?: string;
    ctaLabel?: string;
    /** Kart-länken — stadssidorna skickar ?plats=… så kartan öppnas inzoomad på staden. */
    ctaHref?: string;
    /** Kommande event i hela landet. Med siffra blir länken portaltexten
     *  "Se alla N event på kartan"; utan den används ctaLabel som förut. */
    ctaCount?: number;
}) {
    // z-40: ÖVER allt i sidflödet. Kart-herons dagchips/CTA (z-20) och listans
    // klistrade dagrubriker (z-20) låg förr på samma z-30 som naven och ritades
    // över den när man scrollat (Josef 2/9).
    return (
        <nav className="sticky top-0 z-40 bg-slate-50/90 dark:bg-zinc-950/90 backdrop-blur-md border-b border-slate-200/70 dark:border-zinc-800/70">
            <div className="max-w-2xl mx-auto px-5 py-3 flex items-center justify-between gap-3">
                {/* BARA TEXT (ägarbeslut 20/9): ingen bakgrund, ingen ram.
                    Knapp- och flikformerna prövades båda och avvisades —
                    "det räcker med texten". Det som bär den i stället är
                    .map-portal i globals.css: en gradient i VADKUL-paletten
                    klippt till bokstäverna som långsamt vandrar blått → guld
                    → blått. Lägg inte tillbaka bakgrund/ram.
                    Pilen står UTANFÖR gradienten: en halvt genomskinlig pil
                    hade sett trasig ut. Kartemojin är borttagen 20/9 —
                    texten säger redan "på kartan". */}
                <Link
                    href={ctaHref}
                    className="group inline-flex min-w-0 items-center gap-2 font-black text-sm hover:opacity-80 transition-opacity"
                >
                    {/* Pilen pekar UT ur sidan, åt vänster: kartan är det man
                        kommer tillbaka till, inte något man går vidare till. */}
                    <span
                        aria-hidden
                        className="shrink-0 text-[#006AA7] dark:text-sky-400 transition-transform group-hover:-translate-x-0.5"
                    >
                        ←
                    </span>
                    <span className="map-portal min-w-0 truncate">
                        {ctaCount !== undefined
                            ? `Se alla ${ctaCount.toLocaleString('sv-SE')} event på kartan`
                            : ctaLabel}
                    </span>
                </Link>
                <div className="flex items-center gap-2 shrink-0">
                    {backHref && backLabel && (
                        <Link
                            href={backHref}
                            className="hidden sm:inline-flex items-center gap-1.5 text-sm font-black text-[#006AA7] dark:text-sky-400 hover:text-[#005590] dark:hover:text-sky-300 transition-colors"
                        >
                            ← {backLabel}
                        </Link>
                    )}
                    <TopNavProfile />
                </div>
            </div>
        </nav>
    );
}
