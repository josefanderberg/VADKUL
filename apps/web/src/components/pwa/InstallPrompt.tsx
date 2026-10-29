'use client';

import { useEffect, useState } from 'react';
import { X, Download, Share, SquarePlus, EllipsisVertical } from 'lucide-react';
import { track } from '@/services/analyticsService';
import {
    appStoreLinkFor,
    detectInstallPlatform,
    installGuide,
    isInAppOpenedPage,
    shouldOfferInstall,
    storeNameFor,
    INSTALL_SNOOZE_MS,
    PLAY_STORE_URL,
    type InstallGuide,
} from '@/utils/installPrompt';

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISSED_KEY = 'pwa-install-dismissed';
const SNOOZE_KEY = 'pwa-install-snooze-until';
// Butiksbannern har EGNA nycklar: den som kryssat bort PWA-erbjudandet ska
// ändå få veta att det numera finns en riktig app.
const STORE_DISMISSED_KEY = 'app-store-banner-dismissed';
const STORE_SNOOZE_KEY = 'app-store-banner-snooze-until';

// Apples logga (Simple Icons, CC0) - lucide har inga varumärkesikoner.
function AppleLogo({ size = 20 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
        </svg>
    );
}

// Två vägar till hemskärmen, båda så automatiska som webbläsarna tillåter:
//  1. Chromium (Chrome/Edge/Samsung): beforeinstallprompt fångas → knappen
//     öppnar systemets install-ruta direkt. EN tapp, inget mer.
//  2. iOS (alla webbläsare) + Firefox/Android: inget API finns — knappen
//     öppnar en guide med exakt de steg som gäller just den webbläsaren
//     (detectInstallPlatform i utils/installPrompt).
// Finns den RIKTIGA appen i plattformens butik (appStoreLinkFor - länken
// sätts vid släppet) visas i stället BUTIKSBANNERN: samma kort, men knappen
// leder till App Store/Google Play. Egna nycklar, samma besöksgrind:
// krysset eller ett tryck på butiksknappen = aldrig mer, "Senare" = två
// veckor. Android saknar butik än - där säger PWA-kortet att appen kommer.
export default function InstallPrompt() {
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [showPrompt, setShowPrompt] = useState(false);
    const [manualGuide, setManualGuide] = useState<InstallGuide | null>(null);
    const [showGuide, setShowGuide] = useState(false);
    const [storeOffer, setStoreOffer] = useState<{ url: string; store: string } | null>(null);
    const [androidSoon, setAndroidSoon] = useState(false);

    useEffect(() => {
        // Sidorna appen själv öppnar: där är man redan i appen.
        if (isInAppOpenedPage(window.location.pathname)) return;

        const platform = detectInstallPlatform(navigator.userAgent, navigator.maxTouchPoints);
        const storeUrl = appStoreLinkFor(platform);
        const dismissKey = storeUrl ? STORE_DISMISSED_KEY : DISMISSED_KEY;
        const snoozeKey = storeUrl ? STORE_SNOOZE_KEY : SNOOZE_KEY;

        let visits = 0;
        let dismissedForever = false;
        let snoozedUntil: number | null = null;
        try {
            visits = parseInt(localStorage.getItem('vadkul_visits') ?? '0', 10) + 1;
            localStorage.setItem('vadkul_visits', String(visits));
            dismissedForever = localStorage.getItem(dismissKey) === 'true';
            const snooze = localStorage.getItem(snoozeKey);
            snoozedUntil = snooze ? parseInt(snooze, 10) || null : null;
        } catch { return; /* localStorage blockerad → visa inte */ }

        const standalone = window.matchMedia('(display-mode: standalone)').matches
            || (navigator as unknown as { standalone?: boolean }).standalone === true;
        if (!shouldOfferInstall({ dismissedForever, snoozedUntil, visits, standalone }, Date.now())) {
            return;
        }

        // Butiksbannern: ingen PWA-lyssnare, bara kortet med butikslänken
        // efter samma lilla fördröjning som guiden.
        if (storeUrl) {
            const timer = setTimeout(() => {
                setStoreOffer({ url: storeUrl, store: storeNameFor(platform) });
                setShowPrompt(true);
            }, 3000);
            return () => clearTimeout(timer);
        }

        // Android saknar butik än - kortet säger att appen kommer.
        const androidSoon = platform.startsWith('android');

        const onBeforeInstall = (e: Event) => {
            e.preventDefault();
            setAndroidSoon(androidSoon);
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
        const guide = installGuide(platform);
        let timer: ReturnType<typeof setTimeout> | undefined;
        if (guide) {
            timer = setTimeout(() => {
                setAndroidSoon(androidSoon);
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
    // Butiksbannern skriver sina egna nycklar.
    const snooze = () => {
        setShowPrompt(false);
        setShowGuide(false);
        try {
            localStorage.setItem(storeOffer ? STORE_SNOOZE_KEY : SNOOZE_KEY, String(Date.now() + INSTALL_SNOOZE_MS));
        } catch { /* ok */ }
    };

    // Krysset och guidens "Klart!" = aldrig mer på den här enheten.
    const dismissForever = () => {
        setShowPrompt(false);
        setShowGuide(false);
        try {
            localStorage.setItem(storeOffer ? STORE_DISMISSED_KEY : DISMISSED_KEY, 'true');
        } catch { /* ok */ }
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

    const closeButton = (
        <button
            onClick={dismissForever}
            className="absolute top-2 right-2 p-1 hover:bg-white/20 rounded-full transition-colors"
            aria-label="Stäng"
        >
            <X size={16} />
        </button>
    );
    const laterButton = (
        <button
            onClick={snooze}
            className="text-white/90 font-medium px-3 py-2 hover:bg-white/10 rounded-lg transition-colors text-sm"
        >
            Senare
        </button>
    );

    // Butiksbannern: appikonen, butiksknappen i App Store-märkets svarta
    // form med Apples logga, och raden om Android så länge Play saknas.
    if (storeOffer) {
        const isAppStore = storeOffer.store === 'App Store';
        return (
            <div className="fixed bottom-24 left-4 right-4 md:left-auto md:right-4 md:w-96 z-[1100] animate-in slide-in-from-bottom duration-300">
                <div className="bg-[#006AA7] text-white rounded-2xl shadow-2xl p-4 border border-white/20">
                    {closeButton}
                    <div className="flex items-start gap-3">
                        <img src="/pwa-icon-bla-192.png" alt="" className="h-12 w-12 flex-shrink-0 rounded-xl ring-1 ring-white/40" />
                        <div className="flex-1 pr-6">
                            <h3 className="font-bold text-lg mb-1">
                                {isAppStore ? 'Nu finns VADKUL i App Store' : 'Skaffa VADKUL-appen'}
                            </h3>
                            <p className="text-sm text-sky-100 mb-3">
                                {isAppStore
                                    ? 'Hela eventkartan som app på din iPhone - snabbare och med notiser.'
                                    : 'Hela eventkartan i fickan - snabbare och med notiser.'}
                            </p>
                            <div className="flex items-center gap-2">
                                <a
                                    href={storeOffer.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={() => { track('store_banner_click', { butik: storeOffer.store }); dismissForever(); }}
                                    className={isAppStore
                                        ? 'inline-flex items-center gap-2 rounded-lg bg-black px-3 py-1.5 text-white ring-1 ring-white/30 transition-colors hover:bg-neutral-800'
                                        : 'bg-white text-[#006AA7] font-bold px-4 py-2 rounded-lg hover:bg-sky-50 transition-colors text-sm'}
                                >
                                    {isAppStore ? (
                                        <>
                                            <AppleLogo size={22} />
                                            <span className="flex flex-col text-left leading-none">
                                                <span className="text-[10px]">Ladda ned i</span>
                                                <span className="text-base font-semibold">App Store</span>
                                            </span>
                                        </>
                                    ) : `Hämta i ${storeOffer.store}`}
                                </a>
                                {laterButton}
                            </div>
                            {!PLAY_STORE_URL && (
                                <p className="mt-3 text-xs text-sky-100">Android-appen kommer inom kort.</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed bottom-24 left-4 right-4 md:left-auto md:right-4 md:w-96 z-[1100] animate-in slide-in-from-bottom duration-300">
            <div className="bg-[#006AA7] text-white rounded-2xl shadow-2xl p-4 border border-white/20">
                {closeButton}
                <div className="flex items-start gap-3">
                    <div className="bg-white/20 p-3 rounded-xl flex-shrink-0">
                        <Download size={24} />
                    </div>
                    <div className="flex-1 pr-6">
                        <h3 className="font-bold text-lg mb-1">
                            {androidSoon ? 'Android-appen kommer snart' : 'Installera VADKUL'}
                        </h3>
                        <p className="text-sm text-sky-100 mb-3">
                            {androidSoon
                                ? 'Tills dess: lägg VADKUL på hemskärmen - kartan ett tryck bort.'
                                : 'Lägg till på hemskärmen - kartan ett tryck bort.'}
                        </p>
                        <div className="flex gap-2">
                            <button
                                onClick={handleInstall}
                                className="bg-white text-[#006AA7] font-bold px-4 py-2 rounded-lg hover:bg-sky-50 transition-colors text-sm"
                            >
                                {deferredPrompt ? 'Installera' : 'Visa hur'}
                            </button>
                            {laterButton}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
