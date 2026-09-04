'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Heart } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import {
    composeSpotlightRows, spotDistKm, spotWhen, type SpotEvent, type SpotRow,
} from '@/utils/citySpotlight';
import { writeEventSeed } from '@/utils/eventSeed';
import { isPlainClick } from '@/utils/eventExpand';
import { categoryLabel } from '@/components/v2/v2MapLabel';
import { emojiForCategory } from '@/utils/categories';
import EventExpanded from './EventExpanded';

// Lazy som i listan: inloggningsmodalen laddas först när ett hjärta trycks.
const AuthModal = dynamic(() => import('@/components/v2/AuthModal'), { ssr: false });
// Samma nyckel som kartan/listan — hjärtan här hamnar i kartans Sparat-panel.
const SAVED_KEY = 'vadkul_saved_events';

// Exponeringstrappans nivå 2–3 överst på stadssidan: boostade event (guld,
// syns mest) och VADKUL-skapade event (syns mer), ovanför den externa
// dag-för-dag-listan (syns bra). Sidan är statisk, men de här eventen bor i
// Firestore (linkEvents userCreated / eventBoosts) — därför en klient-
// komponent med två små filtrerade frågor, samma som kartan redan gör.
// Raderna beter sig som LISTANS rader (Josef 4/9: "vi ska kunna öppna upp de
// som de andra, samma info"): ett vanligt klick fäller ut eventet PÅ PLATS
// (EventExpanded — beskrivning, Anmäl/Boka, Karta, Dela; /api/event fyller
// luckorna, userCreated-fallbacken sedan 4/9), cmd/ctrl-klick öppnar kartan.
// Finns inget att visa blir sektionen en SMAL inbjudan (aldrig en stor tom
// hylla). Ägarbeslut 4/9: ingen Patreon/donationsrad här.

interface Props {
    cityName: string;
    cityLat: number;
    cityLng: number;
    radiusKm: number;
    /** Sidans externa event, trimmade — för boost-matchning och radvisning;
     *  description m.m. fylls av /api/event vid utfällning. */
    staticEvents: SpotEvent[];
    /** Kartlänk med &skapa=1 — öppnar platsval-först-flödet över staden. */
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
            lat, lng,
            category: typeof v.category === 'string' ? v.category : 'other',
            hostName: typeof v.hostName === 'string' ? v.hostName : undefined,
            coverImage: typeof v.coverImage === 'string' && v.coverImage ? v.coverImage : undefined,
            price: typeof v.price === 'string' ? v.price : undefined,
            description: typeof v.description === 'string' ? v.description : undefined,
            attendees: typeof v.attendees === 'number' ? v.attendees : 0,
            isTip: v.isTip === true,
        });
        // Ett boostat VADKUL-event kan vara boostat på doc-id:t.
        const fu = v.featuredUntil instanceof Timestamp ? v.featuredUntil.toDate() : null;
        if (fu && fu.getTime() > Date.now()) boostedIds.add(d.id);
    }
    return composeSpotlightRows(userCreated, p.staticEvents, boostedIds);
}

/** Radens emoji: sparad emoji om den finns, annars kategorins (som kartan) —
 *  aldrig 🎉-fallback (Josef 4/9: sport/familj-event visades som fest). */
function spotEmoji(e: SpotRow): string {
    return e.emoji || emojiForCategory(e.category);
}

const DAY_LABEL_FMT = new Intl.DateTimeFormat('sv-SE', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Stockholm' });
const CLOCK_FMT = new Intl.DateTimeFormat('sv-SE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Stockholm' });
const HOUR_FMT = new Intl.DateTimeFormat('sv-SE', { hour: 'numeric', hour12: false, timeZone: 'Europe/Stockholm' });

/** Radens data i EventExpandeds format (ListedEvent utan dups) — luckor
 *  (beskrivning, utlänk) fylls av /api/event inne i utfällningen. */
function toExpanded(e: SpotRow) {
    const t = new Date(e.time);
    const clock = CLOCK_FMT.format(t) === '00:00' ? null : CLOCK_FMT.format(t);
    const place = e.locationName ?? '';
    return {
        id: e.id,
        href: `/?event=${encodeURIComponent(e.id)}`,
        emoji: spotEmoji(e),
        title: e.title,
        meta: [clock ? `kl ${clock}` : null, place || null, e.hostName ?? null].filter(Boolean).join(' · '),
        coverImage: e.coverImage,
        place,
        clock,
        price: e.price ?? null,
        attendees: e.attendees ?? 0,
        hour: clock ? parseInt(HOUR_FMT.format(t), 10) : null,
        t: t.getTime(),
        lat: e.lat ?? 0,
        lng: e.lng ?? 0,
        category: e.category ?? 'other',
        hostName: e.hostName ?? null,
        description: e.description ?? null,
    };
}

