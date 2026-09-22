'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';

// Det blå "arrangera själv"-blocket: vardagsexempel + exponeringstrappan
// (Syns bra/mer/mest) + Skapa-CTA + nu-fokus-raden. Används TVÅ gånger på
// stadssidan (Josef 4/9: "i Stockholm tar det aslång tid att scrolla ner —
// man borde kunna fälla ut den där uppe med"):
//   • Överst, HOPFÄLLD till en smal rad som fälls ut på klick — nyttan ska
//     synas även i storstäder utan att trycka undan eventlistan.
//   • Längst ner, alltid utfälld — slutet av listan är en inbjudan, inte en
//     återvändsgränd.
// Trappan ska SE ut som en stegring (dämpad → blå → guld) — plattare
// varianter dömdes ut ("ser knappt skillnad"). Ingen Patreon här (ägarbeslut).
//
// 22/9 (Josef: rutan "ser lite tråkig ut", "billig"): djup i stället för en
// platt blå list, alltså en ljus kant upptill, en mjuk blå skugga under och
// en liten trappa (dämpad, blå, guld) i stället för stjärnemojin. Under den
// översta rutan ligger SNABBÖNSKAN (blå, utan emoji): skriv vad du saknar och tryck Önska, så
// hamnar man på kartan i önska-läget med texten redan ifylld (?titel=).
// Önskningarna ligger annars längst ner, dit många aldrig scrollar.

/** Rutans djup: skugga under + ljus kant upptill (delas av båda lägena). */
const DEPTH = 'ring-1 ring-inset ring-white/15 shadow-[0_14px_32px_-14px_rgba(0,106,167,0.75),inset_0_1px_0_rgba(255,255,255,0.2)]';

/** Trappan i miniatyr: nivå 1-3 som tre stigande staplar. */
function StairMark() {
    return (
        <span aria-hidden className="shrink-0 w-10 h-10 rounded-xl bg-white/10 ring-1 ring-inset ring-white/15 flex items-end justify-center gap-[3px] pb-2.5">
            <span className="w-1.5 h-2 rounded-sm bg-white/35" />
            <span className="w-1.5 h-3.5 rounded-sm bg-sky-200" />
            <span className="w-1.5 h-5 rounded-sm bg-[#FECC02] shadow-[0_0_8px_rgba(254,204,2,0.7)]" />
        </span>
    );
}

/** Snabbönskan under den översta rutan: texten följer med till kartans
 *  önska-formulär. Minst 3 tecken, som reglernas titelkrav. */
function QuickWish({ cityName, wishHref }: { cityName: string; wishHref: string }) {
    const router = useRouter();
    const [title, setTitle] = useState('');
    const ok = title.trim().length >= 3;
    return (
        <form
            onSubmit={(ev) => {
                ev.preventDefault();
                if (!ok) return;
                router.push(`${wishHref}&titel=${encodeURIComponent(title.trim().slice(0, 120))}`);
            }}
            className="mt-2.5 flex items-center gap-2 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-1.5 pl-4 shadow-sm focus-within:border-[#006AA7]/50 dark:focus-within:border-sky-400/50 transition-colors"
        >
            <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder={`Vad saknas i ${cityName}? Önska ett event…`}
                aria-label={`Önska ett event i ${cityName}`}
                maxLength={120}
                enterKeyHint="send"
                className="flex-1 min-w-0 bg-transparent py-1.5 text-sm font-medium text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none"
            />
            <button
                type="submit"
                disabled={!ok}
                // Sidans blå (Josef 22/9: lila + ✨-emojin såg "lite girly"
                // ut). Stjärnorna är kvar som vit ikon, inte emojins färger.
                // Kartans önske-läge behåller sin lila.
                className="shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-[#006AA7] px-4 py-2 text-sm font-black text-white hover:bg-[#00598c] disabled:opacity-40 disabled:hover:bg-[#006AA7] transition-colors"
            >
                Önska
                <Sparkles size={15} strokeWidth={2.5} aria-hidden />
            </button>
        </form>
    );
}

