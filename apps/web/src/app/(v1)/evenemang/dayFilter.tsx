'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import type { Period } from './periods';

// Delat dagfilter för stads-/kategorisidorna: kart-heron och daglistan ska
// vara SAMMA filter — väljer man "Idag" på kartan filtreras listan, och
// tvärtom. Staten bor här i en provider som sidan lägger runt både heron och
// EventDayList; DayFilteredList äger inte längre sitt urval själv.
// (requestFocus-flödet — kart-popupens scrolla-till-raden — togs bort 30/8
// tillsammans med hero-popupen: brick-klick går numera till stora kartan.)

// ('nextHour'-varianten ("Nästa timmen"-chippen) togs bort 18/8 på ägarbeslut
// — onödig. Lägg inte tillbaka den.)
export type DaySel =
    | { kind: 'period'; period: Period }
    | { kind: 'day'; key: string };

type DayFilterState = {
    sel: DaySel;
    setSel: (s: DaySel) => void;
    hours: number[];
    setHours: (h: number[] | ((prev: number[]) => number[])) => void;
};

const DayFilterCtx = createContext<DayFilterState | null>(null);

export function DayFilterProvider({ children }: { children: ReactNode }) {
    const [sel, setSel] = useState<DaySel>({ kind: 'period', period: 'all' });
    const [hours, setHours] = useState<number[]>([]);

    return (
        <DayFilterCtx.Provider value={{ sel, setSel, hours, setHours }}>
            {children}
        </DayFilterCtx.Provider>
    );
}

export function useDayFilter(): DayFilterState {
    const ctx = useContext(DayFilterCtx);
    if (!ctx) throw new Error('useDayFilter kräver en DayFilterProvider runt sidan');
    return ctx;
}
