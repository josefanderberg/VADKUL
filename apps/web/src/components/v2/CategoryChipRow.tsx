'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import HScrollRow from '@/components/ui/HScrollRow';
import { EVENT_CATEGORIES, SPECIAL_CATEGORIES, type EventCategoryType } from '@/utils/categories';
import { planMapCategoryChips, visibleSourceKeys } from '@/utils/categoryChips';
import { SOURCE_DEFS } from '@/utils/sources';
import { categoryLabel } from './v2MapLabel';

const KEYS = Object.keys(EVENT_CATEGORIES) as EventCategoryType[];

/** Fler-källornas emoji — kyrkan och PRO som i profilen, Korpen egen. */
export const SOURCE_EMOJI: Record<string, string> = {
    svenskakyrkan: SPECIAL_CATEGORIES.svenskakyrkan.emoji,
    pro: SPECIAL_CATEGORIES.pro.emoji,
    korpen: '🏃',
};

const CHIP = 'shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-colors';
// Mörk ton = sökpanelen (vald = vit platta med mörk text — guld betyder boost
// på kartan). Ljus ton = eventkortet (6/10): vald = kartblå platta med vit
// text, samma språk som kortets Kommer-knapp.
const TONES = {
    dark: {
        on: 'bg-white text-slate-900',
        idle: 'bg-white/10 text-white/85 hover:bg-white/20',
        popOn: 'bg-white text-[#c2410c]',
        mark: 'bg-transparent text-white ring-2 ring-inset ring-white',
        label: 'text-white/45',
        countOn: 'text-slate-500',
        countIdle: 'text-white/45',
        empty: 'text-white/55',
    },
    light: {
        on: 'bg-[#006AA7] text-white',
        idle: 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 hover:bg-slate-200 dark:hover:bg-zinc-700',
        popOn: 'bg-[#c2410c] text-white',
        // Det öppna eventets kategori (7/10 sent): INTE vald, bara markerad -
        // vit platta med kant (vit kant på mörk yta; på det vita kortet syns
        // en vit kant inte, där bär kartblått kanten).
        mark: 'bg-white text-slate-800 ring-2 ring-inset ring-[#006AA7]/45 shadow-sm dark:bg-transparent dark:text-white dark:ring-white',
        label: 'text-slate-400 dark:text-zinc-500',
        countOn: 'text-white/70',
        countIdle: 'text-slate-400 dark:text-zinc-500',
        empty: 'text-slate-400',
    },
} as const;

interface CategoryChipRowProps {
    /** Event per kategori i kartans ruta, räknade med alla filter utom själva
     *  kategorivalet — alltså vad kategorin bidrar med om chippet är valt. */
    counts: ReadonlyMap<string, number>;
    /** Valda kategorier (FLERVAL sedan 6/10, tom mängd = visa alla). */
    selected: ReadonlySet<string>;
    /** Togglar kategorin i valet; null = släpp alla. */
    onToggle: (category: EventCategoryType | null) => void;
    /** Event per Fler-källa i vyn (Svenska kyrkan, PRO, Korpen). */
    sourceCounts: ReadonlyMap<string, number>;
    selectedSource: string | null;
    /** null = släpp källvalet. */
    onSelectSource: (source: string | null) => void;
    /** 🔥 POPULÄRA som FÖRSTA chip (ägarbeslut 24/9 — ersätter 🔥-knappen i
     *  botten-dockans högra hörn). Ett eget läge som kan kombineras med en
     *  kategori; utelämnad = inget chip (inga pop-flaggor i lagret). */
    popular?: { on: boolean; count: number; onToggle: () => void };
    /** Färgton: 'dark' (sökpanelen, default) eller 'light' (eventkortet, 6/10). */
    tone?: 'dark' | 'light';
    /** Scrollhjul i sidled (HScrollRow). AV i eventkortet — kortet äger hjulet. */
    wheel?: boolean;
    /** Det öppna eventets kategori (7/10 sent): står direkt efter de valda,
     *  längst till vänster, MARKERAD men inte vald - ett tryck slår på den. */
    highlight?: string | null;
}

/**
 * Kategorifiltret i SÖKPANELEN (ägarbeslut 16/9). Kolumnen till höger revs
 * 15/9 för att få ner antalet knappar, men användare saknade filtret ("bara
 * få upp sport eller musik") — så det bor nu bakom sökknappen och syns så
 * fort sökfältet är öppet. FLERVAL sedan 6/10 (ägarbeslut, efter happymap-
 * genomgången): varje tryck togglar sin kategori, flera kan vara valda
 * samtidigt, inga valda = alla. Kortnamnen är samma ord som under kartans
 * markörer. Vald = vit platta med mörk text — guld betyder boost på kartan.
 *
 * 🔥 POPULÄRA (ägarbeslut 24/9): 🔥-knappen i kartans nedre högra hörn är
 * riven och filtret bor här. Det är ett eget läge (popularOnly i sidan),
 * inte en kategori — det går att kombinera med en kategori, men ett källval
 * under Fler släpper det (källorna är aldrig populära). SEDAN 7/10 sent står
 * det först bara när det är PÅ: valda kategorier och det öppna eventets
 * kategori (markerad, inte vald) går före ett avslaget 🔥 - "de kategorier
 * som är valda måste ju hamna längst åt vänster".
 *
 * FLER längst till höger (Josef 16/9, som stadssidornas Fler-chip): fäller
 * ut Svenska kyrkan, PRO och Korpen i samma rad. Ett källval betyder "visa
 * bara källan" — sidan släpper då kategorin och 🔥. Källor utan event i vyn
 * göms som kategorierna, och finns ingen alls göms Fler-chippet också.
 *
 * MUS (Josef 16/9: "om man är på en dator utan touchpad"): raden går att
 * DRA i sidled, och scrollhjulet rullar den i sidled. Ett drag räknas inte
 * som klick på chippet där det började. Touch sköts av webbläsaren (pan-x).
 * Själva rullningen bor i HScrollRow (delad med eventkortets rader).
 */
