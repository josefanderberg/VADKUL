'use client';

import { useEffect, useState } from 'react';
import { ArrowRight, CalendarDays, Hand, Heart, Zap } from 'lucide-react';

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
            chip: 'bg-[#006AA7]/10',
            icon: <Hand size={19} className="text-[#006AA7]" />,
            text: <>Tryck <span className="font-bold text-slate-900">var som helst på kartan</span> för att upptäcka event nära dig.</>,
        },
        {
            chip: 'bg-[#006AA7]/10',
            icon: <CalendarDays size={19} className="text-[#006AA7]" />,
            text: <>Tusentals event varje vecka — konserter, marknader, sport &amp; kultur.</>,
        },
        {
            chip: 'bg-amber-100',
            icon: <Zap size={19} className="text-amber-500" />,
            text: <>Se vad som händer <span className="font-bold text-slate-900">just nu</span>, ikväll eller i helgen.</>,
        },
        {
            chip: 'bg-rose-100',
            icon: <Heart size={19} className="text-rose-500" />,
            text: <>Spara favoriter, dela med vänner &amp; skapa egna event.</>,
        },
    ];

    return (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => dismiss()} />
            <div className="relative w-full max-w-sm bg-white rounded-[28px] shadow-2xl p-7 flex flex-col gap-6 animate-in fade-in zoom-in-95 duration-300">
                <div className="flex flex-col items-center text-center gap-2.5">
                    <span className="grid place-items-center w-16 h-16 rounded-2xl bg-[#006AA7]/10 text-[34px] leading-none" aria-hidden>🗺️</span>
                    <div className="flex flex-col items-center gap-1">
                        <h2 className="text-[27px] font-black text-[#006AA7] tracking-tight leading-none">VADKUL</h2>
                        <p className="text-[15px] font-bold text-slate-600 leading-snug px-2">
                            Allt kul som händer i Sverige — samlat på en karta.
                        </p>
                    </div>
                </div>

                <ul className="flex flex-col gap-3.5">
                    {rows.map((row, i) => (
                        <li key={i} className="flex items-center gap-3">
                            <span className={`shrink-0 grid place-items-center w-9 h-9 rounded-xl ${row.chip}`}>{row.icon}</span>
                            <span className="text-[13.5px] font-semibold text-slate-600 leading-snug">{row.text}</span>
                        </li>
                    ))}
                </ul>

                <div className="flex flex-col gap-2">
                    <button
                        type="button"
                        onClick={() => dismiss()}
                        className="w-full py-3.5 rounded-2xl bg-[#006AA7] hover:bg-[#005590] text-white font-black text-base shadow-lg shadow-[#006AA7]/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                    >
                        Utforska kartan
                        <ArrowRight size={19} strokeWidth={2.5} />
                    </button>
                    <button
                        type="button"
                        onClick={() => dismiss(true)}
                        className="w-full py-2.5 rounded-2xl text-[#006AA7] hover:bg-slate-50 font-bold text-sm transition-colors"
                    >
                        Skapa gratis konto
                    </button>
                    <p className="text-center text-[11px] font-semibold text-slate-400 mt-0.5">
                        Gratis att utforska — inget konto behövs.
                    </p>
                </div>
            </div>
        </div>
    );
}
