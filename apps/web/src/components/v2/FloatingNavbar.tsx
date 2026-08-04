'use client';

import { useState, useEffect, useRef } from 'react';
import { User, Plus, Search, X, Heart, Calendar, ChevronDown } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import DayPicker from './DayPicker';

interface FloatingNavbarProps {
    creationMode?: 'idle' | 'placing' | 'editing';
    /** När false → +-knappen renderas inte alls (shop-flaggan "Skapa event"
     *  är avaktiverad). Default true så befintliga kallningar inte ändras. */
    createEventEnabled?: boolean;
    onStartCreate?: () => void;
    onConfirmPlacement?: () => void;
    searchQuery: string;
    setSearchQuery: (q: string) => void;
    /** Öppna inloggningsmodalen (utan att lämna kartan). */
    onLoginClick?: () => void;
    /** Inloggad: profilknappen öppnar profilpanelen (allt konto-relaterat). */
    onOpenProfile?: () => void;
    /** Antal sparade event — visas som badge på hjärtknappen. */
    savedCount?: number;
    /** Öppna/stäng panelen med sparade event. */
    onToggleSaved?: () => void;
    dayOffset?: number;
    dayRangeDays?: number;
    onDayRangeChange?: (offset: number, days: number) => void;
    /** True när kartan är inzoomad till stadsnivå → "Hela veckan" låses upp i
     *  dagväljaren (utzoomad vecka = tusentals brickor, ingen klustring). */
    weekUnlocked?: boolean;
    dayCount?: number;
    eventsLoaded?: boolean;
    /** Sant först när aggregaten (de scrapade eventen) landat. Innan dess visar
     *  badgen "…" — annars stod det "1 event" (bara sajtens egna, som kommer via
     *  en snabbare poll) i flera sekunder innan riktiga antalet hoppade in. */
    dayCountReady?: boolean;
}

const getDayLabel = (offset: number, days = 1) => {
    const capitalize = (s: string) => s.replace(/^\w/, (c) => c.toUpperCase());
    if (days > 1) {
        const start = new Date(); start.setDate(start.getDate() + offset);
        const end = new Date(start); end.setDate(end.getDate() + days - 1);
        if (end.getDay() === 0 && days <= 3) return 'I helgen';
        if (offset === 0 && days === 7) return 'Hela veckan';
        const fmt = (d: Date) => d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' }).replace('.', '');
        return `${fmt(start)}–${fmt(end)}`;
    }
    if (offset === 0) return 'Idag';
    if (offset === 1) return 'Imorgon';
    if (offset === -1) return 'Igår';
    const date = new Date();
    date.setDate(date.getDate() + offset);
    if (offset > 6 || offset < 0) {
        return capitalize(date.toLocaleDateString('sv-SE', { weekday: 'short', day: 'numeric', month: 'short' }).replace('.', ''));
    }
    return capitalize(date.toLocaleDateString('sv-SE', { weekday: 'long' }));
};

