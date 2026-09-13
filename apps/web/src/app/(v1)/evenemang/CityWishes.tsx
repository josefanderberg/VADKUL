'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { wishService, WISH_LIFETIME_DAYS } from '@/services/wishService';
import { wishesNearCity, wishAgeLabel } from '@/utils/cityWishes';
import { EVENT_CATEGORIES } from '@/utils/categories';
import type { EventWish } from '@/types';

// Önskningarna som stadssidans AVSLUT (Josef 14/9: "ingen vill byta till en
// annan stad — bättre att ha önskningar där"): den som scrollat till slutet
// ska mötas av synlig efterfrågan ("det här vill folk att någon ordnar") med
// skapa-vägen bredvid — den starkaste skapa-triggern som finns är att någon
// redan bett om eventet.
//
// Klientkomponent UTANFÖR server-HTML:n och siffrorna (samma SEO-beslut som
// opt-in-källorna 1/9): önskningarna lever 14 dagar och är inget crawlfoder.
// Hämtningen är samma eventWishes-läsning som kartans poll, fast EN gång per
// sidvisning — collectionen är liten och reads är billiga.

interface Props {
    cityName: string;
    cityLat: number;
    cityLng: number;
    /** Samma radie som stadens spotlight (small 20 / annars 35 km). */
    radiusKm: number;
    /** Kartlänk med &skapa=1 — platsval-först-flödet. */
    createHref: string;
    /** Ren kartlänk över staden — där önskar man (kräver konto, sker på kartan). */
    mapHref: string;
}

export default function CityWishes({ cityName, cityLat, cityLng, radiusKm, createHref, mapHref }: Props) {
    // null = hämtar fortfarande → rendera ingenting (sektionen dyker upp när
    // svaret finns; inget hoppigt skelett för en sektion långt ner på sidan).
    const [wishes, setWishes] = useState<EventWish[] | null>(null);

    useEffect(() => {
        let stale = false;
        wishService.fetchActiveWishes()
            .then(all => { if (!stale) setWishes(wishesNearCity(all, { lat: cityLat, lng: cityLng }, radiusKm)); })
            .catch(() => { if (!stale) setWishes([]); });
        return () => { stale = true; };
    }, [cityLat, cityLng, radiusKm]);

    if (wishes === null) return null;

    const now = new Date();

    return (
        <section className="mt-10 rounded-3xl border-2 border-dashed border-[#006AA7]/30 dark:border-sky-400/25 bg-sky-50/50 dark:bg-sky-950/20 px-5 py-6">
            <h2 className="text-xl font-black tracking-tight text-slate-900 dark:text-zinc-100">
                ✨ Önskas i {cityName}
            </h2>
            {wishes.length === 0 ? (
                <>
                    <p className="mt-2 text-sm font-medium leading-relaxed text-slate-600 dark:text-zinc-400">
                        Inga önskningar just nu. Saknar du något i {cityName} — en quizkväll, en loppis,
                        en löprunda? Önska det på kartan, så syns det som en egen bricka för alla i {WISH_LIFETIME_DAYS} dagar.
                        Kanske är det någon annan som ordnar det.
                    </p>
                    <Link
                        href={mapHref}
                        className="mt-4 inline-block rounded-full bg-[#006AA7] hover:bg-[#005590] px-5 py-2.5 text-sm font-black text-white transition-colors"
                    >
                        Önska ett event på kartan ✨
                    </Link>
                </>
            ) : (
                <>
                    <p className="mt-2 text-sm font-medium leading-relaxed text-slate-600 dark:text-zinc-400">
                        Det här vill folk i {cityName} att någon ordnar. Är det du? Skapa eventet —
                        gratis, och det hamnar överst på den här sidan.
                    </p>
                    <ul className="mt-4 flex flex-col gap-2">
                        {wishes.map(w => (
                            <li
                                key={w.id}
                                className="flex items-start gap-3 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 px-4 py-3"
                            >
                                <span aria-hidden className="text-xl leading-none mt-0.5">
                                    {EVENT_CATEGORIES[w.category]?.emoji ?? '✨'}
                                </span>
                                <span className="flex-1 min-w-0">
                                    <span className="block text-sm font-black text-slate-900 dark:text-zinc-100">
                                        {w.title}
                                    </span>
                                    {w.description && (
                                        <span className="block text-xs font-medium text-slate-500 dark:text-zinc-400 truncate">
                                            {w.description}
                                        </span>
                                    )}
                                    <span className="block mt-0.5 text-[11px] font-semibold text-slate-400 dark:text-zinc-500">
                                        Önskades {wishAgeLabel(w.createdAt, now)}
                                    </span>
                                </span>
                                <Link
                                    href={createHref}
                                    className="shrink-0 self-center rounded-full bg-[#FECC02] hover:brightness-105 px-3.5 py-1.5 text-xs font-black text-[#052846] transition"
                                >
                                    Skapa det här
                                </Link>
                            </li>
                        ))}
                    </ul>
                    <p className="mt-3 text-[11px] font-medium text-slate-500 dark:text-zinc-500">
                        Saknar du något annat? <Link href={mapHref} className="underline text-[#006AA7] dark:text-sky-400">Önska det på kartan</Link> — syns för alla i {WISH_LIFETIME_DAYS} dagar.
                    </p>
                </>
            )}
        </section>
    );
}
