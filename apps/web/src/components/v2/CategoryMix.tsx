'use client';

import { useMemo } from 'react';
import { LinkEvent } from '@/types';
import { EVENT_CATEGORIES } from '@/utils/categories';
import { eventEmoji } from './v2MapBricka';

interface CategoryMixProps {
    /** Eventen raden sammanfattar. Ska vara PRECIS de som ligger på kartan —
     *  filtrera med sidans `matchesFilter` innan, annars räknas dolda
     *  opt-in-källor (Svenska kyrkan/PRO) med (Josef 9/8). */
    events: LinkEvent[];
    /** 'dark' = pillarna bär samma mörka platta som bildspelets stadsruta; de
     *  ligger UNDER rutan, direkt mot kartan, och behöver egen botten. */
    tone?: 'light' | 'dark';
    /** False medan eventen fortfarande laddar → rendera inget alls (hellre
     *  tomt än en halv sanning som växer medan man tittar). */
    ready?: boolean;
    /** Framklickad emoji (null = ingen). Styrs av sidan, inte av komponenten:
     *  samma värde skickas vidare till kartan, som tonar ned allt annat. */
    picked?: string | null;
    /** Klick på en pill. Samma emoji igen = avmarkera (sidan får null). */
    onPick?: (emoji: string | null) => void;
}

/**
 * Sammanfattningsraden under bildspelets stadsruta: VILKA event som ligger på
 * kartan just nu, och hur många av varje sort.
 *
 * Grupperas på `eventEmoji` — SAMMA emoji som brickan på kartan bär (eventets
 * egen LLM-valda emoji, med kategorins som fallback). Att i stället gruppera på
 * kategori och visa kategorins emoji såg ut som ett fel: kartan visade 🚜 och
 * 🏰 medan raden visade 🎵 och ⚽ (Josef 9/8). Ser man 🎸 på kartan ska raden
 * säga 🎸.
 *
 * Siffran ovanför säger HUR MÅNGA, raden säger VAD: "182" betyder ingenting
 * förrän man ser att det är 🎸 60, ⚽ 41, 🧸 28 …
 *
 * ALLA sorter visas (Josef 10/8) — raden bryter hellre över tre-fyra rader än
 * slutar med "+21". Just svansen är ju det roliga: att det finns en 🎪 och en
 * 🚜 i staden säger mer om kvällen än att musiken är störst, och en "+21" går
 * inte att göra något av. Bredden är stadsrutans (föräldern håller den), så
 * raderna växer nedåt i stället för utåt.
 *
 * BARA under bildspelet: utan bildspel gäller dagchipens siffra hela Sverige,
 * och en rikstotal per sort säger ingenting. Här gäller den EN stad.
 *
 * KLICK PEKAR UT SORTEN PÅ KARTAN (Josef 10/8). En 🎪 är rolig att se, men
 * frågan man faktiskt ställer sig är VAR den ligger. Ett klick gör två saker:
 * kategorinamnet skrivs ut på en EGEN rad under emojierna (inte inne i pillen —
 * då hoppade raden om), och kartans övriga brickor tonas ned och backar i
 * staplingen så bara den sortens brickor står kvar tydliga. Ett andra klick
 * (eller ett klick på en annan) stänger. Själva nedtoningen görs i V2Map — se
 * `highlightEmoji` där.
 *
 * FILTRERAR INTE bort något: allt ligger kvar på kartan, bara nedtonat, och
 * antalen i raden räknar fortfarande hela staden. Vill man verkligen filtrera
 * finns kategorifiltret uppe till höger. Raden är pointer-events-none så den
 * aldrig slukar ett kartklick — bara pillarna tar emot klick.
 */