interface Props {
    cityName: string;
    /** Kartlänk med &skapa=1 — platsval-först-flödet. */
    createHref: string;
    /** Utan rubrik-varianten "Slut på listan?" — kollapsad rad överst. */
    collapsible?: boolean;
    /** Kartlänk med &onska=1. Finns den (översta rutan) står snabbönskan under. */
    wishHref?: string;
}

export default function CityCreatePitch({ cityName, createHref, collapsible, wishHref }: Props) {
    const [open, setOpen] = useState(!collapsible);

    if (collapsible && !open) {
        return (
            <>
                <button
                    type="button"
                    onClick={() => setOpen(true)}
                    className={`mt-3 w-full flex items-center gap-3.5 rounded-2xl bg-gradient-to-br from-[#0a7cc2]/95 via-[#006AA7]/95 to-[#004B78]/95 backdrop-blur px-4 py-3.5 text-left ${DEPTH} hover:-translate-y-0.5 hover:brightness-110 transition-all`}
                >
                    <StairMark />
                    <span className="flex-1 min-w-0">
                        <span className="block text-sm font-black text-white">Så syns ditt event i {cityName}</span>
                        <span className="block text-xs font-medium text-sky-200 truncate">Skapa gratis och hamna överst. Boosta och syns mest.</span>
                    </span>
                    <span aria-hidden className="shrink-0 w-7 h-7 rounded-full bg-white/15 flex items-center justify-center text-white">
                        <ChevronDown size={15} />
                    </span>
                </button>
                {wishHref && <QuickWish cityName={cityName} wishHref={wishHref} />}
            </>
        );
    }

    return (
        <>
        <section className={`${collapsible ? 'mt-3' : 'mt-10'} rounded-3xl bg-gradient-to-br from-[#0a7cc2] via-[#006AA7] to-[#004B78] px-5 py-6 text-white ${DEPTH}`}>
            <div className="flex items-start justify-between gap-3">
                <h2 className="text-xl font-black tracking-tight">
                    {collapsible ? `Så syns ditt event i ${cityName}` : 'Slut på listan? Skapa det som saknas.'}
                </h2>
                {collapsible && (
                    <button
                        type="button"
                        onClick={() => setOpen(false)}
                        aria-label="Fäll ihop"
                        className="shrink-0 w-7 h-7 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center text-white transition-colors"
                    >
                        <ChevronUp size={15} aria-hidden />
                    </button>
                )}
            </div>
            <p className="mt-2 text-sm leading-relaxed text-sky-100 font-medium">
                {/* Exemplen ska vara riktiga event man ORDNAR för andra (Josef
                    22/9: ingen lägger upp "plugga ihop" eller en promenad).
                    Samma vinkel som spotlightens tomläge (7/9). */}
                Ett event på VADKUL behöver inte vara en stor konsert. Det kan vara en quizkväll
                på puben, en loppis, en prova-på-kurs, en spelturnering eller en klubbkväll. Det
                du skapar visas överst på den här sidan och lyfts på kartan.
            </p>
            {/* Trappan: nivåerna ska SE ut som en stegring — dämpad → blå med
                bricka → guld med glow, stigande höjd på desktop. Argumenten är
                kartans riktiga beteenden: VADKUL-event ligger alltid uppe som
                bricka, boost ger guldbricka med ⭐ hela veckan före eventet. */}
            {/* Stegringen får inte bero på hur texterna råkar radbrytas
                (nivå 2:s långa text gjorde rutan lika hög som 3:an — Josef
                4/9 + 6/9). Därför en RIKTIG trappa i varje riktning:
                  • desktop (tre kolumner, bottenjusterade): min-höjder
                    136/176/216 px — mer än texten någonsin tar i kolumnen —
                    så stegen syns oavsett radbrytning;
                  • mobil (staplade): stigande BREDD 82 % → 91 % → 100 %,
                    högerställda, så rutorna bildar en trappa uppåt;
                  • alla bredder: text, padding och rubrik växer per nivå. */}
            <div className="mt-4 grid gap-2 sm:grid-cols-3 sm:items-end">
                <div className="w-[82%] ml-auto sm:w-auto sm:ml-0 rounded-2xl bg-white/5 border border-white/10 px-3 py-2.5 sm:min-h-[136px]">
                    <p className="text-[10px] font-black uppercase tracking-wider text-sky-300/80">Nivå 1</p>
                    <p className="mt-0.5 text-sm font-black text-sky-100/90">Syns bra</p>
                    <p className="mt-1 text-[11px] font-medium leading-snug text-sky-200/70">Externa event — vi hittar dem åt dig inför varje morgon och visar dem som prickar på kartan.</p>
                </div>
                <div className="w-[91%] ml-auto sm:w-auto sm:ml-0 rounded-2xl bg-white/15 border border-sky-300/40 px-3.5 py-4 sm:min-h-[176px] shadow-lg">
                    <p className="text-[10px] font-black uppercase tracking-wider text-sky-200">Nivå 2 · Skapa gratis</p>
                    <p className="mt-0.5 text-base font-black text-white">📌 Syns mer</p>
                    <p className="mt-1 text-xs font-medium leading-snug text-sky-100">Skapat på VADKUL — egen eventbricka som ligger UPPE på kartan hela tiden, och överst på den här sidan.</p>
                </div>
                {/* Nivå 3: VIT ram, glöd och text (Josef 22/9, gult bytt mot
                    vitt; den gula bakgrunden blev dessutom grönaktig mot det
                    blå). Bara stjärnan är kvar i guld. */}
                <div className="w-full rounded-2xl bg-white/20 border-2 border-white px-4 py-5 sm:min-h-[216px] shadow-[0_14px_34px_-12px_rgba(255,255,255,0.45)]">
                    {/* Priset MED i trappan (tidigare stod nivån utan pris —
                        den som inte vet vad det kostar klickar inte). Beloppet
                        speglar BOOST_TIERS i services/boostService: ändras
                        priset i Stripe måste siffran här följa med. */}
                    <p className="text-[11px] font-black uppercase tracking-wider text-white/85">Nivå 3 · Boost · 99 kr/vecka</p>
                    <p className="mt-1 text-xl font-black text-white">⭐ Syns mest</p>
                    <p className="mt-2 text-sm font-medium leading-snug text-sky-50">Guldbricka med stjärna som lyser på kartan varje dag fram till eventet, oavsett vilken dag man tittar på, och första plats här. 99 kr per vecka, direkt på eventet.</p>
                </div>
            </div>
            {/* Huvudknappen (Josef 22/9, vald bland fyra varianter): mörkblå
                med vit text och gul pil. INTE gul: guldet hör till boost-
                nivån ("Syns mest") precis ovanför. Pilen glider fram vid
                hovring. Vänsterställd och bara så bred som texten, även på
                mobil (full bredd prövades och backades 22/9). */}
            <Link
                href={createHref}
                className="group mt-5 inline-flex items-center gap-2 rounded-full bg-[#052846] px-6 py-3 text-sm font-black text-white ring-1 ring-inset ring-white/15 shadow-lg shadow-black/30 hover:bg-[#083558] transition-colors"
            >
                Skapa ett event i {cityName}
                <ArrowRight size={17} strokeWidth={3} aria-hidden className="text-[#FECC02] transition-transform group-hover:translate-x-0.5" />
            </Link>
            <p className="mt-3 text-[11px] font-medium text-sky-200/90">
                VADKUL fokuserar på det som händer nu — idag först, sedan veckan. Event längre
                fram fylls på när de närmar sig.
            </p>
        </section>
        {collapsible && wishHref && <QuickWish cityName={cityName} wishHref={wishHref} />}
        </>
    );
}
