'use client';

import { useState } from 'react';
import Link from 'next/link';

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

interface Props {
    cityName: string;
    /** Kartlänk med &skapa=1 — platsval-först-flödet. */
    createHref: string;
    /** Utan rubrik-varianten "Slut på listan?" — kollapsad rad överst. */
    collapsible?: boolean;
}

export default function CityCreatePitch({ cityName, createHref, collapsible }: Props) {
    const [open, setOpen] = useState(!collapsible);

    if (collapsible && !open) {
        return (
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="mt-3 w-full flex items-center gap-3 rounded-2xl bg-gradient-to-r from-[#006AA7] to-[#004B78] px-4 py-3 text-left shadow-sm hover:shadow-md transition-shadow"
            >
                <span aria-hidden className="text-lg">⭐</span>
                <span className="flex-1 min-w-0">
                    <span className="block text-sm font-black text-white">Så syns ditt event i {cityName}</span>
                    <span className="block text-xs font-medium text-sky-200 truncate">Skapa gratis och hamna överst — boosta och syns mest.</span>
                </span>
                <span aria-hidden className="shrink-0 w-6 h-6 rounded-full bg-white/15 flex items-center justify-center text-white text-xs">▾</span>
            </button>
        );
    }

    return (
        <section className={`${collapsible ? 'mt-3' : 'mt-10'} rounded-3xl bg-gradient-to-br from-[#006AA7] to-[#004B78] px-5 py-6 text-white`}>
            <div className="flex items-start justify-between gap-3">
                <h2 className="text-xl font-black tracking-tight">
                    {collapsible ? `Så syns ditt event i ${cityName}` : 'Slut på listan? Skapa det som saknas.'}
                </h2>
                {collapsible && (
                    <button
                        type="button"
                        onClick={() => setOpen(false)}
                        aria-label="Fäll ihop"
                        className="shrink-0 w-7 h-7 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center text-white text-xs transition-colors"
                    >
                        ▴
                    </button>
                )}
            </div>
            <p className="mt-2 text-sm leading-relaxed text-sky-100 font-medium">
                Ett event på VADKUL behöver inte vara en konsert — bjud hem folk på sällskapsspel,
                laga mat ihop, ordna vinprovning, plugga eller gå en runda. Det du skapar visas
                överst på den här sidan och lyfts på kartan.
            </p>
            {/* Trappan: nivåerna ska SE ut som en stegring — dämpad → blå med
                bricka → guld med glow, stigande höjd på desktop. Argumenten är
                kartans riktiga beteenden: VADKUL-event ligger alltid uppe som
                bricka, boost ger guldbricka med ⭐ hela veckan före eventet. */}
            {/* Stegringen får inte bero på hur texterna råkar radbrytas
                (nivå 3:s korta text gjorde rutan LÄGRE än 2:an — Josef 4/9):
                min-höjderna 88/108/132 px garanterar 1 < 2 < 3 på alla
                bredder, och nivå 3 har dessutom störst rubrik och padding. */}
            <div className="mt-4 grid gap-2 sm:grid-cols-3 sm:items-end">
                <div className="rounded-2xl bg-white/5 border border-white/10 px-3.5 py-3 min-h-[88px]">
                    <p className="text-[10px] font-black uppercase tracking-wider text-sky-300/80">Nivå 1</p>
                    <p className="mt-0.5 text-sm font-black text-sky-100/90">Syns bra</p>
                    <p className="mt-1 text-xs font-medium leading-snug text-sky-200/70">Externa event — vi hittar dem åt dig inför varje morgon och visar dem som prickar på kartan.</p>
                </div>
                <div className="rounded-2xl bg-white/15 border border-sky-300/40 px-3.5 py-4 min-h-[108px] shadow-lg">
                    <p className="text-[10px] font-black uppercase tracking-wider text-sky-200">Nivå 2 · Skapa gratis</p>
                    <p className="mt-0.5 text-sm font-black text-white">📌 Syns mer</p>
                    <p className="mt-1 text-xs font-medium leading-snug text-sky-100">Skapat på VADKUL — egen eventbricka som ligger UPPE på kartan hela tiden, och överst på den här sidan.</p>
                </div>
                <div className="rounded-2xl bg-gradient-to-br from-[#FECC02]/25 to-[#FECC02]/10 border-2 border-[#FECC02] px-4 py-5 min-h-[132px] shadow-xl shadow-[#FECC02]/20">
                    <p className="text-[10px] font-black uppercase tracking-wider text-[#FECC02]">Nivå 3 · Boost</p>
                    <p className="mt-0.5 text-base font-black text-[#FECC02]">⭐ Syns mest</p>
                    <p className="mt-1.5 text-xs font-medium leading-snug text-sky-50">Guldbricka med stjärna som lyser på kartan en hel vecka före eventet — och första plats här.</p>
                </div>
            </div>
            <Link
                href={createHref}
                className="mt-4 inline-block rounded-full bg-[#FECC02] px-5 py-2.5 text-sm font-black text-[#052846] hover:brightness-105 transition"
            >
                Skapa ett event i {cityName}
            </Link>
            <p className="mt-3 text-[11px] font-medium text-sky-200/90">
                VADKUL fokuserar på det som händer nu — idag först, sedan veckan. Event längre
                fram fylls på när de närmar sig.
            </p>
        </section>
    );
}
