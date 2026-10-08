'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, LocateFixed, MapPin, Search } from 'lucide-react';
import { logEvent } from 'firebase/analytics';
import { analytics } from '@/lib/firebase';
import { searchCities, type CityPoint } from '@/utils/cityPoints';
import { popularStartCities, START_CITY_COUNT } from '@/utils/startChoice';
import { EVENT_CATEGORIES, type EventCategoryType } from '@/utils/categories';

interface StartCityPickerProps {
    /** Nuvarande val (markeras), null = "där jag är". */
    current: CityPoint | null;
    /** Kategoristeget visas bara i onboardingen - från profilen byter man
     *  bara stad (kategorierna har sitt eget filter i sökpanelen). */
    withCategories: boolean;
    /** Förvalda kategorier i steg 2 (kartans nuvarande filter). */
    initialCategories: ReadonlySet<EventCategoryType>;
    /** Klart. city null = "där jag är". kats bara när kategoristeget visats. */
    onDone: (choice: { city: CityPoint | null; kats?: EventCategoryType[] }) => void;
    /** Hoppa över / stäng - inget ändras. */
    onSkip: () => void;
}

const CATEGORY_KEYS = (Object.keys(EVENT_CATEGORIES) as EventCategoryType[]).filter(k => k !== 'other');

function track(name: string) {
    analytics.then(a => { if (a) logEvent(a, name); }).catch(() => { /* analytics avstängt */ });
}

/**
 * Startstadsväljaren (ägarbeslut 8/10, förebild happymap.se): steg 1 = var
 * kartan ska öppna (snabbval bland stadssidorna + sök bland alla orter, eller
 * "Där jag är"), steg 2 = vad man är sugen på (valfritt flerval som blir
 * kartans vanliga sparade filter). "Hoppa över" ger dagens beteende.
 * Samma kortspråk som välkomstrutan.
 */
