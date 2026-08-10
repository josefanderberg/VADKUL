'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Layers, X, MoreHorizontal, ChevronUp } from 'lucide-react';
import { LinkEvent } from '@/types';
import { EVENT_CATEGORIES, EventCategoryType, SPECIAL_CATEGORY_LIST, SPECIAL_CATEGORY_KEYS } from '@/utils/categories';
import { classifySource } from '@/utils/sources';
import { sourceGradientCss } from './v2MapBricka';

interface CategoryFilterProps {
    /** Dagens (+ sökfiltrerade) events — panelen visar antal per kategori ur dessa. */
    events: LinkEvent[];
    selected: Set<string>;
    onToggle: (categoryId: string) => void;
    onClear: () => void;
    /** Under stads-bildspelet: visa opt-in-källorna (Svenska
     *  kyrkan/PRO) som en egen liten kolumn under filterknappen, utanför den
     *  vanliga kategorikolumnen. De ligger annars två klick bort (öppna filtret
     *  → ⋯) och hinner aldrig upptäckas medan bildspelet rullar. Försvinner så
     *  fort bildspelet stoppas — då är kartan användarens och toppraden ska bli
     *  ren igen. */
    showSourceShortcuts?: boolean;
}

/**
 * Kategorifilter i samma formspråk som navbar-knapparna: lager-knappen fäller
 * ut en KOLUMN av runda emoji-cirklar (en per kategori, mest event överst) —
 * ett tryck togglar filtret direkt. ALLA kategorier med event visas direkt
 * (kolumnen scrollar vid behov); bara opt-in-källorna (Svenska kyrkan/
 * PRO) ligger bakom ⋯"visa mer"-cirkeln längst ner.
 * Namn + antal finns som tooltip/aria-label. Flerval; tom selection = alla.
 */
