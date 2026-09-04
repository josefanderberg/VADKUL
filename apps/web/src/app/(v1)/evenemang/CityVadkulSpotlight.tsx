'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import {
    composeSpotlightRows, spotDistKm, spotWhen, type SpotEvent, type SpotRow,
} from '@/utils/citySpotlight';

// Exponeringstrappans nivå 2–3 överst på stadssidan: boostade event (guld,
// syns mest) och VADKUL-skapade event (syns mer), ovanför den externa
// dag-för-dag-listan (syns bra). Sidan är statisk, men de här eventen bor i
// Firestore (linkEvents userCreated / eventBoosts) — därför en klient-
// komponent med två små filtrerade frågor, samma som kartan redan gör.
// Finns inget att visa blir sektionen en SMAL inbjudan (aldrig en stor tom
// hylla) — budskapet "ditt event överst här" ska kännas som en möjlighet,
// inte som tomhet. Ägarbeslut 4/9: ingen Patreon/donationsrad här.

interface Props {
    cityName: string;
    cityLat: number;
    cityLng: number;
    radiusKm: number;
    /** Sidans externa event, trimmade (id/titel/tid/emoji/plats) — bara för
     *  boost-matchning; renderas aldrig i sin helhet här. */
    staticEvents: SpotEvent[];
    /** Kartlänk med &skapa=1 — öppnar skapa-flödet direkt över staden. */
    createHref: string;
}

async function fetchCityRows(p: Props): Promise<{ boosted: SpotRow[]; vadkul: SpotRow[] }> {
    if (!db) return { boosted: [], vadkul: [] };
    const [boostSnap, userSnap] = await Promise.all([
        getDocs(query(collection(db, 'eventBoosts'), where('featuredUntil', '>', Timestamp.now()))),
        getDocs(query(collection(db, 'linkEvents'), where('userCreated', '==', true))),
    ]);
    const boostedIds = new Set<string>();
    for (const d of boostSnap.docs) {
        const id = (d.data() as { eventId?: unknown }).eventId;
        if (typeof id === 'string' && id) boostedIds.add(id);
    }
    const userCreated: SpotEvent[] = [];
    for (const d of userSnap.docs) {
        const v = d.data() as Record<string, unknown>;
        if (v.hidden === true) continue;
        const time = v.time instanceof Timestamp ? v.time.toDate() : new Date(String(v.time ?? ''));
        const lat = Number(v.lat), lng = Number(v.lng);
        if (isNaN(time.getTime()) || !lat || !lng) continue;
        if (spotDistKm(lat, lng, p.cityLat, p.cityLng) > p.radiusKm) continue;
        userCreated.push({
            id: d.id,
            title: String(v.title ?? ''),
            time: time.toISOString(),
            emoji: typeof v.emoji === 'string' ? v.emoji : undefined,
            locationName: typeof v.locationName === 'string' ? v.locationName : undefined,
        });
        // Ett boostat VADKUL-event kan vara boostat på doc-id:t.
        const fu = v.featuredUntil instanceof Timestamp ? v.featuredUntil.toDate() : null;
        if (fu && fu.getTime() > Date.now()) boostedIds.add(d.id);
    }
    return composeSpotlightRows(userCreated, p.staticEvents, boostedIds);
}

function Row({ e, gold }: { e: SpotRow; gold: boolean }) {
    return (
        <Link
            href={`/?event=${encodeURIComponent(e.id)}`}
            className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 border transition-colors ${
                gold
                    ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-300/70 dark:border-amber-500/40 hover:border-amber-400'
                    : 'bg-white dark:bg-zinc-900 border-sky-200 dark:border-sky-500/30 hover:border-[#006AA7]/50'
            }`}
        >
            <span aria-hidden className={`w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-lg ${gold ? 'bg-amber-100 dark:bg-amber-900/40' : 'bg-sky-50 dark:bg-sky-950/40'}`}>
                {e.emoji || '🎉'}
            </span>
            <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-slate-900 dark:text-zinc-100">
                    {gold && <span aria-hidden className="mr-1">⭐</span>}{e.title}
                </span>
                <span className="block truncate text-xs font-medium text-slate-500 dark:text-zinc-400">
                    {spotWhen(e.time)}{e.locationName ? ` · ${e.locationName}` : ''}
                </span>
            </span>
        </Link>
    );
}

export default function CityVadkulSpotlight(props: Props) {
    const [rows, setRows] = useState<{ boosted: SpotRow[]; vadkul: SpotRow[] } | null>(null);
    useEffect(() => {
        let active = true;
        fetchCityRows(props)
            .then(r => { if (active) setRows(r); })
            // Sektionen är ren bonus ovanpå den statiska sidan — ett hämtfel
            // ger inbjudningsbannern, aldrig ett brutet sidhuvud.
            .catch(() => { if (active) setRows({ boosted: [], vadkul: [] }); });
        return () => { active = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Innan svaret landat: rendera ingenting (sidan är läsbar ändå, och en
    // skeleton här skulle knuffa listan för de flesta städer som saknar rader).
    if (!rows) return null;

    const { boosted, vadkul } = rows;
    if (boosted.length === 0 && vadkul.length === 0) {
        return (
            <div className="mt-4 flex items-center gap-3 rounded-2xl border border-dashed border-[#006AA7]/40 dark:border-sky-400/40 bg-sky-50/60 dark:bg-sky-950/20 px-4 py-3">
                <span aria-hidden className="text-xl">🎈</span>
                <p className="flex-1 text-xs leading-snug font-medium text-slate-600 dark:text-zinc-400">
                    <strong className="text-slate-900 dark:text-zinc-100">Ditt event överst här.</strong>{' '}
                    Spelkväll, middag, vinprovning — event skapade på VADKUL visas först på den här sidan.
                </p>
                <Link href={props.createHref} className="shrink-0 rounded-full bg-[#006AA7] px-3.5 py-2 text-xs font-black text-white hover:bg-[#00598c] transition-colors">
                    Skapa event
                </Link>
            </div>
        );
    }

    return (
        <section className="mt-4">
            <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-xs font-black tracking-widest text-[#006AA7] dark:text-sky-400 uppercase">
                    Skapade på VADKUL
                </h2>
                <Link href={props.createHref} className="text-xs font-bold text-[#006AA7] dark:text-sky-400 hover:underline">
                    Skapa ditt →
                </Link>
            </div>
            <div className="mt-2 flex flex-col gap-2">
                {boosted.map(e => <Row key={e.id} e={e} gold />)}
                {vadkul.map(e => <Row key={e.id} e={e} gold={false} />)}
            </div>
            <p className="mt-1.5 text-[11px] font-medium text-slate-400 dark:text-zinc-500">
                Event skapade på VADKUL visas överst här — ⭐ boostade syns allra mest, även på kartan.
            </p>
        </section>
    );
}
