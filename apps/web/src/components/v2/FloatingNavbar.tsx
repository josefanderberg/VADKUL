'use client';

import { useState, useEffect, useRef } from 'react';
import { User, MessageSquare, Bell, Plus, Search, Calendar, ChevronRight, RotateCcw } from 'lucide-react';

interface FloatingNavbarProps {
    dayOffset: number;
    setDayOffset: (offset: number) => void;
}

export default function FloatingNavbar({ dayOffset, setDayOffset }: FloatingNavbarProps) {
    const [profileMenuOpen, setProfileMenuOpen] = useState(false);
    const profileMenuRef = useRef<HTMLDivElement>(null);

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
                            className="bg-white/90 backdrop-blur-md px-6 py-3 rounded-full shadow-lg hover:bg-white transition-all font-black text-sm uppercase tracking-widest flex items-center gap-3 text-slate-800"
                        >
                            <Calendar size={18} className="text-primary" />
                            <span>{getDayLabel(dayOffset)}</span>
                            <ChevronRight size={18} className="text-slate-400" />
                        </button>

                        {dayOffset !== 0 && (
                            <button 
                                onClick={handleResetToday}
                                className="bg-slate-800/90 backdrop-blur-md p-3 rounded-full shadow-lg hover:bg-slate-700 transition-colors"
                                title="Återställ till idag"
                            >
                                <RotateCcw size={18} className="text-white" />
                            </button>
                        )}
                    </div>

                    {/* Right side: Search, Plus, Profile */}
                    <div className="flex items-center gap-3 pointer-events-auto">
                        <button className="bg-white/90 backdrop-blur-md p-3 rounded-full shadow-lg hover:bg-white transition-colors">
                            <Search size={24} className="text-slate-800" />
                        </button>
                        <button className="bg-green-500 p-3 rounded-full shadow-lg hover:bg-green-400 transition-colors">
                            <Plus size={24} className="text-white" />
                        </button>

                        {/* Profile + kolumn-meny nedåt med Meddelanden och Notiser */}
                        <div className="relative" ref={profileMenuRef}>
                            <button
                                type="button"
                                onClick={() => setProfileMenuOpen(o => !o)}
                                className="bg-white/90 backdrop-blur-md p-3 rounded-full shadow-lg hover:bg-white transition-colors"
                                aria-label="Öppna profilmeny"
                                aria-expanded={profileMenuOpen}
                            >
                                <User size={24} className="text-slate-800" />
                            </button>

                            {profileMenuOpen && (
                                <div className="absolute right-0 top-full mt-3 flex flex-col gap-3 animate-in fade-in slide-in-from-top-2">
                                    <button
                                        className="bg-white/90 backdrop-blur-md p-3 rounded-full shadow-lg hover:bg-white transition-colors relative"
                                        title="Meddelanden"
                                    >
                                        <MessageSquare size={20} className="text-slate-800" />
                                        <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full"></span>
                                    </button>
                                    <button
                                        className="bg-white/90 backdrop-blur-md p-3 rounded-full shadow-lg hover:bg-white transition-colors relative"
                                        title="Notiser"
                                    >
                                        <Bell size={20} className="text-slate-800" />
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
