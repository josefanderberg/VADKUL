'use client';

import { useEffect, useMemo, useState } from 'react';
import { Layers, X } from 'lucide-react';
import { LinkEvent } from '@/types';
import { EVENT_CATEGORIES, EventCategoryType, SPECIAL_CATEGORY_LIST, SPECIAL_CATEGORY_KEYS } from '@/utils/categories';
import { classifySource } from '@/utils/sources';
import { sourceGradientCss } from './v2MapBricka';
import { categoryLabel } from './v2MapLabel';

interface CategoryFilterProps {
    /** Eventen I KARTANS RUTA just nu (sidan filtrerar med inMapView före
     *  kategorifiltret) — kolumnen visar bara kategorier som faktiskt syns på
     *  kartan, med antal per kategori. Ersätter emoji-raden som låg under
     *  stadsrutan (Josef 10/8): samma "vad ser jag?"-sammanfattning, men i
     *  kategorifiltrets språk, och varje cirkel filtrerar på riktigt. */
    events: LinkEvent[];
    selected: Set<string>;
    onToggle: (categoryId: string) => void;
    onClear: () => void;
    /** Familj & barn som opt-in (profilregeln i utils/familyFilter — inloggad
     *  vuxen utan barn): 🧸-cirkeln flyttar upp bland opt-in-raderna (Svenska
     *  kyrkan/PRO) och kategorin är gömd tills den kryssas i. */
    familyOptIn?: boolean;
    /** Bumpas av sidan vid varje KLICK på själva kartan (aldrig efter en
     *  dragning — MapLibre fyrar ingen 'click' då): öppen kolumn fäller ihop
     *  sig (Josef 31/8). Panorering lämnar den alltså i fred. */
    closeNonce?: number;
}

/**
 * Kategorikolumnen till höger — GÖMD SOM DEFAULT (Josef 12/8): filterknappen
 * (lagren) öppnar den när man vill ha kartans "vad ser jag?"-sammanfattning.
 * En rund emoji-cirkel per kategori som syns i kartrutan (mest event överst),
 * med ANTALET som badge på cirkeln — panorerar man ändras både urval och
 * siffror med vyn. Ett tryck togglar filtret direkt; namnet står som en pill
 * till vänster om cirkeln så länge kolumnen är öppen (Josef 26/8).
 *
 * Opt-in-källorna (Svenska kyrkan/PRO) ligger ALLTID överst, avstängda tills
 * man kryssar i dem — de har så många event att de annars dränker kartan, och
 * överst ligger de still i stället för att poppa in och ut när vyn byter.
 * (⋯"visa mer"-cirkeln och bildspels-genvägskolumnen är borttagna 10/8 —
 * källorna behöver ingen extra väg när de alltid står högst upp.)
 *
 * Öppen kolumn är ett sessionsval — ingen localStorage. Ett klick på KARTAN
 * stänger kolumnen (Josef 31/8, via closeNonce — ersätter 12/8-beslutet att
 * den bara stängs manuellt); att DRA kartan lämnar den öppen.
 */