/** Kart-överlämningen (samma som listradernas seedMapHandoff). */
function seedMap(e: SpotRow): void {
    writeEventSeed({
        id: e.id,
        title: e.title,
        t: new Date(e.time).getTime(),
        hasSpecificTime: CLOCK_FMT.format(new Date(e.time)) !== '00:00',
        lat: e.lat ?? 0,
        lng: e.lng ?? 0,
        locationName: e.locationName ?? '',
        category: e.category ?? 'other',
        emoji: spotEmoji(e),
        hostName: e.hostName,
        coverImage: e.coverImage,
        price: e.price,
        attendees: e.attendees ?? 0,
        description: e.description,
    });
}

function Row({ e, gold, expanded, onToggle, isSaved, onToggleSave }: {
    e: SpotRow; gold: boolean; expanded: boolean; onToggle: () => void;
    isSaved: boolean; onToggleSave: (id: string) => void;
}) {
    // Bildvakt som listradernas: trasig bild → kompakta emoji-raden.
    const [imgFailed, setImgFailed] = useState(false);
    const hasImage = !!e.coverImage && !imgFailed;

    // Skapat/Tipsat: uppe till VÄNSTER på bildkortet (Josef 4/9), i höger-
    // kolumnen på den kompakta raden.
    const badge = e.vadkul && (
        <span className={`shrink-0 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
            hasImage
                ? `bg-white/90 dark:bg-zinc-900/90 backdrop-blur shadow ${gold ? 'text-amber-600 dark:text-amber-400' : 'text-sky-700 dark:text-sky-300'}`
                : gold
                    ? 'bg-amber-200/70 text-amber-900 dark:bg-amber-500/20 dark:text-amber-300'
                    : 'bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300'
        }`}>
            {e.isTip ? 'Tipsat' : 'Skapat'}
        </span>
    );
    // Spara-hjärtat: samma knapp och regler som listans rader.
    const heartOverlay = (
        <button
            type="button"
            onClick={() => onToggleSave(e.id)}
            aria-pressed={isSaved}
            aria-label={isSaved ? 'Ta bort från sparade' : 'Spara eventet'}
            title={isSaved ? 'Sparat — finns under Sparade i din profil' : 'Spara eventet'}
            className={`absolute top-2 right-2 z-10 flex items-center justify-center w-8 h-8 rounded-full bg-white/90 dark:bg-zinc-900/90 backdrop-blur shadow transition-colors ${
                isSaved ? 'text-rose-500' : 'text-slate-400 dark:text-zinc-500 hover:text-rose-400'
            }`}
        >
            <Heart size={16} fill={isSaved ? 'currentColor' : 'none'} />
        </button>
    );
    const catChip = e.category && (
        <span className={`shrink-0 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
            hasImage ? 'bg-white/25 backdrop-blur-sm text-white' : 'bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400'
        }`}>
            {categoryLabel(e.category)}
        </span>
    );
    const onClick = (ev: React.MouseEvent) => {
        if (!isPlainClick(ev)) { seedMap(e); return; }
        ev.preventDefault();
        onToggle();
    };

    return (
        <div className={`relative rounded-2xl border overflow-hidden transition-colors ${
            gold
                ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-300/70 dark:border-amber-500/40'
                : 'bg-white dark:bg-zinc-900 border-sky-200 dark:border-sky-500/30'
        }`}>
            {/* <a href=/?event=> står kvar för crawl + cmd/ctrl-klick (kartan i
                ny flik) — vanligt klick fäller ut på plats, som listraderna. */}
            {hasImage ? (
                // Bildkort som listans rader (Josef 4/9: "bilden kommer ju inte
                // med"): omslagsbild kant till kant, titel + kategori på mörk
                // gradient, Skapat/Tipsat uppe till vänster, hjärtat uppe till
                // höger (utanför länken). Bilden växer utfälld — UTAN
                // animation, EventExpanded mäter sin höjd synkront.
                <>
                    <a href={`/?event=${encodeURIComponent(e.id)}`} onClick={onClick} className="block">
                        <div className="relative">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={e.coverImage}
                                alt=""
                                loading="lazy"
                                onError={() => setImgFailed(true)}
                                className={`w-full object-cover ${expanded ? 'h-52' : 'h-28'}`}
                            />
                            {badge && <span className="absolute top-2 left-2 z-10 flex">{badge}</span>}
                            <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 px-4 pb-2 pt-8 bg-gradient-to-t from-black/75 via-black/35 to-transparent">
                                <span className="text-lg leading-none shrink-0 drop-shadow" aria-hidden>{gold ? '⭐' : spotEmoji(e)}</span>
                                <h4 className="flex-1 min-w-0 font-black text-sm text-white truncate [text-shadow:0_1px_2px_rgba(0,0,0,0.8)]">{e.title}</h4>
                                {catChip}
                            </div>
                        </div>
                        {!expanded && (
                            <div className="px-4 py-2 text-xs font-bold text-slate-500 dark:text-zinc-400 truncate">
                                {spotWhen(e.time)}{e.locationName ? ` · ${e.locationName}` : ''}
                            </div>
                        )}
                    </a>
                    {heartOverlay}
                </>
            ) : (
                <div className="flex items-stretch">
                    <a href={`/?event=${encodeURIComponent(e.id)}`} onClick={onClick} className="flex flex-1 min-w-0 items-center gap-3 px-3 py-2.5">
                        <span aria-hidden className={`w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-lg ${gold ? 'bg-amber-100 dark:bg-amber-900/40' : 'bg-sky-50 dark:bg-sky-950/40'}`}>
                            {spotEmoji(e)}
                        </span>
                        <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-bold text-slate-900 dark:text-zinc-100">
                                {gold && <span aria-hidden className="mr-1">⭐</span>}{e.title}
                            </span>
                            <span className="block truncate text-xs font-medium text-slate-500 dark:text-zinc-400">
                                {spotWhen(e.time)}{e.locationName ? ` · ${e.locationName}` : ''}
                            </span>
                        </span>
                        <span className="shrink-0 flex flex-col items-end gap-1">
                            {badge}
                            {catChip}
                        </span>
                    </a>
                    {/* Hjärtat i radens högerkant — samma som listans bildlösa rader. */}
                    <button
                        type="button"
                        onClick={() => onToggleSave(e.id)}
                        aria-pressed={isSaved}
                        aria-label={isSaved ? 'Ta bort från sparade' : 'Spara eventet'}
                        title={isSaved ? 'Sparat — finns under Sparade i din profil' : 'Spara eventet'}
                        className={`shrink-0 flex items-center px-3 rounded-r-2xl transition-colors ${
                            isSaved ? 'text-rose-500' : 'text-slate-300 dark:text-zinc-600 hover:text-rose-400'
                        }`}
                    >
                        <Heart size={17} fill={isSaved ? 'currentColor' : 'none'} />
                    </button>
                </div>
            )}
            {expanded && (
                <EventExpanded
                    e={toExpanded(e)}
                    dayLabel={DAY_LABEL_FMT.format(new Date(e.time))}
                    onClose={onToggle}
                    onMapClick={() => seedMap(e)}
                />
            )}
        </div>
    );
}

