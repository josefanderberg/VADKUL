'use client';

import { useEffect, useState } from 'react';
import { X, Download, Share, SquarePlus, EllipsisVertical } from 'lucide-react';
import {
    detectInstallPlatform,
    installGuide,
    shouldOfferInstall,
    INSTALL_SNOOZE_MS,
    type InstallGuide,
} from '@/utils/installPrompt';

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISSED_KEY = 'pwa-install-dismissed';
const SNOOZE_KEY = 'pwa-install-snooze-until';

// Två vägar till hemskärmen, båda så automatiska som webbläsarna tillåter:
//  1. Chromium (Chrome/Edge/Samsung): beforeinstallprompt fångas → knappen
//     öppnar systemets install-ruta direkt. EN tapp, inget mer.
//  2. iOS (alla webbläsare) + Firefox/Android: inget API finns — knappen
//     öppnar en guide med exakt de steg som gäller just den webbläsaren
//     (detectInstallPlatform i utils/installPrompt).
export default function InstallPrompt() {
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [showPrompt, setShowPrompt] = useState(false);
    const [manualGuide, setManualGuide] = useState<InstallGuide | null>(null);
    const [showGuide, setShowGuide] = useState(false);

    useEffect(() => {
        let visits = 0;
        let dismissedForever = false;
        let snoozedUntil: number | null = null;
        try {
            visits = parseInt(localStorage.getItem('vadkul_visits') ?? '0', 10) + 1;
            localStorage.setItem('vadkul_visits', String(visits));
            dismissedForever = localStorage.getItem(DISMISSED_KEY) === 'true';
            const snooze = localStorage.getItem(SNOOZE_KEY);
            snoozedUntil = snooze ? parseInt(snooze, 10) || null : null;
        } catch { return; /* localStorage blockerad → visa inte */ }

        const standalone = window.matchMedia('(display-mode: standalone)').matches
            || (navigator as unknown as { standalone?: boolean }).standalone === true;
        if (!shouldOfferInstall({ dismissedForever, snoozedUntil, visits, standalone }, Date.now())) {
            return;
        }

        const onBeforeInstall = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e as BeforeInstallPromptEvent);
            setShowPrompt(true);
        };
        window.addEventListener('beforeinstallprompt', onBeforeInstall);

        // Installerad (via oss eller webbläsarens egen meny) → tyst för alltid.
        const onInstalled = () => {
            try { localStorage.setItem(DISMISSED_KEY, 'true'); } catch { /* ok */ }
            setShowPrompt(false);
            setShowGuide(false);
        };
        window.addEventListener('appinstalled', onInstalled);

        // Webbläsare som aldrig skickar beforeinstallprompt får banderollen
        // ändå, med guiden bakom knappen. Liten fördröjning så den inte
        // landar mitt i sidladdningen.
        const guide = installGuide(detectInstallPlatform(navigator.userAgent, navigator.maxTouchPoints));
        let timer: ReturnType<typeof setTimeout> | undefined;
        if (guide) {
            timer = setTimeout(() => {
                setManualGuide(guide);
                setShowPrompt(true);
            }, 3000);
        }

        return () => {
            window.removeEventListener('beforeinstallprompt', onBeforeInstall);
            window.removeEventListener('appinstalled', onInstalled);
            if (timer !== undefined) clearTimeout(timer);
        };
    }, []);

    const handleInstall = async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') {
                try { localStorage.setItem(DISMISSED_KEY, 'true'); } catch { /* ok */ }
            }
            setDeferredPrompt(null);
            setShowPrompt(false);
            return;
        }
        setShowGuide(true);
    };

    // "Senare"/stängd guide = snooze — banderollen får återkomma om två veckor.
    const snooze = () => {
        setShowPrompt(false);
        setShowGuide(false);
        try { localStorage.setItem(SNOOZE_KEY, String(Date.now() + INSTALL_SNOOZE_MS)); } catch { /* ok */ }
    };

    // Krysset och guidens "Klart!" = aldrig mer på den här enheten.
    const dismissForever = () => {
        setShowPrompt(false);
        setShowGuide(false);
        try { localStorage.setItem(DISMISSED_KEY, 'true'); } catch { /* ok */ }
    };

    if (showGuide && manualGuide) {
        const StepIcon = manualGuide.icon === 'share' ? Share : EllipsisVertical;
        return (
            <div
                className="fixed inset-0 z-[1300] flex items-end justify-center bg-black/60 p-4 pb-8 md:items-center"
                onClick={snooze}
            >
                <div
                    className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="mb-4 flex items-start gap-3">
                        <div className="flex-shrink-0 rounded-xl bg-[#006AA7]/10 p-3 text-[#006AA7]">
                            <SquarePlus size={24} />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-lg font-bold text-slate-900">Lägg till på hemskärmen</h3>
                            <p className="text-sm text-slate-500">Så här gör du i {manualGuide.browser}:</p>
                        </div>
                        <button
                            onClick={snooze}
                            className="-mr-1 -mt-1 rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-100"
                            aria-label="Stäng"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    <ol className="mb-5 space-y-3">
                        {manualGuide.steps.map((step, i) => (
                            <li key={i} className="flex items-start gap-3">
                                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[#006AA7] text-xs font-bold text-white">
                                    {i + 1}
                                </span>
                                <span className="text-sm text-slate-700">
                                    {step}
                                    {i === 0 && (
                                        <StepIcon size={16} className="ml-1.5 inline-block align-text-bottom text-[#006AA7]" />
                                    )}
                                </span>
                            </li>
                        ))}
                    </ol>

                    <div className="flex gap-2">
                        <button
                            onClick={dismissForever}
                            className="flex-1 rounded-lg bg-[#006AA7] px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-[#005a8f]"
                        >
                            Klart!
                        </button>
                        <button
                            onClick={snooze}
                            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100"
                        >
                            Senare
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (!showPrompt) return null;

    return (
        <div className="fixed bottom-24 left-4 right-4 md:left-auto md:right-4 md:w-96 z-[1100] animate-in slide-in-from-bottom duration-300">
            <div className="bg-[#006AA7] text-white rounded-2xl shadow-2xl p-4 border border-white/20">
                <button
                    onClick={dismissForever}
                    className="absolute top-2 right-2 p-1 hover:bg-white/20 rounded-full transition-colors"
                    aria-label="Stäng"
                >
                    <X size={16} />
                </button>

                <div className="flex items-start gap-3">
                    <div className="bg-white/20 p-3 rounded-xl flex-shrink-0">
                        <Download size={24} />
                    </div>
                    <div className="flex-1 pr-6">
                        <h3 className="font-bold text-lg mb-1">
                            Installera VADKUL
                        </h3>
                        <p className="text-sm text-sky-100 mb-3">
                            Lägg till på hemskärmen — kartan ett tryck bort.
                        </p>
                        <div className="flex gap-2">
                            <button
                                onClick={handleInstall}
                                className="bg-white text-[#006AA7] font-bold px-4 py-2 rounded-lg hover:bg-sky-50 transition-colors text-sm"
                            >
                                {deferredPrompt ? 'Installera' : 'Visa hur'}
                            </button>
                            <button
                                onClick={snooze}
                                className="text-white/90 font-medium px-3 py-2 hover:bg-white/10 rounded-lg transition-colors text-sm"
                            >
                                Senare
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