export default function FloatingNavbar({
    creationMode = 'idle',
    createEventEnabled = true,
    onStartCreate,
    onConfirmPlacement,
    searchQuery,
    setSearchQuery,
    onLoginClick,
    onOpenProfile,
    savedCount = 0,
    onToggleSaved,
    dayOffset = 0,
    dayRangeDays = 1,
    onDayRangeChange,
    weekUnlocked = false,
    dayCount = 0,
    eventsLoaded = true,
    dayCountReady = true,
}: FloatingNavbarProps) {
    const { user } = useAuth();
    const [searchOpen, setSearchOpen] = useState(false);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const plusBtnRef = useRef<HTMLButtonElement>(null);
    const animationRef = useRef<Animation | null>(null);
    const [plusDropping, setPlusDropping] = useState(false);
    const [dayPickerOpen, setDayPickerOpen] = useState(false);
    const dayChipRef = useRef<HTMLButtonElement>(null);

    // Fokusera sökfältet när det öppnas
    useEffect(() => {
        if (searchOpen) {
            setTimeout(() => searchInputRef.current?.focus(), 50);
        }
    }, [searchOpen]);

    // Avbryt plus-animation när creationMode återgår till idle
    useEffect(() => {
        if (creationMode === 'idle' && animationRef.current) {
            animationRef.current.cancel();
            animationRef.current = null;
            setPlusDropping(false);
        }
    }, [creationMode]);

    const handlePlusClick = () => {
        if (creationMode === 'placing') {
            onConfirmPlacement?.();
            return;
        }
        if (plusDropping || creationMode !== 'idle') return;
        const btn = plusBtnRef.current;
        if (!btn) return;
        const rect = btn.getBoundingClientRect();
        const dx = window.innerWidth / 2 - (rect.left + rect.width / 2);
        const dy = window.innerHeight / 2 - (rect.top + rect.height / 2);

        setPlusDropping(true);

        const animation = btn.animate(
            [
                { transform: 'translate(0px, 0px)', easing: 'ease-in-out' },
                { transform: `translate(0px, ${dy}px)`, offset: 0.5, easing: 'ease-in-out' },
                { transform: `translate(${dx}px, ${dy}px)` },
            ],
            { duration: 800, fill: 'forwards' },
        );
        animationRef.current = animation;
        animation.onfinish = () => {
            onStartCreate?.();
            setPlusDropping(false);
        };
    };

    // Inloggad → profilpanelen (allt konto-relaterat på kartan).
    // Utloggad → inloggningsmodalen. Ingen lämnar kartan längre.
    const handleProfileClick = () => {
        if (user) {
            onOpenProfile?.();
        } else {
            onLoginClick?.();
        }
    };

    const handleCloseSearch = () => {
        setSearchOpen(false);
        setSearchQuery('');
    };

    return (
        <div className="absolute top-6 left-0 right-0 z-[1000] px-4 pointer-events-none">
            <div className="flex flex-col gap-3 w-full max-w-[1400px] mx-auto">

                {/* Top Row. På största brytpunkten (2xl) lämnar vi plats längst till
                    höger åt kategorifiltret som då hoppar upp på den här raden
                    (CategoryFilter, samma max-w-[1400px]-container). */}
                <div className="relative flex items-center gap-2 w-full 2xl:pr-[56px]">

                    {/* Vänster: profil + hjärtat (sparade) direkt höger om profilen.
                        Väskan/funktioner ligger under, renderade i V2Map. */}
                    <div className="flex items-center gap-2 pointer-events-auto shrink-0">
                        <button
                            type="button"
                            onClick={handleProfileClick}
                            className={`bg-white/90 backdrop-blur-md rounded-full shadow-lg border border-white/50 hover:bg-white transition-colors relative ${user?.photoURL ? 'p-0.5' : 'p-2.5'}`}
                            aria-label={user ? 'Min profil' : 'Logga in'}
                        >
                            {user?.photoURL ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={user.photoURL} alt="" className="w-9 h-9 rounded-full object-cover" />
                            ) : (
                                <User size={20} className="text-slate-700" />
                            )}
                            {user && !user.photoURL && (
                                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#006AA7] rounded-full border border-white" />
                            )}
                        </button>
                        {/* Sparade event (hjärtan) — direkt höger om profilen */}
                        {onToggleSaved && (
                            <button
                                type="button"
                                onClick={onToggleSaved}
                                aria-label="Sparade event"
                                className="relative bg-white/90 backdrop-blur-md h-10 w-10 flex items-center justify-center rounded-full shadow-lg border border-white/50 hover:bg-white transition-colors shrink-0"
                            >
                                <Heart
                                    size={19}
                                    className="text-rose-500"
                                    fill={savedCount > 0 ? 'currentColor' : 'none'}
                                />
                                {savedCount > 0 && (
                                    <span className="absolute -top-1.5 -right-1.5 bg-[#006AA7] text-white text-[10px] font-black tabular-nums min-w-[18px] h-[18px] px-1 rounded-full border-2 border-white flex items-center justify-center leading-none">
                                        {savedCount > 99 ? '99+' : savedCount}
                                    </span>
                                )}
                            </button>
                        )}
                    </div>

                    {/* Dagväljaren — CENTRERAD högst upp på skärmen (absolut, så den
                        ligger mitt i vyn oavsett knapparna till vänster/höger). */}
                    {onDayRangeChange && (
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-auto z-10">
                            <div className="relative">
                                <button
                                    ref={dayChipRef}
                                    type="button"
                                    onClick={() => setDayPickerOpen(o => !o)}
                                    aria-expanded={dayPickerOpen}
                                    aria-label="Välj dag eller period"
                                    className="bg-white/90 backdrop-blur-md px-3 rounded-full shadow-lg border-2 border-[#FECC02] hover:bg-white transition-all font-semibold text-sm tracking-wide flex items-center gap-1.5 text-slate-700 h-10 box-border"
                                >
                                    <Calendar size={15} className="text-[#006AA7] shrink-0" />
                                    <span>{getDayLabel(dayOffset, dayRangeDays)}</span>
                                    <ChevronDown size={15} className={`text-slate-400 transition-transform duration-200 ${dayPickerOpen ? 'rotate-180' : ''}`} />
                                </button>
                                <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 bg-[#006AA7] text-white text-[9px] font-black tabular-nums px-1.5 h-[16px] rounded-full shadow border border-white flex items-center justify-center leading-none pointer-events-none">
                                    {eventsLoaded && dayCountReady ? dayCount : '…'}
                                </span>
                                {dayPickerOpen && (
                                    <DayPicker
                                        dayOffset={dayOffset}
                                        dayRangeDays={dayRangeDays}
                                        weekUnlocked={weekUnlocked}
                                        anchorRef={dayChipRef}
                                        onPick={(offset, days) => { onDayRangeChange(offset, days); setDayPickerOpen(false); }}
                                        onClose={() => setDayPickerOpen(false)}
                                    />
                                )}
                            </div>
                        </div>
                    )}

                    {/* Höger: expanderbar sök + skapa event. Containern är
                        pointer-events-none (den är flex-1 + justify-end → dess TOMMA
                        vänsterdel täckte kartbandet under navbaren och slukade klick).
                        Varje faktisk kontroll nedan sätter pointer-events-auto själv. */}
                    <div className="flex items-center gap-2 flex-1 min-w-0 justify-end pointer-events-none">
                        {/* Sök. Öppet läge expanderar från högerkanten som förut,
                            men ligger ÖVER allt annat i navbaren (z-[1200] >
                            plussets 1100 > dagchipens 10) med SOLID vit bakgrund —
                            förut hamnade fältet under dagväljaren så man inte såg
                            det man skrev; nu täcker det chipen medan man söker. */}
                        {searchOpen ? (
                            <div className="relative z-[1200] flex items-center flex-1 min-w-0 max-w-[520px] bg-white rounded-full shadow-xl border border-white/50 px-4 h-10 pointer-events-auto">
                                <Search size={16} className="text-slate-400 shrink-0 mr-2" />
                                <input
                                    ref={searchInputRef}
                                    type="text"
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    placeholder="Sök event..."
                                    aria-label="Sök event"
                                    className="flex-1 bg-transparent outline-none text-base text-slate-800 placeholder:text-slate-400 min-w-0"
                                />
                                <button
                                    onClick={handleCloseSearch}
                                    className="ml-2 text-slate-400 hover:text-slate-600 transition-colors shrink-0"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        ) : (
                            // Hopfälld sök: samma 40px-storlek som övriga runda knappar.
                            // Ligger VÄNSTER om plusset — plusset är ytterst i hörnet,
                            // rakt ovanför kategorifilter-knappen (i linje med kolumnen).
                            <button
                                onClick={() => setSearchOpen(true)}
                                className="bg-white/90 backdrop-blur-md h-10 w-10 flex items-center justify-center rounded-full shadow-lg border border-white/50 hover:bg-white transition-colors shrink-0 pointer-events-auto"
                                aria-label="Sök event"
                            >
                                <Search size={20} className="text-slate-700" />
                            </button>
                        )}

                        {/* +-knappen (ytterst i hörnet) döljs medan söket är öppet —
                            input-fältet får hela bredden och man råkar inte starta
                            skapa-event-flödet när man siktar på sökfältet.
                            UNDANTAG: i placerings-läget är plusset bekräfta-knappen
                            och måste alltid synas, och mitt i drop-animationen får
                            den inte unmountas (då fastnar plusDropping-låset). */}
                        {creationMode !== 'editing' && createEventEnabled && (!searchOpen || creationMode === 'placing' || plusDropping) && (
                            <button
                                ref={plusBtnRef}
                                type="button"
                                onClick={handlePlusClick}
                                disabled={plusDropping}
                                aria-label={creationMode === 'placing' ? 'Välj denna plats' : 'Lägg in eget event på kartan'}
                                title={creationMode === 'placing' ? 'Välj denna plats' : 'Lägg in eget event på kartan'}
                                className="bg-[#006AA7] hover:bg-[#005590] w-10 h-10 rounded-full shadow-lg border border-white/20 active:scale-95 transition-all flex items-center justify-center relative z-[1100] shrink-0 pointer-events-auto"
                            >
                                <Plus size={20} className="text-white" />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
