'use client';

import { createContext, useContext, useState, useTransition, type ReactNode } from 'react';
import type { Period } from './periods';

// Delat dagfilter för stads-/kategorisidorna: kart-heron och daglistan ska
// vara SAMMA filter — väljer man "Idag" på kartan filtreras listan, och
// tvärtom. Staten bor här i en provider som sidan lägger runt både heron och
// EventDayList; DayFilteredList äger inte längre sitt urval själv.
//
// requestFocus är kartans väg IN i listan: klick på ett event i kart-popupen
// VÄLJER eventets dag direkt här (då finns raden garanterat — dagurvalet blir
// den enda dagen) och listan scrollar till raden och blinkar den
// (DayFilteredList). Noncen gör att samma event kan fokuseras två gånger i
// rad. Dagbytet körs som transition — det ritar om hela daglistan och får
// inte blockera tappen.

// ('nextHour'-varianten ("Nästa timmen"-chippen) togs bort 18/8 på ägarbeslut
// — onödig. Lägg inte tillbaka den.)
export type DaySel =
    | { kind: 'period'; period: Period }
    | { kind: 'day'; key: string };

export type FocusRequest = { id: string; dayKey: string; nonce: number };

type DayFilterState = {
    sel: DaySel;
    setSel: (s: DaySel) => void;
    hours: number[];
    setHours: (h: number[] | ((prev: number[]) => number[])) => void;
    focus: FocusRequest | null;
    requestFocus: (id: string, dayKey: string) => void;
    clearFocus: () => void;
};

const DayFilterCtx = createContext<DayFilterState | null>(null);

export function DayFilterProvider({ children }: { children: ReactNode }) {
    const [sel, setSel] = useState<DaySel>({ kind: 'period', period: 'all' });
    const [hours, setHours] = useState<number[]>([]);
    const [focus, setFocus] = useState<FocusRequest | null>(null);
    const [, startTransition] = useTransition();

    const requestFocus = (id: string, dayKey: string) =>
        startTransition(() => {
            // Välj dagen och släpp timfiltret HÄR (inte i en effekt i listan)
            // — raden ska finnas i urvalet innan scrollen letar efter den.
            setSel({ kind: 'day', key: dayKey });
            setHours([]);
            setFocus(prev => ({ id, dayKey, nonce: (prev?.nonce ?? 0) + 1 }));
        });

    return (
        <DayFilterCtx.Provider value={{
            sel, setSel, hours, setHours,
            focus, requestFocus, clearFocus: () => setFocus(null),
        }}>
            {children}
        </DayFilterCtx.Provider>
    );
}

export function useDayFilter(): DayFilterState {
    const ctx = useContext(DayFilterCtx);
    if (!ctx) throw new Error('useDayFilter kräver en DayFilterProvider runt sidan');
    return ctx;
}
