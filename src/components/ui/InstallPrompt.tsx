import { useState, useEffect } from 'react';
import { Download, X, Share } from 'lucide-react';

export default function InstallPrompt() {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [showIOSPrompt, setShowIOSPrompt] = useState(false);
    const [isAppInstalled, setIsAppInstalled] = useState(false);

    useEffect(() => {
        // Detect if already installed related (standalone mode)
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
        if (isStandalone) {
            setIsAppInstalled(true);
            return;
        }

        // Android / Desktop logic
        const handler = (e: any) => {
            e.preventDefault();
            setDeferredPrompt(e);
        };

        window.addEventListener('beforeinstallprompt', handler);

        // iOS Detection
        const userAgent = window.navigator.userAgent.toLowerCase();
        const isIOS = /iphone|ipad|ipod/.test(userAgent);

        // Visa iOS-prompt bara om vi är på iOS OCH inte i standalone
        if (isIOS && !isStandalone) {
            // Visa efter en liten stund för att inte vara störig direkt
            const timer = setTimeout(() => setShowIOSPrompt(true), 3000);
            return () => clearTimeout(timer);
        }

        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const handleInstallClick = async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            setDeferredPrompt(null);
        }
    };

    if (isAppInstalled) return null;

    if (showIOSPrompt) {
        return (
            <div className="fixed bottom-4 left-4 right-4 bg-background/95 backdrop-blur-md border border-primary/20 p-4 rounded-xl shadow-2xl z-50 animate-in slide-in-from-bottom-10 fade-in duration-500">
                <button
                    onClick={() => setShowIOSPrompt(false)}
                    className="absolute top-2 right-2 p-1 text-muted-foreground hover:text-foreground"
                >
                    <X size={16} />
                </button>
                <div className="flex gap-4 items-start">
                    <div className="bg-primary/10 p-2 rounded-lg text-primary shrink-0">
                        <Share size={24} />
                    </div>
                    <div>
                        <h4 className="font-bold text-sm mb-1">Installera appen</h4>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                            För att installera på iPhone: Tryck på <span className="font-bold">Dela</span> <Share size={12} className="inline mx-0.5" /> i menyn och välj sedan <span className="font-bold">"Lägg till på hemskärmen"</span>.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    if (deferredPrompt) {
        return (
            <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <button
                    onClick={handleInstallClick}
                    className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-3 rounded-full font-bold shadow-xl hover:bg-primary/90 transition-transform active:scale-95"
                >
                    <Download size={18} />
                    Spara appen
                </button>
            </div>
        );
    }

    return null;
}
