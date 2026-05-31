'use client';

import { useState, useEffect, useRef } from 'react';
import { User, MessageSquare, Bell, Plus, Search, Calendar, ChevronRight, RotateCcw } from 'lucide-react';

interface FloatingNavbarProps {
    dayOffset: number;
    setDayOffset: (offset: number) => void;
    creationMode?: 'idle' | 'placing' | 'editing';
    onStartCreate?: () => void;
    onConfirmPlacement?: () => void;
    highlightToday?: boolean;
}

export default function FloatingNavbar({ dayOffset, setDayOffset, creationMode = 'idle', onStartCreate, onConfirmPlacement, highlightToday = false }: FloatingNavbarProps) {
    const [profileMenuOpen, setProfileMenuOpen] = useState(false);
    const profileMenuRef = useRef<HTMLDivElement>(null);
    const plusBtnRef = useRef<HTMLButtonElement>(null);
    const animationRef = useRef<Animation | null>(null);
    const [plusDropping, setPlusDropping] = useState(false);

    // När create-flödet avbryts/avslutas (creationMode → 'idle'), avbryt WAAPI-animationen
    // så att knappen snäpper tillbaka till sin ursprungliga position i navbaren.
    useEffect(() => {
        if (creationMode === 'idle' && animationRef.current) {
            animationRef.current.cancel();
            animationRef.current = null;
            setPlusDropping(false);
        }
    }, [creationMode]);

    const handlePlusClick = () => {
        // I 'placing'-läget: klicket bekräftar platsvalet → modal öppnas via parent.
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

        // Web Animations API: kurvad bana med rotation från + till X. fill:forwards
        // håller kvar slutläget (mitt på skärmen, roterad 45°) tills animationen avbryts.
        const animation = btn.animate(
            [
                { transform: 'translate(0px, 0px)', easing: 'ease-in-out' },
                { transform: `translate(0px, ${dy}px)`, offset: 0.5, easing: 'ease-in-out' },
                { transform: `translate(${dx}px, ${dy}px)` },
            ],
            {
                duration: 800,
                fill: 'forwards',
            },
        );
        animationRef.current = animation;

        animation.onfinish = () => {
            onStartCreate?.();
            setPlusDropping(false);
        };
    };

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
                setProfileMenuOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const getDayLabel = (offset: number) => {
        if (offset === 0) return 'Idag';
        if (offset === 1) return 'Imorgon';
        
        const date = new Date();
        date.setDate(date.getDate() + offset);
        return date.toLocaleDateString('sv-SE', { weekday: 'long' }).replace(/^\w/, (c) => c.toUpperCase());
    };

    const handleCycleDay = () => {
        // Cycle from 0 (Today) up to 6 (7 days total), then back to 0
        setDayOffset((dayOffset + 1) % 7);
    };

    const handleResetToday = () => {
        setDayOffset(0);
    };

    return (
        <div className="absolute top-6 left-0 right-0 z-[1000] px-4 pointer-events-none">
            <div className="flex flex-col gap-3 w-full max-w-[1400px] mx-auto">
                
                {/* Top Row */}
                <div className="flex justify-between items-center w-full">
                    {/* Left side: Single Cycle Day Filter */}
                    <div className="flex items-center gap-3 pointer-events-auto">
                        <button
                            onClick={handleCycleDay}
                            className={`bg-white/90 backdrop-blur-md px-5 py-2.5 rounded-full shadow-lg border border-white/50 hover:bg-white transition-all font-semibold text-sm tracking-wide flex items-center gap-2.5 text-slate-700 ${highlightToday ? 'animate-today-pulse' : ''}`}
                        >
                            <Calendar size={16} className="text-primary shrink-0" />
                            <span>{getDayLabel(dayOffset)}</span>
                            <ChevronRight size={16} className="text-slate-400" />
                        </button>

                        {dayOffset !== 0 && (
                            <button
                                onClick={handleResetToday}
                                className="bg-white/90 backdrop-blur-md p-2.5 rounded-full shadow-lg border border-white/50 hover:bg-white transition-colors"
                                title="Återställ till idag"
                            >
                                <RotateCcw size={16} className="text-slate-700" />
                            </button>
                        )}
                    </div>

                    {/* Right side: Search, Plus, Profile */}
                    <div className="flex items-center gap-3 pointer-events-auto">
                        <button className="bg-white/90 backdrop-blur-md p-2.5 rounded-full shadow-lg border border-white/50 hover:bg-white transition-colors">
                            <Search size={20} className="text-slate-700" />
                        </button>
                        {creationMode !== 'editing' && (
                            <button
                                ref={plusBtnRef}
                                type="button"
                                onClick={handlePlusClick}
                                disabled={plusDropping}
                                aria-label={creationMode === 'placing' ? 'Välj denna plats' : 'Skapa nytt event'}
                                className="bg-[#006AA7] hover:bg-[#005590] w-11 h-11 rounded-full shadow-lg border border-white/20 active:scale-95 transition-all flex items-center justify-center relative z-[1100]"
                            >
                                <Plus size={22} className="text-white" />
                            </button>
                        )}

                        {/* Profile + kolumn-meny nedåt med Meddelanden och Notiser */}
                        <div className="relative" ref={profileMenuRef}>
                            <button
                                type="button"
                                onClick={() => setProfileMenuOpen(o => !o)}
                                className="bg-white/90 backdrop-blur-md p-2.5 rounded-full shadow-lg border border-white/50 hover:bg-white transition-colors"
                                aria-label="Öppna profilmeny"
                                aria-expanded={profileMenuOpen}
                            >
                                <User size={20} className="text-slate-700" />
                            </button>

                            {profileMenuOpen && (
                                <div className="absolute right-0 top-full mt-3 flex flex-col gap-2.5 animate-in fade-in slide-in-from-top-2">
                                    <button
                                        className="bg-white/90 backdrop-blur-md p-2.5 rounded-full shadow-lg border border-white/50 hover:bg-white transition-colors relative"
                                        title="Meddelanden"
                                    >
                                        <MessageSquare size={18} className="text-slate-700" />
                                        <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full"></span>
                                    </button>
                                    <button
                                        className="bg-white/90 backdrop-blur-md p-2.5 rounded-full shadow-lg border border-white/50 hover:bg-white transition-colors relative"
                                        title="Notiser"
                                    >
                                        <Bell size={18} className="text-slate-700" />
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
