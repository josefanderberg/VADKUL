import { useState, useEffect } from 'react';
import { Map, Calendar, Rocket, X } from 'lucide-react';

export default function WelcomeModal() {
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        const hasSeenWelcome = localStorage.getItem('seen_welcome_modal');
        if (!hasSeenWelcome) {
            // Small delay for better UX
            const timer = setTimeout(() => setIsOpen(true), 500);
            return () => clearTimeout(timer);
        }
    }, []);

    const handleClose = () => {
        setIsOpen(false);
        localStorage.setItem('seen_welcome_modal', 'true');
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
            {/* Backdrop with blur */}
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-500 animate-in fade-in"
                onClick={handleClose}
            ></div>

            {/* Modal Content */}
            <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-5 duration-300 border border-slate-200 dark:border-slate-800">
                {/* Decorative background circle */}
                <div className="absolute -top-20 -right-20 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none"></div>
                <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl pointer-events-none"></div>

                <div className="relative p-8 text-center">
                    <button
                        onClick={handleClose}
                        className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                    >
                        <X size={20} />
                    </button>

                    <div className="inline-flex items-center justify-center w-16 h-16 mb-6 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/30 text-white">
                        <span className="text-3xl">👋</span>
                    </div>

                    <h2 className="text-3xl font-bold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400">
                        Välkommen till VadKul
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 mb-8 text-lg">
                        Hitta på något kul!
                    </p>

                    <div className="space-y-4 text-left mb-8">
                        <div className="flex items-start gap-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800/50">
                            <div className="mt-1 p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
                                <Map size={20} />
                            </div>
                            <div>
                                <h3 className="font-semibold text-slate-900 dark:text-white">Utforska kartan</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400">Se vad som händer nära dig just nu.</p>
                            </div>
                        </div>

                        <div className="flex items-start gap-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800/50">
                            <div className="mt-1 p-2 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-lg">
                                <Calendar size={20} />
                            </div>
                            <div>
                                <h3 className="font-semibold text-slate-900 dark:text-white">Skapa events</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400">Bjud in vänner eller gör det öppet för alla.</p>
                            </div>
                        </div>

                        <div className="flex items-start gap-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800/50">
                            <div className="mt-1 p-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-lg">
                                <Rocket size={20} />
                            </div>
                            <div>
                                <h3 className="font-semibold text-slate-900 dark:text-white">Häng på!</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400">Gå med i aktiviteter med ett knapptryck.</p>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={handleClose}
                        className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/25 transform transition-all active:scale-95 text-lg"
                    >
                        Kom igång
                    </button>
                </div>
            </div>
        </div>
    );
}

