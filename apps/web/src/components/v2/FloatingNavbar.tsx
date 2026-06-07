'use client';

import { useState, useEffect, useRef } from 'react';
import { User, Plus, Search, X, LogOut, Store } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

interface FloatingNavbarProps {
    creationMode?: 'idle' | 'placing' | 'editing';
    onStartCreate?: () => void;
    onConfirmPlacement?: () => void;
    searchQuery: string;
    setSearchQuery: (q: string) => void;
}

export default function FloatingNavbar({
    creationMode = 'idle',
    onStartCreate,
    onConfirmPlacement,
    searchQuery,
    setSearchQuery,
}: FloatingNavbarProps) {
    const router = useRouter();
    const { user, logout } = useAuth();
    const [searchOpen, setSearchOpen] = useState(false);
    const [profileMenuOpen, setProfileMenuOpen] = useState(false);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const profileMenuRef = useRef<HTMLDivElement>(null);
    const plusBtnRef = useRef<HTMLButtonElement>(null);
    const animationRef = useRef<Animation | null>(null);
    const [plusDropping, setPlusDropping] = useState(false);

    // Fokusera sökfältet när det öppnas
    useEffect(() => {
        if (searchOpen) {
            setTimeout(() => searchInputRef.current?.focus(), 50);
        }
    }, [searchOpen]);

    // Stäng profilmeny vid klick utanför
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
                setProfileMenuOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

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

    const handleProfileClick = () => {
        if (user) {
            setProfileMenuOpen(o => !o);
        } else {
            router.push('/login');
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

                    {/* Vänster: expanderbar sök */}
                    <div className="flex items-center gap-2 flex-1 min-w-0 pointer-events-auto">


                        {/* Sök */}
                        {searchOpen ? (
                            <div className="flex items-center flex-1 min-w-0 bg-white/90 backdrop-blur-md rounded-full shadow-lg border border-white/50 px-3 py-2">
                                <Search size={15} className="text-slate-400 shrink-0 mr-2" />
                                <input
                                    ref={searchInputRef}
                                    type="text"
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    placeholder="Sök event..."
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
                            <button
                                onClick={() => setSearchOpen(true)}
                                className="bg-white/90 backdrop-blur-md p-2.5 rounded-full shadow-lg border border-white/50 hover:bg-white transition-colors"
                            >
                                <Search size={18} className="text-slate-700" />
                            </button>
                        )}
                    </div>

                    {/* Höger: plus + profil */}
                    <div className="flex items-center gap-2 pointer-events-auto shrink-0">
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

                        {/* Profil / inloggning */}
                        <div className="relative" ref={profileMenuRef}>
                            <button
                                type="button"
                                onClick={handleProfileClick}
                                className="bg-white/90 backdrop-blur-md p-2.5 rounded-full shadow-lg border border-white/50 hover:bg-white transition-colors relative"
                                aria-label={user ? 'Profilmeny' : 'Logga in'}
                            >
                                <User size={20} className="text-slate-700" />
                                {user && (
                                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#006AA7] rounded-full border border-white" />
                                )}
                            </button>

                            {profileMenuOpen && user && (
                                <div className="absolute right-0 top-full mt-2 bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-white/50 overflow-hidden min-w-[160px]">
                                    <div className="px-4 py-3 border-b border-slate-100">
                                        <p className="text-xs text-slate-500">Inloggad som</p>
                                        <p className="text-sm font-semibold text-slate-800 truncate">{user.displayName || user.email}</p>
                                    </div>
                                    <button
                                        onClick={() => { router.push('/shop'); setProfileMenuOpen(false); }}
                                        className="w-full flex items-center gap-2 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 transition-colors border-b border-slate-100"
                                    >
                                        <Store size={15} />
                                        Funktioner & Shop
                                    </button>
                                    <button
                                        onClick={async () => { await logout(); setProfileMenuOpen(false); }}
                                        className="w-full flex items-center gap-2 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                                    >
                                        <LogOut size={15} />
                                        Logga ut
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
