'use client';

import { useState, useEffect, useRef } from 'react';
import { User, Plus, Search, X, Heart } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

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
}

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
}: FloatingNavbarProps) {
    const { user } = useAuth();
    const [searchOpen, setSearchOpen] = useState(false);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const plusBtnRef = useRef<HTMLButtonElement>(null);
    const animationRef = useRef<Animation | null>(null);
    const [plusDropping, setPlusDropping] = useState(false);

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

                {/* Top Row */}
                <div className="flex items-center gap-2 w-full">

                    {/* Vänster: profil i hörnet (väskan + funktioner ligger under,
                        renderade i V2Map). Inloggad → profilpanelen, annars login. */}
                    <div className="flex items-center pointer-events-auto shrink-0">
                        <button
                            type="button"
                            onClick={handleProfileClick}
                            className="bg-white/90 backdrop-blur-md p-2.5 rounded-full shadow-lg border border-white/50 hover:bg-white transition-colors relative"
                            aria-label={user ? 'Min profil' : 'Logga in'}
                        >
                            <User size={20} className="text-slate-700" />
                            {user && (
                                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#006AA7] rounded-full border border-white" />
                            )}
                        </button>
                    </div>

                    {/* Höger: sparade event + expanderbar sök + skapa event */}
                    <div className="flex items-center gap-2 flex-1 min-w-0 justify-end pointer-events-auto">
                        {/* Sparade event (hjärtan) — panel med allt man sparat */}
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
                        {/* Sök */}
                        {searchOpen ? (
                            <div className="flex items-center flex-1 min-w-0 max-w-[420px] bg-white/90 backdrop-blur-md rounded-full shadow-lg border border-white/50 px-3 py-2">
                                <Search size={15} className="text-slate-400 shrink-0 mr-2" />
                                <input
                                    ref={searchInputRef}
                                    type="text"
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    placeholder="Sök event..."
                                    aria-label="Sök event"
                                    className="flex-1 bg-transparent outline-none text-sm text-slate-800 placeholder:text-slate-400 min-w-0"
                                />
                                <button
                                    onClick={handleCloseSearch}
                                    className="ml-2 text-slate-400 hover:text-slate-600 transition-colors shrink-0"
                                >
                                    <X size={15} />
                                </button>
                            </div>
                        ) : (
                            // Hopfälld sök: samma 40px-storlek som lager- + funktions-
                            // knapparna, och order-last gör den ytterst till höger så den
                            // hamnar rakt ovanför lager-knappen (i linje med kolumnen).
                            // När söket öppnas tas order bort → input fyller som förut.
                            <button
                                onClick={() => setSearchOpen(true)}
                                className="order-last bg-white/90 backdrop-blur-md h-10 w-10 flex items-center justify-center rounded-full shadow-lg border border-white/50 hover:bg-white transition-colors shrink-0"
                                aria-label="Sök event"
                            >
                                <Search size={20} className="text-slate-700" />
                            </button>
                        )}

                        {/* +-knappen döljs medan söket är öppet — annars hamnar den
                            längst till höger exakt där sökknappen nyss satt, och man
                            råkar trycka på den när man egentligen ville söka.
                            UNDANTAG: i placerings-läget är plusset bekräfta-knappen
                            och måste alltid synas, och mitt i drop-animationen får
                            den inte unmountas (då fastnar plusDropping-låset). */}
                        {creationMode !== 'editing' && createEventEnabled && (!searchOpen || creationMode === 'placing' || plusDropping) && (
                            <button
                                ref={plusBtnRef}
                                type="button"
                                onClick={handlePlusClick}
                                disabled={plusDropping}
                                aria-label={creationMode === 'placing' ? 'Välj denna plats' : 'Skapa nytt event'}
                                className="bg-[#006AA7] hover:bg-[#005590] w-11 h-11 rounded-full shadow-lg border border-white/20 active:scale-95 transition-all flex items-center justify-center relative z-[1100] shrink-0"
                            >
                                <Plus size={22} className="text-white" />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
