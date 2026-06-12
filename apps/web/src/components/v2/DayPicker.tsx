'use client';

import { useEffect, useRef } from 'react';
import { CalendarDays, Check } from 'lucide-react';

export interface DayRange { offset: number; days: number; }

/**
 * Helgens intervall relativt idag: fre–sön. Mitt i helgen → resten av helgen
 * (lör → lör+sön, sön → bara idag).
 */
export function weekendRange(): DayRange {
    const dow = new Date().getDay(); // 0 = söndag
    if (dow === 6) return { offset: 0, days: 2 };
    if (dow === 0) return { offset: 0, days: 1 };
    return { offset: 5 - dow, days: 3 };
}

interface DayPickerProps {
    dayOffset: number;
    dayRangeDays: number;
    /** Knappen som öppnade popovern — klick på den ska INTE räknas som
     *  "utanför" (annars stänger mousedown + återöppnar click = toggle-race). */
    anchorRef?: React.RefObject<HTMLElement | null>;
    onPick: (offset: number, days: number) => void;
    onClose: () => void;
}

/**
 * Popover ovanför dagchippen: snabbval (Idag/Imorgon/Hela veckan)
 * plus fritt datum. Veckan är ett INTERVALL — kartan och kortleken
 * visar då alla dagar i spannet.
 */
export default function DayPicker({ dayOffset, dayRangeDays, anchorRef, onPick, onClose }: DayPickerProps) {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const onDown = (e: MouseEvent) => {
            const t = e.target as Node;
            if (ref.current?.contains(t) || anchorRef?.current?.contains(t)) return;
            onClose();
        };
        document.addEventListener('mousedown', onDown);
        return () => document.removeEventListener('mousedown', onDown);
    }, [onClose, anchorRef]);

    // "I helgen" borttaget ur UI:t (kraschade). weekendRange() bevaras som
    // datalager-logik om vi vill återinföra valet senare.
    const uniqueOptions: { label: string; offset: number; days: number }[] = [
        { label: 'Idag', offset: 0, days: 1 },
        { label: 'Imorgon', offset: 1, days: 1 },
        { label: 'Hela veckan', offset: 0, days: 7 },
    ];

    const pad = (n: number) => String(n).padStart(2, '0');
    const toInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() + dayOffset);

    const handleDate = (value: string) => {
        if (!value) return;
        const picked = new Date(`${value}T00:00:00`);
        if (Number.isNaN(picked.getTime())) return;
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const offset = Math.round((picked.getTime() - startOfToday.getTime()) / 86_400_000);
        onPick(offset, 1);
    };

    return (
        <div
            ref={ref}
            className="absolute bottom-full mb-2 left-0 w-60 rounded-2xl bg-white/95 backdrop-blur-md border border-white/60 shadow-2xl p-1.5 z-[1100] animate-in fade-in slide-in-from-bottom-2 duration-150"
        >
            {uniqueOptions.map(opt => {
                const active = dayOffset === opt.offset && dayRangeDays === opt.days;
                return (
                    <button
                        key={opt.label}
                        type="button"
                        onClick={() => onPick(opt.offset, opt.days)}
                        className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-bold transition-colors ${
                            active ? 'bg-[#006AA7] text-white' : 'text-slate-700 hover:bg-slate-100'
                        }`}
                    >
                        <span>{opt.label}</span>
                        {active && <Check size={15} className="shrink-0" />}
                    </button>
                );
            })}
            <div className="border-t border-slate-100 mt-1.5 pt-1.5">
                <label className="flex items-center gap-2 px-3.5 py-2 cursor-pointer">
                    <CalendarDays size={15} className="text-[#006AA7] shrink-0" />
                    <input
                        type="date"
                        min={toInput(new Date())}
                        value={toInput(startDate)}
                        onChange={e => handleDate(e.target.value)}
                        className="flex-1 min-w-0 bg-transparent outline-none text-sm font-semibold text-slate-700 cursor-pointer"
                        aria-label="Välj datum"
                    />
                </label>
            </div>
        </div>
    );
}