export default function CityVadkulSpotlight(props: Props) {
    const [rows, setRows] = useState<{ boosted: SpotRow[]; vadkul: SpotRow[] } | null>(null);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    // Spara-hjärtan: samma nyckel och regler som listan (gilla kräver konto,
    // redan sparade får plockas bort utan).
    const { user } = useAuth();
    const [saved, setSaved] = useState<Set<string>>(new Set());
    const [authOpen, setAuthOpen] = useState(false);
    useEffect(() => {
        try {
            setSaved(new Set(JSON.parse(localStorage.getItem(SAVED_KEY) ?? '[]') as string[]));
        } catch { /* trasig post — börja med tom lista */ }
    }, []);
    const toggleSave = (id: string) => {
        if (!user && !saved.has(id)) { setAuthOpen(true); return; }
        setSaved(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            try { localStorage.setItem(SAVED_KEY, JSON.stringify([...next])); } catch { /* privat läge */ }
            return next;
        });
    };
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

    const toggle = (id: string) => setExpandedId(prev => (prev === id ? null : id));
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
                {boosted.map(e => <Row key={e.id} e={e} gold expanded={expandedId === e.id} onToggle={() => toggle(e.id)} isSaved={saved.has(e.id)} onToggleSave={toggleSave} />)}
                {vadkul.map(e => <Row key={e.id} e={e} gold={false} expanded={expandedId === e.id} onToggle={() => toggle(e.id)} isSaved={saved.has(e.id)} onToggleSave={toggleSave} />)}
            </div>
            <p className="mt-1.5 text-[11px] font-medium text-slate-400 dark:text-zinc-500">
                Event skapade på VADKUL visas överst här — ⭐ boostade syns allra mest, även på kartan.
            </p>
            {authOpen && (
                <AuthModal
                    open
                    reason="Logga in för att gilla event"
                    onClose={() => setAuthOpen(false)}
                />
            )}
        </section>
    );
}