export default function CategoryFilter({ events, selected, onToggle, onClear, familyOptIn = false, closeNonce = 0 }: CategoryFilterProps) {
    // Startar ALLTID GÖMD (Josef 12/8, skärpt från 11/8): kolumnen tar nästan
    // hela högersidan på mobil. Första versionen lät ett gammalt "visa"-val i
    // localStorage vinna över defaulten — då såg det ut som att defaulten
    // aldrig ändrats för den som testat toggeln. Nu är valet per session:
    // ingen localStorage alls, filterknappen öppnar när man vill ha kolumnen.
    const [hidden, setHidden] = useState(true);
    const toggleHidden = () => setHidden(h => !h);
    // Kartklick = stäng (Josef 31/8). Noncen bumpas i sidans onMapClick;
    // 0 = inget klick än (initialvärdet ska inte trigga något).
    useEffect(() => {
        if (closeNonce > 0) setHidden(true);
    }, [closeNonce]);

    const counts = useMemo(() => {
        const c = new Map<string, number>();
        for (const evt of events) {
            // Opt-in-källor (Svenska kyrkan/PRO) räknas i sin egen hink,
            // inte i sin LLM-kategori — så cirkeln visar exakt vad som dyker upp
            // när man kryssar i den (och normal-kategorierna inte blåses upp).
            const src = classifySource(evt.url || evt.id);
            const key = src ?? (evt.category && evt.category in EVENT_CATEGORIES ? evt.category : 'other');
            c.set(key, (c.get(key) ?? 0) + 1);
        }
        return c;
    }, [events]);

    // I familj-opt-in-läget beter sig 'family' som en opt-in-källa: cirkeln
    // renderas bland opt-in-raderna överst (och tas bort ur normal-listan),
    // urblekt tills den kryssas i — precis som Svenska kyrkan/PRO.
    const optInList = useMemo(
        () => (familyOptIn ? [...SPECIAL_CATEGORY_LIST, EVENT_CATEGORIES.family] : [...SPECIAL_CATEGORY_LIST]),
        [familyOptIn],
    );
    const optInKeys = useMemo(
        () => (familyOptIn ? new Set([...SPECIAL_CATEGORY_KEYS, 'family']) : SPECIAL_CATEGORY_KEYS),
        [familyOptIn],
    );

    // Antal valda NORMALA kategorier — opt-in-källorna räknas bort, precis som
    // matchesFilter i page.tsx gör med selectedNormal. Avgörande sedan
    // opt-in-källorna kan vara FÖRVALDA (utils/categoryDefaults: utloggade och
    // 65+): utan borträkningen hade varje besökare mötts av alla vanliga
    // kategorier urblekta, trots att kartan visar dem.
    const normalSelectedCount = useMemo(
        () => [...selected].filter((id) => !optInKeys.has(id)).length,
        [selected, optInKeys],
    );

    // Bara kategorier som SYNS i vyn (eller är ikryssade — en bortfiltrerad
    // kategori måste gå att kryssa ur igen). Mest event överst.
    const visible = useMemo(
        () =>
            (Object.keys(EVENT_CATEGORIES) as EventCategoryType[])
                .filter((id) => !(familyOptIn && id === 'family'))
                .filter((id) => (counts.get(id) ?? 0) > 0 || selected.has(id))
                .sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0)),
        [counts, selected, familyOptIn],
    );

    // Gemensam cirkel-rendering för både vanliga kategorier och opt-in-källor:
    // samma 40px-cirkel som navbar-knapparna ovanför, nu med ANTALET i vyn som
    // badge uppe till höger (badge bara när det finns något — en nolla på
    // opt-in-raderna vore brus). Kategorinamnet visas som en pill till vänster
    // om cirkeln — ALLTID synlig när kolumnen är öppen (Josef 26/8: hover-
    // varianten dolde namnen på touch; kolumnen är ändå stängd när den inte
    // används). Raden är flex-row-reverse så pillen ligger EFTER knappen i DOM
    // men visas till vänster. Pillen ligger i flödet och måste rymmas innanför
    // kolumnens padding-box, annars klipper scroll-containern bort den vågrätt.
    const renderCircle = (cat: { id: string; label: string; emoji: string; markerHex: string }) => {
        const active = selected.has(cat.id);
        // Cirkeln bär SAMMA brick-gradient som eventmarkörerna på kartan
        // (sourceGradientCss på kategorins markerHex). Färgstark = syns på
        // kartan just nu, urblekt = bortfiltrerad, blå ring = uttryckligen
        // vald. Tomt NORMAL-val betyder "alla PÅ" för vanliga kategorier, men
        // opt-in-raderna (Svenska kyrkan/PRO, ev. 🧸) är bara på ikryssade.
        const shownOnMap = active || (normalSelectedCount === 0 && !optInKeys.has(cat.id));
        const count = counts.get(cat.id) ?? 0;
        return (
            <div key={cat.id} className="flex flex-row-reverse items-center gap-2">
                <button
                    type="button"
                    onClick={() => onToggle(cat.id)}
                    aria-pressed={active}
                    aria-label={`${cat.label} — ${count} event i vyn`}
                    style={{ background: sourceGradientCss(cat.markerHex) }}
                    className={`peer pointer-events-auto relative h-10 w-10 shrink-0 rounded-full shadow-lg flex items-center justify-center text-lg leading-none transition-all border ${
                        active
                            ? 'border-transparent ring-2 ring-[#006AA7]'
                            : shownOnMap
                                ? 'border-white/40 dark:border-slate-700'
                                : 'border-white/40 dark:border-slate-700 opacity-40 saturate-50 hover:opacity-70'
                    }`}
                >
                    <span aria-hidden>{cat.emoji}</span>
                    {count > 0 && (
                        <span
                            aria-hidden
                            className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-[10px] font-black tabular-nums flex items-center justify-center border border-slate-200 dark:border-slate-600 shadow leading-none pointer-events-none"
                        >
                            {count > 99 ? '99+' : count}
                        </span>
                    )}
                </button>
                <span
                    aria-hidden
                    // Urblekt namn på urblekt (bortfiltrerad) cirkel — namnraden
                    // ska spegla cirkelns eget aktiv/inaktiv-språk.
                    className={`pointer-events-none whitespace-nowrap rounded-full bg-white/90 dark:bg-slate-900/90 backdrop-blur-md px-2.5 py-1 text-xs font-bold text-slate-700 dark:text-slate-200 shadow-lg border border-white/50 dark:border-slate-700 ${
                        shownOnMap ? '' : 'opacity-50'
                    }`}
                >
                    {/* KORTFORMEN — samma enda ord som står under
                        eventmarkörerna på kartan (Josef 1/9), inte
                        EVENT_CATEGORIES långa etiketter ("Sport & träning",
                        "Mat & dryck"). Samma sak ska heta samma sak på båda
                        ytorna. Opt-in-källorna har ingen kortform (de är inte
                        LLM-kategorier — categoryLabel skulle ge "Övrigt") och
                        behåller därför sina egna namn. */}
                    {SPECIAL_CATEGORY_KEYS.has(cat.id) ? cat.label : categoryLabel(cat.id)}
                </span>
            </div>
        );
    };

    return (
        // Samma yttre layout som FloatingNavbar (top-6 + max-w-[1400px] mx-auto + px-4)
        // → knappen följer navbarens HÖGERKANT i stället för att driva ut till
        // viewportkanten på breda skärmar. Tom container = pointer-events-none.
        <div className="fixed top-6 left-0 right-0 px-4 z-[1150] pointer-events-none">
            <div className="relative max-w-[1400px] mx-auto">
                {/* Högerkolumnen: ANDRA knappen, direkt under sök (top 0) —
                    top-[48px] = 40px knapp + 8px gap. Flyttade upp ett steg 14/8
                    när skapa-knappen lämnade högerkolumnen för vänsterkolumnens
                    tredje plats; annars stod det ett tomt hål mellan sök och
                    kategorier. På största brytpunkten (2xl) HOPPAR den upp på
                    navbarens rad, längst åt höger (navbaren får 2xl:pr för att
                    lämna plats — se FloatingNavbar). */}
                {/* Pointer-events NONE även HÄR, som på cirkelkolumnen (11/8) —
                    boxens bredd sätts av den osynliga namn-pillen ("Göm
                    kategorier") och med auto åt containern klicks i hela det
                    fältet: den låg som ett dött band över stadsrutans
                    framåtpil-kolumn (Josef 21/8, "måste klicka över eller
                    under"). Knappen och cirklarna har egna auto. */}
                <div className="absolute right-0 top-[48px] 2xl:top-0 pointer-events-none">
                    {/* Rund knapp — VISAR/GÖMMER kolumnen. Badge = antal aktiva
                        filter. Namn-pill vid hover, samma som kategoricirklarna
                        nedanför (raden är flex-row-reverse så pillen kan ligga
                        efter knappen i DOM men visas till vänster; raden själv
                        är pointer-events-none så den osynliga pill-ytan inte
                        slukar kartklick). */}
                    <div className="flex flex-row-reverse items-center gap-2 pointer-events-none">
                        <button
                            type="button"
                            onClick={toggleHidden}
                            aria-expanded={!hidden}
                            aria-label={hidden ? 'Visa kategorierna' : 'Göm kategorierna'}
                            // Vit även i mörkt läge: knappen står i samma topplinje
                            // som navbarens (profil/hjärta/sök/skapa), och de är
                            // vita utan dark:-variant. Med dark:bg-slate-900 blev
                            // den här ensam mörk i raden.
                            className="peer pointer-events-auto bg-white/90 backdrop-blur-md p-2.5 rounded-full shadow-lg border border-white/50 hover:bg-white transition-colors relative"
                        >
                            <Layers size={20} className={hidden ? 'text-slate-400' : 'text-slate-700'} />
                            {selected.size > 0 && (
                                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#006AA7] text-white text-[10px] font-black flex items-center justify-center border border-white tabular-nums">
                                    {selected.size}
                                </span>
                            )}
                        </button>
                        <span
                            aria-hidden
                            className="pointer-events-none opacity-0 peer-hover:opacity-100 peer-focus-visible:opacity-100 transition-opacity duration-150 whitespace-nowrap rounded-full bg-white/90 backdrop-blur-md px-2.5 py-1 text-xs font-bold text-slate-700 shadow-lg border border-white/50"
                        >
                            {hidden ? 'Visa kategorier' : 'Göm kategorier'}
                        </span>
                    </div>

                    {/* Cirkelkolumn — under knappen, höger-justerad. p-1/-m-1 så
                        ringar, badges och skuggor inte klipps av scroll-containern.

                        Pointer-events: containern är NONE, bara cirklarna är
                        auto (Josef 11/8): kolumnens bredd sätts av de osynliga
                        namn-pillarna, och med auto på containern gick kartan
                        inte att dra i hela det fältet — på mobil nästan halva
                        skärmbredden. Scrollen överlever ändå: ett touch-drag
                        som börjar PÅ en cirkel (auto) scrollar närmast
                        scrollbara förälder oavsett förälderns pointer-events —
                        hit-testing och scroll-propagering är olika maskinerier.
                        Drag i tomrummet bredvid cirklarna panorerar kartan.

                        Takhöjd: 100dvh (INTE vh — mobilens adressfält gör vh
                        större än synlig yta, vilket var precis det som gömde de
                        nedersta kategorierna) minus kolumnens topp (24px
                        container + 48px knapp + 52px offset ≈ 124px) + luft.
                        Taket följde med uppåt när knappen flyttade ett steg
                        (14/8): annars hade listan fått 48px kortare utrymme än
                        skärmen faktiskt erbjuder. */}
                    {!hidden && (
                        <div className="absolute right-0 top-[52px] flex flex-col items-end gap-2 max-h-[calc(100dvh-148px)] 2xl:max-h-[calc(100dvh-100px)] overflow-y-auto overscroll-contain [touch-action:pan-y] no-scrollbar p-1 -m-1 mt-0 pointer-events-none animate-in fade-in slide-in-from-top-2 duration-200">
                            {/* Opt-in-raderna ALLTID överst, avstängda tills man
                                kryssar i dem — och alltid samma rader, så toppen
                                av kolumnen står still när vyn byter. I familj-
                                opt-in-läget ligger 🧸 här i stället för i
                                normal-listan. */}
                            {optInList.map((cat) => renderCircle(cat))}
                            <span className="w-6 mr-2 border-t border-white/80 dark:border-slate-600" aria-hidden />
                            {/* Rensa-kryss — bara ett kryss, samma cirkel som resten.
                                Betydelsen ("visa alla") ligger i tooltip/aria. */}
                            {selected.size > 0 && (
                                <button
                                    type="button"
                                    onClick={onClear}
                                    aria-label="Rensa filter — visa alla kategorier"
                                    title="Visa alla"
                                    className="pointer-events-auto h-10 w-10 shrink-0 rounded-full bg-white/90 dark:bg-slate-900/90 backdrop-blur-md shadow-lg border border-white/50 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-300 transition-colors"
                                >
                                    <X size={18} strokeWidth={2.5} />
                                </button>
                            )}
                            {visible.map((id) => renderCircle(EVENT_CATEGORIES[id]))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