export default function StartCityPicker({ current, withCategories, initialCategories, onDone, onSkip }: StartCityPickerProps) {
    const [step, setStep] = useState<'city' | 'categories'>('city');
    const [query, setQuery] = useState('');
    const [city, setCity] = useState<CityPoint | null>(current);
    const [kats, setKats] = useState<Set<EventCategoryType>>(() => new Set(initialCategories));
    const cardRef = useRef<HTMLDivElement>(null);
    const onSkipRef = useRef(onSkip);
    onSkipRef.current = onSkip;

    const popular = useMemo(() => popularStartCities(12), []);
    const hits = useMemo(() => searchCities(query, 8), [query]);
    const list = query.trim().length >= 2 ? hits : popular;

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') { track('startstad_skip'); onSkipRef.current(); }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    const pickCity = (c: CityPoint | null) => {
        setCity(c);
        track(c ? 'startstad_city' : 'startstad_here');
        if (withCategories) { setStep('categories'); cardRef.current?.scrollTo({ top: 0 }); }
        else onDone({ city: c });
    };

    const toggleKat = (k: EventCategoryType) => setKats(prev => {
        const next = new Set(prev);
        if (next.has(k)) next.delete(k); else next.add(k);
        return next;
    });

    const chipBase = 'px-3.5 py-2 rounded-full text-sm font-bold transition-colors active:scale-[0.97] outline-none focus-visible:ring-2 focus-visible:ring-[#006AA7]/40';

    return (
        <div role="dialog" aria-modal aria-label="Välj startstad" className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/[0.32]" onClick={() => { track('startstad_skip'); onSkip(); }} />
            <div
                ref={cardRef}
                className="relative w-full max-w-sm max-h-[calc(100dvh-2rem)] overflow-y-auto overflow-x-hidden bg-white rounded-[28px] shadow-2xl animate-in fade-in zoom-in-95 duration-300 px-6 pt-6 pb-5 flex flex-col gap-4"
            >
                {step === 'city' ? (
                    <>
                        <div className="flex flex-col gap-1 text-center">
                            <h2 className="text-[22px] font-black text-slate-900 leading-tight">Var vill du börja?</h2>
                            <p className="text-[13px] font-semibold text-slate-500 leading-snug">
                                Kartan öppnar där varje gång du kommer tillbaka. Du kan ändra det sen.
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={() => pickCity(null)}
                            className={`w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-black text-sm transition-all active:scale-[0.98] outline-none focus-visible:ring-4 focus-visible:ring-[#FECC02]/70 ${
                                current === null ? 'bg-[#006AA7] text-white' : 'border-2 border-[#006AA7]/25 text-[#006AA7] hover:bg-[#006AA7]/5'
                            }`}
                        >
                            <LocateFixed size={18} strokeWidth={2.5} />
                            Där jag är
                        </button>

                        <label className="relative block">
                            <span className="sr-only">Sök ort</span>
                            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden />
                            <input
                                type="search"
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                placeholder={`Sök bland ${START_CITY_COUNT} orter`}
                                autoComplete="off"
                                enterKeyHint="search"
                                onKeyDown={e => { if (e.key === 'Enter' && hits[0]) pickCity(hits[0]); }}
                                className="w-full pl-10 pr-4 py-3 rounded-2xl bg-slate-100 text-[16px] font-semibold text-slate-800 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-[#006AA7]/40"
                            />
                        </label>

                        <div className="flex flex-col gap-2">
                            {query.trim().length < 2 && (
                                <span className="text-[11px] font-black uppercase tracking-wide text-slate-400">Populära städer</span>
                            )}
                            {list.length === 0 ? (
                                <p className="text-sm font-semibold text-slate-400">Hittar ingen ort som heter så.</p>
                            ) : (
                                <div className="flex flex-wrap gap-2">
                                    {list.map(c => (
                                        <button
                                            key={c.name}
                                            type="button"
                                            onClick={() => pickCity(c)}
                                            className={`${chipBase} inline-flex items-center gap-1.5 ${current?.name === c.name ? 'bg-[#006AA7] text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                                        >
                                            <MapPin size={13} aria-hidden />
                                            {c.name}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <button
                            type="button"
                            onClick={() => { track('startstad_skip'); onSkip(); }}
                            className="self-center text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors py-1"
                        >
                            {withCategories ? 'Hoppa över' : 'Avbryt'}
                        </button>
                    </>
                ) : (
                    <>
                        <div className="flex items-start gap-2">
                            <button
                                type="button"
                                onClick={() => setStep('city')}
                                aria-label="Tillbaka till stad"
                                className="-ml-2 p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                            >
                                <ArrowLeft size={18} />
                            </button>
                            <div className="flex-1 flex flex-col gap-1 text-center pr-8">
                                <h2 className="text-[22px] font-black text-slate-900 leading-tight">Vad gillar du?</h2>
                                <p className="text-[13px] font-semibold text-slate-500 leading-snug">
                                    {city ? `Vi visar det först i ${city.name}.` : 'Vi visar det först där du är.'} Välj ingen så ser du allt.
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-2 justify-center">
                            {CATEGORY_KEYS.map(k => {
                                const on = kats.has(k);
                                return (
                                    <button
                                        key={k}
                                        type="button"
                                        aria-pressed={on}
                                        onClick={() => toggleKat(k)}
                                        className={`${chipBase} ${on ? 'bg-[#006AA7] text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                                    >
                                        <span aria-hidden className="mr-1">{EVENT_CATEGORIES[k].emoji}</span>
                                        {EVENT_CATEGORIES[k].label}
                                    </button>
                                );
                            })}
                        </div>

                        <button
                            type="button"
                            autoFocus
                            onClick={() => { track('startstad_done'); onDone({ city, kats: [...kats] }); }}
                            className="group w-full py-3.5 rounded-2xl bg-[#006AA7] hover:bg-[#005590] text-white font-black text-base shadow-lg shadow-[#006AA7]/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 outline-none focus-visible:ring-4 focus-visible:ring-[#FECC02]/70"
                        >
                            {kats.size > 0 ? 'Visa kartan' : 'Visa allt'}
                            <ArrowRight size={19} strokeWidth={2.5} className="transition-transform group-hover:translate-x-1" />
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}
