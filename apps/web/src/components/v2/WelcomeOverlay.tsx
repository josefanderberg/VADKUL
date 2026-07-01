'use client';

import { useEffect, useState } from 'react';
import { CalendarDays, Hand, Heart, MapPinned } from 'lucide-react';

const SEEN_KEY = 'vadkul_seen_welcome_v2';

interface WelcomeOverlayProps {
    /** Öppna kontoskaparen (AuthModal) — anropas från sekundärknappen. */
    onCreateAccount: () => void;
}

/**
 * Slimmad onboarding vid första besöket: EN skärm som säger vad VADKUL är och
 * släpper ut användaren på kartan. Visas aldrig igen (localStorage-flagga).
 */
export default function WelcomeOverlay({ onCreateAccount }: WelcomeOverlayProps) {
    const [open, setOpen] = useState(false);

    useEffect(() => {
        try {
            if (!localStorage.getItem(SEEN_KEY)) setOpen(true);
        } catch { /* localStorage blockerad — visa inget */ }
    }, []);

    const dismiss = (thenCreateAccount = false) => {
        try { localStorage.setItem(SEEN_KEY, 'true'); } catch { /* ok */ }
        setOpen(false);
        if (thenCreateAccount) onCreateAccount();
    };

    if (!open) return null;

    const rows = [
        {
            icon: <Hand size={18} className="text-[#006AA7] shrink-0" />,
            text: 'Tryck på kartan för att upptäcka event runt omkring dig.',
        },
        {
            icon: <CalendarDays size={18} className="text-[#006AA7] shrink-0" />,
            text: 'Tusentals event varje vecka — konserter, marknader, sport och kultur.',
        },
        {
            icon: <MapPinned size={18} className="text-[#006AA7] shrink-0" />,
            text: 'Se vad som händer nära dig — idag, ikväll eller i helgen.',
        },
        {
            icon: <Heart size={18} className="text-rose-500 shrink-0" />,
            text: 'Spara favoriter, dela med vänner och skapa egna event.',
        },
    ];

    return (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" onClick={() => dismiss()} />
            <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl p-7 flex flex-col gap-5 animate-in fade-in zoom-in-95 duration-300">
                <div className="flex flex-col items-center text-center gap-1.5">
                    <span className="text-4xl" aria-hidden>🗺️</span>
                    <h2 className="text-2xl font-black text-[#006AA7] tracking-tight">VADKUL</h2>
                    <p className="text-sm font-bold text-slate-600">Allt som händer i Sverige — på en karta.</p>
                </div>

                <ul className="flex flex-col gap-3">
                    {rows.map((row, i) => (
                        <li key={i} className="flex items-start gap-3">
                            <span className="mt-0.5">{row.icon}</span>
                            <span className="text-sm font-semibold text-slate-700 leading-snug">{row.text}</span>
                        </li>
                    ))}
                </ul>

                <div className="flex flex-col gap-2">
                    <button
                        type="button"
                        onClick={() => dismiss()}
                        className="w-full py-3.5 rounded-2xl bg-[#006AA7] hover:bg-[#005590] text-white font-black text-base shadow-lg active:scale-[0.98] transition-all"
                    >
                        Utforska kartan
                    </button>
                    <button
                        type="button"
                        onClick={() => dismiss(true)}
                        className="w-full py-2.5 rounded-2xl text-[#006AA7] hover:bg-slate-50 font-bold text-sm transition-colors"
                    >
                        Skapa gratis konto
                    </button>
                </div>
            </div>
        </div>
    );
}
