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
    /** KATEGORIN (Josef 2/9: "byte utan sidladdning") — datanyckeln
     *  ('family', 'music' …) eller null = alla. Sätts av CategoryChips ur
     *  URL:en; listan (och heron) filtrerar på den. På kategorisidan är
     *  raderna redan kategorifiltrerade av servern, så värdet är ofarligt. */
    category: string | null;
    setCategory: (c: string | null) => void;
    /** OPT-IN-KÄLLORNA (Josef 2/9): växeln på (OptInToggle) och de hämtade
     *  dagarna (stadens opt-in.json, serverns radform) som DayFilteredList
     *  syr in i listan. null = inte hämtat än. Alltid av vid SSR. */
    optIn: boolean;
    setOptIn: (on: boolean) => void;
    optInDays: OptInDay[] | null;
    setOptInDays: (d: OptInDay[] | null) => void;
};

/** Samma form som DayFilteredList:s ListedDay — typad löst här för att
 *  slippa en importcirkel (DayFilteredList importerar den här modulen). */
export type OptInDay = { key: string; label: string; short: string; hourCounts: number[]; events: unknown[] };

const DayFilterCtx = createContext<DayFilterState | null>(null);

export function DayFilterProvider({ children }: { children: ReactNode }) {
    const [sel, setSel] = useState<DaySel>({ kind: 'period', period: 'all' });
    const [hours, setHours] = useState<number[]>([]);
    const [category, setCategory] = useState<string | null>(null);
    const [optIn, setOptIn] = useState(false);
    const [optInDays, setOptInDays] = useState<OptInDay[] | null>(null);

    return (
        <DayFilterCtx.Provider value={{ sel, setSel, hours, setHours, category, setCategory, optIn, setOptIn, optInDays, setOptInDays }}>
            {children}
        </DayFilterCtx.Provider>
    );
}

export function useDayFilter(): DayFilterState {
    const ctx = useContext(DayFilterCtx);
    if (!ctx) throw new Error('useDayFilter kräver en DayFilterProvider runt sidan');
    return ctx;
}