export default function CategoryChipRow({
    counts, selected, onToggle, sourceCounts, selectedSource, onSelectSource, popular, tone = 'dark', wheel = true, highlight = null,
}: CategoryChipRowProps) {
    const t = TONES[tone];
    // VALDA LÄNGST TILL VÄNSTER, sedan det öppna eventets kategori (ägarbeslut
    // 7/10 sent) - båda före 🔥 när 🔥 är av; påslaget 🔥 är också ett val
    // och står först. Övriga kategorier efter 🔥 som förut.
    const chips = useMemo(() => planMapCategoryChips(KEYS, counts, selected, highlight), [counts, selected, highlight]);
    const leadChips = chips.filter(c => c.lead);
    const restChips = chips.filter(c => !c.lead);
    // Fler är utfälld när man själv öppnat den — ELLER när en källa är vald,
    // så valet alltid syns och går att släppa i raden.
    const [moreOpen, setMoreOpen] = useState(false);
    const showSources = moreOpen || selectedSource !== null;
    // Fler-källor med event i vyn (eller den valda) — utan någon alls göms
    // även Fler-chippet, samma regel som kategorierna (Josef 16/9).
    const sourceKeys = useMemo(
        () => visibleSourceKeys(SOURCE_DEFS.map(s => s.key), sourceCounts, selectedSource),
        [sourceCounts, selectedSource],
    );

    const scrollRef = useRef<HTMLDivElement>(null);

    // Fäller man ut Fler hamnar källorna längst till höger — rulla fram dem.
    useEffect(() => {
        const el = scrollRef.current;
        if (moreOpen && el) el.scrollTo({ left: el.scrollWidth, behavior: 'smooth' });
    }, [moreOpen]);

    // Ett val (eller ett nytt event) flyttar chips till vänsterkanten - rulla
    // dit, annars hoppar det man just tryckte på ut ur bild.
    const isFirstRender = useRef(true);
    useEffect(() => {
        if (isFirstRender.current) { isFirstRender.current = false; return; }
        scrollRef.current?.scrollTo({ left: 0, behavior: 'smooth' });
    }, [selected, highlight]);

    const popularChip = popular && (
        <button
            type="button"
            aria-pressed={popular.on}
            onClick={popular.onToggle}
            className={`${CHIP} ${popular.on ? t.popOn : t.idle}`}
        >
            <span aria-hidden>🔥</span>
            Populära
            <span className={`tabular-nums ${popular.on ? t.countOn : t.countIdle}`}>{popular.count}</span>
        </button>
    );
    const categoryChip = ({ key, count }: { key: string; count: number }) => {
        const cat = key as EventCategoryType;
        const on = selected.has(cat);
        const marked = !on && key === highlight;
        return (
            <button
                key={key}
                type="button"
                aria-pressed={on}
                onClick={() => onToggle(cat)}
                title={marked ? `Visa bara ${categoryLabel(cat).toLowerCase()} - samma kategori som eventet du tittar på` : undefined}
                className={`${CHIP} ${on ? t.on : marked ? t.mark : t.idle}`}
            >
                <span aria-hidden>{EVENT_CATEGORIES[cat].emoji}</span>
                {categoryLabel(cat)}
                <span className={`tabular-nums ${on ? t.countOn : t.countIdle}`}>{count}</span>
            </button>
        );
    };

    return (
        <div className="px-4 pt-2.5 pb-3">
            <span className={`block mb-2 text-[10px] font-black uppercase tracking-widest ${t.label}`}>
                Visa bara
            </span>
            {/* -mx-4/px-4: raden rullar ända ut till panelens kanter. */}
            <HScrollRow ref={scrollRef} wheel={wheel} className="-mx-4 px-4 gap-2">
                {popular?.on && popularChip}
                {chips.length === 0 && !popular && (
                    <span className={`shrink-0 text-xs ${t.empty}`}>Inga kategorier i vyn</span>
                )}
                {leadChips.map(categoryChip)}
                {popular && !popular.on && popularChip}
                {restChips.map(categoryChip)}
                {sourceKeys.length > 0 && (
                    <button
                        type="button"
                        aria-expanded={showSources}
                        aria-label={showSources ? 'Dölj fler källor' : 'Visa fler källor: Svenska kyrkan, PRO och Korpen'}
                        onClick={() => setMoreOpen(o => !o)}
                        className={`${CHIP} ${selectedSource ? t.on : t.idle}`}
                    >
                        Fler
                        <ChevronRight size={12} className={`transition-transform ${showSources ? 'rotate-180' : ''}`} aria-hidden />
                    </button>
                )}
                {showSources && SOURCE_DEFS.filter(s => sourceKeys.includes(s.key)).map(s => {
                    const on = selectedSource === s.key;
                    return (
                        <button
                            key={s.key}
                            type="button"
                            aria-pressed={on}
                            onClick={() => onSelectSource(on ? null : s.key)}
                            className={`${CHIP} ${on ? t.on : t.idle}`}
                        >
                            <span aria-hidden>{SOURCE_EMOJI[s.key] ?? '•'}</span>
                            {s.label}
                            <span className={`tabular-nums ${on ? t.countOn : t.countIdle}`}>{sourceCounts.get(s.key) ?? 0}</span>
                        </button>
                    );
                })}
            </HScrollRow>
        </div>
    );
}
