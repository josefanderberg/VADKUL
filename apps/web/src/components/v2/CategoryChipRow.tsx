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
const CHIP_ON = 'bg-white text-slate-900';
const CHIP_IDLE = 'bg-white/10 text-white/85 hover:bg-white/20';

interface CategoryChipRowProps {
    /** Event per kategori i kartans ruta, räknade med alla filter utom själva
     *  kategorivalet — alltså vad kartan visar om man trycker på chippet. */
    counts: ReadonlyMap<string, number>;
    selected: EventCategoryType | null;
    /** null = släpp filtret. */
    onSelect: (category: EventCategoryType | null) => void;
    /** Event per Fler-källa i vyn (Svenska kyrkan, PRO, Korpen). */
    sourceCounts: ReadonlyMap<string, number>;
    selectedSource: string | null;
    /** null = släpp källvalet. */
    onSelectSource: (source: string | null) => void;
}

/**
 * Kategorifiltret i SÖKPANELEN (ägarbeslut 16/9). Kolumnen till höger revs
 * 15/9 för att få ner antalet knappar, men användare saknade filtret ("bara
 * få upp sport eller musik") — så det bor nu bakom sökknappen och syns så
 * fort sökfältet är öppet. EN sak åt gången: tryck = bara den, tryck igen =
 * alla. Kortnamnen är samma ord som under kartans markörer.
 * Vald = vit platta med mörk text — guld betyder boost på kartan.
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
    counts, selected, onSelect, sourceCounts, selectedSource, onSelectSource,
}: CategoryChipRowProps) {
    const chips = useMemo(() => planMapCategoryChips(KEYS, counts, selected), [counts, selected]);
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

    return (
        <div className="px-4 pt-2.5 pb-3">
            <span className="block mb-2 text-[10px] font-black uppercase tracking-widest text-white/45">
                Visa bara
            </span>
            {/* -mx-4/px-4: raden rullar ända ut till panelens kanter. */}
            <HScrollRow ref={scrollRef} wheel className="-mx-4 px-4 gap-2">
                {chips.length === 0 && (
                    <span className="shrink-0 text-xs text-white/55">Inga kategorier i vyn</span>
                )}
                {chips.map(({ key, count }) => {
                    const cat = key as EventCategoryType;
                    const on = selected === cat;
                    return (
                        <button
                            key={key}
                            type="button"
                            aria-pressed={on}
                            onClick={() => onSelect(on ? null : cat)}
                            className={`${CHIP} ${on ? CHIP_ON : CHIP_IDLE}`}
                        >
                            <span aria-hidden>{EVENT_CATEGORIES[cat].emoji}</span>
                            {categoryLabel(cat)}
                            <span className={`tabular-nums ${on ? 'text-slate-500' : 'text-white/45'}`}>{count}</span>
                        </button>
                    );
                })}
                {sourceKeys.length > 0 && (
                    <button
                        type="button"
                        aria-expanded={showSources}
                        aria-label={showSources ? 'Dölj fler källor' : 'Visa fler källor: Svenska kyrkan, PRO och Korpen'}
                        onClick={() => setMoreOpen(o => !o)}
                        className={`${CHIP} ${selectedSource ? CHIP_ON : CHIP_IDLE}`}
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
                            className={`${CHIP} ${on ? CHIP_ON : CHIP_IDLE}`}
                        >
                            <span aria-hidden>{SOURCE_EMOJI[s.key] ?? '•'}</span>
                            {s.label}
                            <span className={`tabular-nums ${on ? 'text-slate-500' : 'text-white/45'}`}>{sourceCounts.get(s.key) ?? 0}</span>
                        </button>
                    );
                })}
            </HScrollRow>
        </div>
    );
}
