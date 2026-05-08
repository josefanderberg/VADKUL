'use client';

import { useEffect, useState } from 'react';
import { X, Download } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function InstallPrompt() {
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [showPrompt, setShowPrompt] = useState(false);

    useEffect(() => {
        // Check if already dismissed
        const dismissed = localStorage.getItem('pwa-install-dismissed');
        if (dismissed) return;

        // Check if already installed
        if (window.matchMedia('(display-mode: standalone)').matches) {
            return;
        }

        const handler = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e as BeforeInstallPromptEvent);
            setShowPrompt(true);
        };

        window.addEventListener('beforeinstallprompt', handler);

        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const handleInstall = async () => {
        if (!deferredPrompt) return;

        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;

        if (outcome === 'accepted') {
            console.log('PWA installed');
        }

        setDeferredPrompt(null);
        setShowPrompt(false);
    };

    const handleDismiss = () => {
        setShowPrompt(false);
        localStorage.setItem('pwa-install-dismissed', 'true');
    };

    if (!showPrompt) return null;

    return (
        <div className="fixed bottom-20 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50 animate-in slide-in-from-bottom duration-300">
            <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-2xl shadow-2xl p-4 border border-green-400/20">
                <button
                    onClick={handleDismiss}
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
                        <p className="text-sm text-green-50 mb-3">
                            Lägg till på hemskärmen för snabb åtkomst och push-notiser!
                        </p>
                        <div className="flex gap-2">
                            <button
                                onClick={handleInstall}
                                className="bg-white text-green-600 font-bold px-4 py-2 rounded-lg hover:bg-green-50 transition-colors text-sm"
                            >
                                Installera
                            </button>
                            <button
                                onClick={handleDismiss}
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