export default function CategoryFilter({ events, selected, onToggle, onClear, showSourceShortcuts = false }: CategoryFilterProps) {
    const [open, setOpen] = useState(false);
    const [showMore, setShowMore] = useState(false);
    const panelRef = useRef<HTMLDivElement>(null);
    const btnRef = useRef<HTMLButtonElement>(null);

    // Stäng vid klick utanför kolumnen/knappen. "Visa mer"-läget nollställs
    // vid stängning så kolumnen alltid öppnar i sitt korta läge.
    useEffect(() => {
        if (!open) return;
        const onDown = (e: MouseEvent) => {
            const t = e.target as Node;
            if (panelRef.current?.contains(t) || btnRef.current?.contains(t)) return;
            setOpen(false);
            setShowMore(false);
        };
        document.addEventListener('mousedown', onDown);
        return () => document.removeEventListener('mousedown', onDown);
    }, [open]);

    const counts = useMemo(() => {
        const c = new Map<string, number>();
        for (const evt of events) {
            // Opt-in-källor (Svenska kyrkan/PRO) räknas i sin egen hink,
            // inte i sin LLM-kategori — så raden visar exakt vad som dyker upp
            // när man kryssar i den (och normal-kategorierna inte blåses upp).
            const src = classifySource(evt.url || evt.id);
            const key = src ?? (evt.category && evt.category in EVENT_CATEGORIES ? evt.category : 'other');
            c.set(key, (c.get(key) ?? 0) + 1);
        }
        return c;
    }, [events]);

    const visible = useMemo(
        () =>
            (Object.keys(EVENT_CATEGORIES) as EventCategoryType[])
                .filter((id) => (counts.get(id) ?? 0) > 0 || selected.has(id))
                .sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0)),
        [counts, selected],
    );

    // Opt-in-rader (avstängda som default, ingår ej i "visa alla"). Visas i fast
    // ordning högst upp när det finns event idag eller källan redan är ikryssad.
    const visibleSpecial = useMemo(
        () => SPECIAL_CATEGORY_LIST.filter((cat) => (counts.get(cat.id) ?? 0) > 0 || selected.has(cat.id)),
        [counts, selected],
    );

    // Gemensam cirkel-rendering för både vanliga kategorier och opt-in-källor:
    // samma 40px-cirkel som navbar-knapparna ovanför. Vid hover/fokus visas
    // kategorinamnet som en pill till vänster om cirkeln (peer-hover — native
    // title är för långsam/osynlig på touch); antal ligger kvar i aria-label.
    // Raden är flex-row-reverse så pillen kan ligga EFTER knappen i DOM (krav
    // för peer-selektorn) men ändå visas till vänster. Pillen ligger KVAR i
    // flödet (tar osynlig layoutplats) — den måste rymmas innanför kolumnens
    // padding-box, annars klipper scroll-containern bort den vågrätt.
    const renderCircle = (cat: { id: string; label: string; emoji: string; markerHex: string }) => {
        const active = selected.has(cat.id);
        // Cirkeln bär SAMMA brick-gradient som eventmarkörerna på kartan
        // (sourceGradientCss på kategorins markerHex) — inte de ljusa
        // 100-nyanserna. Färgstark = syns på kartan just nu, urblekt =
        // bortfiltrerad, blå ring = uttryckligen vald. Tom selection betyder
        // "alla PÅ" för vanliga kategorier, men opt-in-källorna
        // (Svenska kyrkan/PRO) är bara på när de är ikryssade.
        const shownOnMap = active || (selected.size === 0 && !SPECIAL_CATEGORY_KEYS.has(cat.id));
        const count = counts.get(cat.id) ?? 0;
        return (
            <div key={cat.id} className="flex flex-row-reverse items-center gap-2">
                <button
                    type="button"
                    onClick={() => onToggle(cat.id)}
                    aria-pressed={active}
                    aria-label={`${cat.label} — ${count} event idag`}
                    style={{ background: sourceGradientCss(cat.markerHex) }}
                    className={`peer h-10 w-10 shrink-0 rounded-full shadow-lg flex items-center justify-center text-lg leading-none transition-all border ${
                        active
                            ? 'border-transparent ring-2 ring-[#006AA7]'
                            : shownOnMap
                                ? 'border-white/40 dark:border-slate-700'
                                : 'border-white/40 dark:border-slate-700 opacity-40 saturate-50 hover:opacity-70'
                    }`}
                >
                    <span aria-hidden>{cat.emoji}</span>
                </button>
                <span
                    aria-hidden
                    className="pointer-events-none opacity-0 peer-hover:opacity-100 peer-focus-visible:opacity-100 transition-opacity duration-150 whitespace-nowrap rounded-full bg-white/90 dark:bg-slate-900/90 backdrop-blur-md px-2.5 py-1 text-xs font-bold text-slate-700 dark:text-slate-200 shadow-lg border border-white/50 dark:border-slate-700"
                >
                    {cat.label}
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
                {/* Högerkolumnen: TREDJE knappen under sök (top 0) och skapa event
                    (top 48) — top-[96px] = 2 × (40px knapp + 8px gap). På största
                    brytpunkten (2xl) HOPPAR den upp på navbarens rad, längst åt
                    höger (navbaren får 2xl:pr för att lämna plats — se
                    FloatingNavbar). */}
                <div className="absolute right-0 top-[96px] 2xl:top-0 pointer-events-auto">
                    {/* Rund knapp. Badge = antal aktiva filter. Namn-pill vid hover,
                        samma som kategoricirklarna nedanför (raden är
                        flex-row-reverse så pillen kan ligga efter knappen i DOM
                        men visas till vänster; raden själv är pointer-events-none
                        så den osynliga pill-ytan inte slukar kartklick). */}
                    <div className="flex flex-row-reverse items-center gap-2 pointer-events-none">
                        <button
                            ref={btnRef}
                            type="button"
                            onClick={() => { setOpen(o => !o); setShowMore(false); }}
                            aria-expanded={open}
                            aria-label="Filtrera på kategori"
                            // Vit även i mörkt läge: knappen står i samma topplinje
                            // som navbarens (profil/hjärta/sök/skapa), och de är
                            // vita utan dark:-variant. Med dark:bg-slate-900 blev
                            // den här ensam mörk i raden.
                            className="peer pointer-events-auto bg-white/90 backdrop-blur-md p-2.5 rounded-full shadow-lg border border-white/50 hover:bg-white transition-colors relative"
                        >
                            <Layers size={20} className="text-slate-700" />
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
                            Filtrera
                        </span>
                    </div>

                    {/* Bildspels-genvägen: opt-in-källorna som en egen kolumn
                        direkt under filterknappen, utanför kategorikolumnen.
                        Alla tre visas ALLTID (inte bara de med event idag) —
                        annars skulle de poppa in och ut när bildspelet byter
                        stad, och det är just den rörelsen vi vill bort från
                        toppraden. Göms när det riktiga filtret är öppet, annars
                        skulle de två kolumnerna ligga på varandra. */}
                    {showSourceShortcuts && !open && (
                        <div className="absolute right-0 top-[52px] flex flex-col items-end gap-2 pointer-events-auto p-1 -m-1 animate-in fade-in slide-in-from-top-2 duration-300">
                            {SPECIAL_CATEGORY_LIST.map((cat) => renderCircle(cat))}
                        </div>
                    )}

                    {/* Cirkelkolumn — under knappen, höger-justerad. p-1/-m-1 så
                        ringar och skuggor inte klipps av scroll-containern.

                        Scroll: kolumnen är pointer-events-auto (INTE none som
                        förr) — en pointer-events-none-container tar inte emot
                        touch-draget, så listan gick inte att scrolla på mobil.
                        Priset är att ytan bredvid cirklarna (osynliga pillar)
                        inte längre släpper igenom till kartan; därför stänger
                        ett tryck på just den ytan panelen i stället (onClick
                        nedan), så beteendet utåt blir detsamma som förut.

                        Takhöjd: 100dvh (INTE vh — mobilens adressfält gör vh
                        större än synlig yta, vilket var precis det som gömde de
                        nedersta kategorierna) minus kolumnens topp (24px
                        container + 96px knapp + 52px offset ≈ 172px) + luft. */}
                    {open && (() => {
                        const hasMore = visibleSpecial.length > 0;
                        return (
                            <div
                                ref={panelRef}
                                onClick={(e) => {
                                    // Allt som INTE är en cirkel (dvs. den osynliga pill-ytan
                                    // bredvid dem) räknas som "utanför" och stänger panelen.
                                    if (!(e.target as HTMLElement).closest('button')) {
                                        setOpen(false);
                                        setShowMore(false);
                                    }
                                }}
                                className="absolute right-0 top-[52px] flex flex-col items-end gap-2 max-h-[calc(100dvh-196px)] 2xl:max-h-[calc(100dvh-100px)] overflow-y-auto overscroll-contain [touch-action:pan-y] no-scrollbar p-1 -m-1 mt-0 pointer-events-auto animate-in fade-in slide-in-from-top-2 duration-200"
                            >
                                {/* Rensa-kryss — bara ett kryss, samma cirkel som resten.
                                    Betydelsen ("visa alla") ligger i tooltip/aria. */}
                                {selected.size > 0 && (
                                    <button
                                        type="button"
                                        onClick={onClear}
                                        aria-label="Rensa filter — visa alla kategorier"
                                        title="Visa alla"
                                        className="h-10 w-10 shrink-0 rounded-full bg-white/90 dark:bg-slate-900/90 backdrop-blur-md shadow-lg border border-white/50 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-300 transition-colors"
                                    >
                                        <X size={18} strokeWidth={2.5} />
                                    </button>
                                )}
                                {visible.map((id) => renderCircle(EVENT_CATEGORIES[id]))}
                                {/* ⋯ visar ENBART opt-in-källorna (Svenska
                                    kyrkan/PRO), avgränsade med ett litet streck. */}
                                {showMore && visibleSpecial.length > 0 && (
                                    <>
                                        <span className="w-6 mr-2 border-t border-white/80 dark:border-slate-600" aria-hidden />
                                        {visibleSpecial.map((cat) => renderCircle(cat))}
                                    </>
                                )}
                                {hasMore && (
                                    <button
                                        type="button"
                                        onClick={() => setShowMore(m => !m)}
                                        aria-expanded={showMore}
                                        aria-label={showMore ? 'Dölj Svenska kyrkan/PRO' : 'Visa Svenska kyrkan/PRO'}
                                        title={showMore ? 'Visa färre' : 'Visa mer'}
                                        className="h-10 w-10 shrink-0 rounded-full bg-white/90 dark:bg-slate-900/90 backdrop-blur-md shadow-lg border border-white/50 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-300 transition-colors"
                                    >
                                        {showMore ? <ChevronUp size={18} /> : <MoreHorizontal size={18} />}
                                    </button>
                                )}
                            </div>
                        );
                    })()}
                </div>
            </div>
        </div>
    );
}
