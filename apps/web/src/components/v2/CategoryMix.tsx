'use client';

import { useEffect, useMemo, useState } from 'react';
import { LinkEvent } from '@/types';
import { EVENT_CATEGORIES } from '@/utils/categories';
import { eventEmoji, isEventPast } from './v2MapBricka';

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
 * kartan just nu, och hur många av varje sort. Bara sådant som ÄNNU INTE VARIT
 * räknas — raden är en meny över vad man kan gå på, och ett klick pekar ut just
 * de markörerna. Har allt i en sort varit försvinner sorten ur raden (se
 * isEventPast i rows nedan); ett event som fortfarande pågår ligger kvar.
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
 * finns kategorifiltret uppe till höger.
 *
 * SPRINGORNA SLUKAR KLICK (Josef 10/8). Pillarna är små, och satt bara de
 * själva emot klick landade varje miss mellan två emojier i kartan i stället —
 * man petade efter 🎪 och fick en bricka. Själva pill-blocket tar därför emot
 * klick och släpper dem inte vidare. Det är en OSYNLIG yta som ligger exakt
 * över raderna med pillar: den krymper till innehållet (ingen w-full) och
 * sträcker sig aldrig ut över stadsrutans tomma bredd. Ytterhöljet är kvar
 * pointer-events-none, så luften runt blocket och kategorinamnets rad under
 * fortfarande är karta.
 */
export default function CategoryMix({
    events, tone = 'light', ready = true, picked = null, onPick,
}: CategoryMixProps) {
    // Minut-klocka: "har varit"-gränsen (start + 1 h, kl 20 för event utan
    // klockslag) passeras med klockan, inte med en omrendering. Utan den låg en
    // sort kvar i raden efter att dess sista event hunnit bli gammalt.
    // Tidsstämpeln ligger i state (inte en räknare + Date.now() i memon): då är
    // den en ärlig dep och rows räknas inte om på ett värde den inte deklarerat.
    // Komponenten finns bara medan bildspelet rullar, så intervallet lever kort.
    const [nowMs, setNowMs] = useState(() => Date.now());
    useEffect(() => {
        const id = setInterval(() => setNowMs(Date.now()), 60_000);
        return () => clearInterval(id);
    }, []);

    const rows = useMemo(() => {
        // PASSERADE EVENT RÄKNAS INTE (Josef 10/8). Ett klick på en sort pekar ut
        // den på kartan, och kartans träfftest hoppar över det som varit
        // (`!isEventPast` i V2Map:s plainData). En sort där allt redan varit gick
        // därför att klicka på men tonade bara ned HELA kartan utan att peka ut
        // något — ett alternativ som inte visar något ska inte erbjudas. Samma
        // isEventPast som kartan, så raden och markörerna aldrig glider isär:
        // ett event som fortfarande PÅGÅR (startat för under en timme sedan) är
        // inte passerat och ligger kvar i raden.
        const buckets = new Map<string, { n: number; labels: Map<string, number> }>();
        for (const evt of events) {
            if (isEventPast(evt, nowMs)) continue;
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
    }, [events, nowMs]);

    // Föll den valda sorten bort ur raden (sista eventet hann bli gammalt, eller
    // man bytte period) ligger den ändå kvar i sidans mixEmoji — och då tonas
    // HELA kartan ned utan att någon pill lyser, ett läge man inte kunde klicka
    // sig ur eftersom pillen att avmarkera var borta. Släpp valet i stället.
    // Bara när det FINNS rader: en tom rad är oftast glappet mitt i ett stadshopp
    // (kartrutan hinner efter kameran), och där ska valet ligga kvar.
    useEffect(() => {
        if (!ready || picked == null || rows.length === 0) return;
        if (!rows.some(r => r.emoji === picked)) onPick?.(null);
    }, [ready, picked, rows, onPick]);

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
                // pointer-events-auto UTAN w-full: föräldern centrerar
                // (items-center), så blocket krymper till pillarna och den
                // osynliga klickytan blir aldrig bredare än de faktiskt är.
                // Med w-full hade den spänt över hela stadsrutans bredd och
                // ätit kartklick långt utanför sista emojin.
                className={`pointer-events-auto flex flex-wrap items-center justify-center gap-1 ${
                    dark ? 'max-w-full' : 'max-w-[260px]'
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
