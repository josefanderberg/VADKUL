import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

/* ── floating emoji config ── */
const FLOATING_EMOJIS = [
    { emoji: '🎉', delay: '0s', duration: '4s', left: '8%', top: '12%' },
    { emoji: '⚡', delay: '0.6s', duration: '3.5s', left: '82%', top: '8%' },
    { emoji: '🎯', delay: '1.2s', duration: '4.5s', left: '15%', top: '75%' },
    { emoji: '🔥', delay: '0.3s', duration: '3.8s', left: '78%', top: '70%' },
    { emoji: '🎶', delay: '0.9s', duration: '4.2s', left: '50%', top: '5%' },
    { emoji: '✨', delay: '1.5s', duration: '3.2s', left: '88%', top: '40%' },
    { emoji: '🚀', delay: '0.4s', duration: '3.6s', left: '5%', top: '45%' },
];

/* ── confetti dots config ── */
const CONFETTI_COLORS = [
    'bg-amber-400', 'bg-rose-400', 'bg-violet-400',
    'bg-emerald-400', 'bg-sky-400', 'bg-pink-400',
];

const CONFETTI_DOTS = Array.from({ length: 18 }, (_, i) => ({
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    left: `${5 + Math.random() * 90}%`,
    delay: `${Math.random() * 3}s`,
    duration: `${3 + Math.random() * 3}s`,
    size: `${4 + Math.random() * 4}px`,
}));

/* ── feature pills ── */
const FEATURES = [
    { emoji: '🗺️', text: 'Se vad som händer nära dig' },
    { emoji: '🎪', text: 'Skapa spontana events' },
    { emoji: '🤝', text: 'Häng med nya & gamla vänner' },
];

export default function WelcomeModal() {
    const [isOpen, setIsOpen] = useState(false);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const hasSeenWelcome = localStorage.getItem('seen_welcome_modal');
        if (!hasSeenWelcome) {
            const timer = setTimeout(() => {
                setIsOpen(true);
                // Trigger animations after mount
                requestAnimationFrame(() => setIsVisible(true));
            }, 400);
            return () => clearTimeout(timer);
        }
    }, []);

    const handleClose = () => {
        setIsVisible(false);
        setTimeout(() => {
            setIsOpen(false);
            localStorage.setItem('seen_welcome_modal', 'true');
        }, 300);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
            {/* ── backdrop ── */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-md transition-opacity duration-500"
                style={{ opacity: isVisible ? 1 : 0 }}
                onClick={handleClose}
            />

            {/* ── modal card ── */}
            <div
                className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-white/20 shadow-2xl"
                style={{
                    animation: isVisible ? 'welcome-bounce-in 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards' : 'none',
                    opacity: isVisible ? undefined : 0,
                }}
            >
                {/* ── gradient background ── */}
                <div className="absolute inset-0 bg-gradient-to-br from-amber-500 via-rose-500 to-violet-600" />

                {/* ── confetti dots ── */}
                {CONFETTI_DOTS.map((dot, i) => (
                    <div
                        key={i}
                        className={`absolute rounded-full ${dot.color} pointer-events-none`}
                        style={{
                            left: dot.left,
                            top: '-10px',
                            width: dot.size,
                            height: dot.size,
                            animation: `welcome-confetti ${dot.duration} ${dot.delay} linear infinite`,
                            opacity: 0.7,
                        }}
                    />
                ))}

                {/* ── floating emojis ── */}
                {FLOATING_EMOJIS.map((item, i) => (
                    <div
                        key={i}
                        className="absolute pointer-events-none select-none text-2xl"
                        style={{
                            left: item.left,
                            top: item.top,
                            animation: `welcome-float ${item.duration} ${item.delay} ease-in-out infinite`,
                            opacity: 0.6,
                        }}
                    >
                        {item.emoji}
                    </div>
                ))}

                {/* ── glass content card ── */}
                <div className="relative p-8 text-center">
                    {/* close button */}
                    <button
                        onClick={handleClose}
                        className="absolute top-4 right-4 text-white/60 hover:text-white transition-colors z-10"
                        style={{
                            animation: isVisible ? 'welcome-slide-up 0.4s 0.8s ease-out both' : 'none',
                        }}
                    >
                        <X size={22} />
                    </button>

                    {/* ── wiggling hero emoji ── */}
                    <div
                        className="inline-flex items-center justify-center w-20 h-20 mb-5 rounded-full bg-white/20 backdrop-blur-sm border border-white/30"
                        style={{
                            animation: isVisible
                                ? 'welcome-slide-up 0.5s 0.15s ease-out both, welcome-wiggle 2s 1s ease-in-out 2'
                                : 'none',
                        }}
                    >
                        <span className="text-5xl">🎉</span>
                    </div>

                    {/* ── hero text ── */}
                    <h2
                        className="text-4xl font-extrabold text-white mb-2 tracking-tight"
                        style={{
                            animation: isVisible ? 'welcome-slide-up 0.5s 0.25s ease-out both' : 'none',
                            textShadow: '0 2px 10px rgba(0,0,0,0.15)',
                        }}
                    >
                        Vad gör du idag?
                    </h2>

                    <p
                        className="text-white/85 text-lg mb-8 leading-relaxed font-medium"
                        style={{
                            animation: isVisible ? 'welcome-slide-up 0.5s 0.35s ease-out both' : 'none',
                        }}
                    >
                        Livet är för kort för att sitta hemma.
                        <br />
                        <span className="text-white font-bold">Hitta något kul — nu.</span>
                    </p>

                    {/* ── feature pills ── */}
                    <div className="space-y-3 mb-8">
                        {FEATURES.map((feature, i) => (
                            <div
                                key={i}
                                className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/15 backdrop-blur-sm border border-white/20 text-left text-white transition-transform hover:scale-[1.02]"
                                style={{
                                    animation: isVisible
                                        ? `welcome-slide-up 0.4s ${0.45 + i * 0.1}s ease-out both`
                                        : 'none',
                                }}
                            >
                                <span className="text-2xl flex-shrink-0">{feature.emoji}</span>
                                <span className="font-semibold text-[15px]">{feature.text}</span>
                            </div>
                        ))}
                    </div>

                    {/* ── CTA button ── */}
                    <button
                        onClick={handleClose}
                        className="w-full py-4 bg-white text-rose-600 font-extrabold rounded-2xl text-lg shadow-xl transform transition-all active:scale-95 hover:scale-[1.02]"
                        style={{
                            animation: isVisible
                                ? 'welcome-slide-up 0.5s 0.75s ease-out both, welcome-pulse-glow 2s 1.5s ease-in-out infinite'
                                : 'none',
                        }}
                    >
                        Visa vad som händer! 🚀
                    </button>

                    {/* ── sparkle decorations ── */}
                    <div
                        className="absolute top-6 left-6 w-2 h-2 bg-yellow-300 rounded-full pointer-events-none"
                        style={{ animation: 'welcome-sparkle 2s 0.5s ease-in-out infinite' }}
                    />
                    <div
                        className="absolute bottom-12 right-8 w-1.5 h-1.5 bg-white rounded-full pointer-events-none"
                        style={{ animation: 'welcome-sparkle 2.5s 1s ease-in-out infinite' }}
                    />
                    <div
                        className="absolute top-20 right-12 w-1 h-1 bg-amber-200 rounded-full pointer-events-none"
                        style={{ animation: 'welcome-sparkle 1.8s 0.2s ease-in-out infinite' }}
                    />
                </div>
            </div>
        </div>
    );
}