export default function CategoryMix({
    events, tone = 'light', ready = true, picked = null, onPick,
}: CategoryMixProps) {
    const rows = useMemo(() => {
        // Per emoji: antal + vilka kategorinamn den består av (det vanligaste
        // blir etiketten i tooltip/uppläsning — själva emojin är visningen).
        const buckets = new Map<string, { n: number; labels: Map<string, number> }>();
        for (const evt of events) {
            const key = eventEmoji(evt);
            let b = buckets.get(key);
            if (!b) { b = { n: 0, labels: new Map() }; buckets.set(key, b); }
            b.n += 1;
            const cat = evt.category && evt.category in EVENT_CATEGORIES
                ? EVENT_CATEGORIES[evt.category as keyof typeof EVENT_CATEGORIES]
                : null;
            if (cat) b.labels.set(cat.label, (b.labels.get(cat.label) ?? 0) + 1);
        }
        return [...buckets.entries()]
            .map(([emoji, b]) => ({
                emoji,
                n: b.n,
                label: [...b.labels.entries()].sort((a, c) => c[1] - a[1])[0]?.[0] ?? 'Event',
            }))
            .sort((a, b) => b.n - a.n);
    }, [events]);

    if (!ready || rows.length === 0) return null;

    // Vald sort — bara om den fortfarande finns kvar i raden. Byter man period
    // försvinner sorter, och en vald emoji som inte längre räknas skulle annars
    // tona ned ALLA pillar utan att någon lyste.
    const activeRow = picked ? rows.find(r => r.emoji === picked) ?? null : null;

    const dark = tone === 'dark';
    const chipBase = dark
        ? 'bg-slate-900/80 text-white/85 border-white/10'
        : 'bg-white/90 text-slate-600 border-white/60';
    // Vald: gult som resten av bildspelets accenter, och full täckning i
    // botten så den syns tydligt mot en brokig karta.
    const chipActive = dark
        ? 'bg-slate-900 text-[#FECC02] border-[#FECC02]/70'
        : 'bg-white text-[#006AA7] border-[#006AA7]/50';

    return (
        <div className="pointer-events-none flex w-full flex-col items-center gap-1">
            <div
                // role/aria-label: hela raden som EN mening när man kommer in i
                // gruppen — ett par dussin lösa "🎸 60" i följd blir obegripligt
                // uppläst. Varje pill har sedan sitt eget namn (knapp).
                role="group"
                aria-label={`Du tittar på: ${rows.map(r => `${r.n} ${r.label.toLowerCase()}`).join(', ')}`}
                className={`flex w-full flex-wrap items-center justify-center gap-1 ${
                    dark ? '' : 'max-w-[260px]'
                }`}
            >
                {rows.map(r => {
                    const on = activeRow?.emoji === r.emoji;
                    return (
                        <button
                            key={r.emoji}
                            type="button"
                            // Toggle: samma pill igen stänger, en annan flyttar valet.
                            onClick={() => onPick?.(on ? null : r.emoji)}
                            aria-pressed={on}
                            aria-label={`${r.label}, ${r.n} event`}
                            className={`pointer-events-auto relative flex items-center gap-1 rounded-full border backdrop-blur-md px-1.5 py-0.5 text-[10px] font-black leading-none tabular-nums shadow-sm outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-[#FECC02]/70 ${
                                on ? `${chipActive} z-10 scale-110` : chipBase
                            } ${
                                // Andra pillar tonas ned när något är valt — samma
                                // språk som kartans nedtoning, så raden och kartan
                                // säger samma sak.
                                activeRow && !on ? 'opacity-35' : 'opacity-100'
                            }`}
                        >
                            <span className="text-[11px] leading-none">{r.emoji}</span>
                            {r.n}
                        </button>
                    );
                })}
            </div>

            {/* EGEN RAD under emojierna med kategorinamnet (Josef 10/8). Inne i
                pillen fick den raden att brytas om vid varje klick; här står den
                stilla och kan läsas. Raden finns bara när något är valt — vi
                reserverar ingen tom höjd, den ligger under allt annat. */}
            {activeRow && (
                <div
                    aria-live="polite"
                    className={`pointer-events-none flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.1em] leading-none shadow-sm backdrop-blur-md animate-in fade-in duration-150 ${chipActive}`}
                >
                    <span className="text-[11px] normal-case leading-none tracking-normal">{activeRow.emoji}</span>
                    {activeRow.label}
                </div>
            )}
        </div>
    );
}
