'use client';

import { useEffect, useState } from 'react';
import { useDayFilter } from './dayFilter';
import { useAuth } from '@/context/AuthContext';
import { userService } from '@/services/userService';
import { SOURCE_DEFS } from '@/utils/sources';
import { CITY_OPT_IN_STORAGE_KEY, cityOptInDefault, cityOptInJsonHref } from '@/utils/cityOptIn';

// Växeln för OPT-IN-KÄLLORNA (Svenska kyrkan, PRO, Korpen) på stads- och
// kategorisidorna (Josef 2/9: "aa vi kan väl ha de också"). Sidornas HTML,
// siffror och metadata är utan dem (SEO-beslutet 1/9) — slås växeln på hämtas
// stadens opt-in.json (bakad per stad) och raderna sys in i daglistan
// (DayFilteredList via kontexten). Standard = kartans regel: av, på för
// inloggade 65+; ett eget tryck sparas i localStorage och vinner sedan.
// Kategorifiltret gäller även opt-in-raderna (de bär category).

const LABELS = SOURCE_DEFS.map(s => s.label);
const SOURCES_TEXT = `${LABELS.slice(0, -1).join(', ')} & ${LABELS[LABELS.length - 1]}`;

export default function OptInToggle({ citySlug }: { citySlug: string }) {
    const { optIn, setOptIn, optInDays, setOptInDays } = useDayFilter();
    const { user } = useAuth();
    const [total, setTotal] = useState<number | null>(null);
    const [status, setStatus] = useState<'idle' | 'loading' | 'failed'>('idle');

    // Standardläget efter mount (aldrig vid SSR): eget val i localStorage
    // vinner; annars 65+-regeln, som kräver profilens ålder (Firestore-läsning
    // — bara för inloggade, precis som kartan gör).
    useEffect(() => {
        let cancelled = false;
        let stored: string | null = null;
        try { stored = localStorage.getItem(CITY_OPT_IN_STORAGE_KEY); } catch { /* privat läge */ }
        if (stored === '1' || stored === '0' || !user) {
            setOptIn(cityOptInDefault(stored, !!user, undefined));
            return;
        }
        userService.getUserProfile(user.uid)
            .then(profile => {
                if (cancelled) return;
                const age = (profile as { age?: unknown } | null)?.age;
                setOptIn(cityOptInDefault(null, true, age));
            })
            .catch(() => { /* ingen profil → förblir av */ });
        return () => { cancelled = true; };
    }, [user, setOptIn]);

    // Hämta stadens opt-in-lista första gången växeln är på.
    useEffect(() => {
        if (!optIn || optInDays !== null || status === 'loading') return;
        let cancelled = false;
        setStatus('loading');
        fetch(cityOptInJsonHref(citySlug))
            .then(r => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
            .then((json: { total: number; days: unknown[] }) => {
                if (cancelled) return;
                setTotal(json.total);
                setOptInDays(json.days as never);
                setStatus('idle');
            })
            .catch(() => { if (!cancelled) setStatus('failed'); });
        return () => { cancelled = true; };
        // status medvetet utanför deps: effekten ska inte köras om av sin egen
        // 'loading'-skrivning, bara av att växeln slås på.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [optIn, optInDays, citySlug, setOptInDays]);

    const toggle = () => {
        const next = !optIn;
        setOptIn(next);
        if (next && status === 'failed') setStatus('idle'); // nytt försök
        try { localStorage.setItem(CITY_OPT_IN_STORAGE_KEY, next ? '1' : '0'); } catch { /* privat läge */ }
    };

    const suffix = optIn
        ? (status === 'loading' ? '…' : status === 'failed' ? '· kunde inte hämtas' : total !== null ? `· ${total}` : '')
        : '';

    return (
        <div className="mt-3">
            <button
                type="button"
                onClick={toggle}
                aria-pressed={optIn}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-bold transition-colors ${
                    optIn
                        ? 'bg-[#006AA7] border-[#006AA7] text-white'
                        : 'bg-white dark:bg-zinc-900 border-dashed border-slate-300 dark:border-zinc-700 text-slate-500 dark:text-zinc-400 hover:border-[#006AA7]/40 dark:hover:border-sky-400/40 hover:text-[#006AA7] dark:hover:text-sky-400'
                }`}
            >
                <span aria-hidden>{optIn ? '✓' : '+'}</span>
                {optIn ? `Med ${SOURCES_TEXT}` : `Visa även ${SOURCES_TEXT}`}
                {suffix && <span className={optIn ? 'text-white/70' : 'text-slate-400'}>{suffix}</span>}
            </button>
        </div>
    );
}
