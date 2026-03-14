import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useRouter } from 'next/navigation';

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
const ONBOARDING_STEPS = [
    {
        emoji: '🎉',
        title: 'Vad gör du idag?',
        description: 'Livet är för kort för att sitta hemma.',
        subText: 'Hitta något kul — nu.',
        buttonText: 'Berätta mer! ✨',
    },
    {
        emoji: '🗺️',
        title: 'Upptäck vad som händer',
        description: 'Se vad som händer nära dig just nu.',
        subText: 'Hitta spontana events i realtid.',
        buttonText: 'Coolt, vad mer? 🎪',
    },
    {
        emoji: '🤝',
        title: 'Bli en värd',
        description: 'Skapa egna events på 30 sekunder.',
        subText: 'Padel, fika eller fest? Du bestämmer!',
        buttonText: 'Låter bra! 🚀',
    },
    {
        emoji: '✨',
        title: 'Gemenskapen väntar',
        description: 'Häng med nya och gamla vänner.',
        subText: 'Skapa ett konto för att börja delta!',
        buttonText: 'Kom igång! 🔓',
    }
];

export default function WelcomeModal() {
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(false);
    const [isVisible, setIsVisible] = useState(false);
    const [currentStep, setCurrentStep] = useState(0);

    useEffect(() => {
        const hasSeenWelcome = localStorage.getItem('seen_welcome_modal');
        if (!hasSeenWelcome) {
            const timer = setTimeout(() => {
                setIsOpen(true);
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

    const handleNext = () => {
        if (currentStep < ONBOARDING_STEPS.length - 1) {
            setCurrentStep(prev => prev + 1);
        } else {
            handleNavigationClose();
        }
    };

    const handleNavigationClose = () => {
        handleClose();
        router.push('/login');
    };

    if (!isOpen) return null;

    const step = ONBOARDING_STEPS[currentStep];

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
                <div className="relative p-8 text-center min-h-[480px] flex flex-col justify-between">
                    <div>
                        {/* close button */}
                        <button
                            onClick={handleClose}
                            className="absolute top-4 right-4 text-white/60 hover:text-white transition-colors z-10"
                        >
                            <X size={22} />
                        </button>

                        {/* ── hero emoji ── */}
                        <div
                            key={`emoji-${currentStep}`}
                            className="inline-flex items-center justify-center w-20 h-20 mb-5 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 animate-in zoom-in duration-300"
                        >
                            <span className="text-5xl">{step.emoji}</span>
                        </div>

                        {/* ── hero text ── */}
                        <h2
                            key={`title-${currentStep}`}
                            className="text-3xl font-extrabold text-white mb-2 tracking-tight animate-in slide-in-from-bottom-2 duration-300"
                            style={{ textShadow: '0 2px 10px rgba(0,0,0,0.15)' }}
                        >
                            {step.title}
                        </h2>

                        <div
                            key={`body-${currentStep}`}
                            className="animate-in fade-in slide-in-from-bottom-4 duration-500"
                        >
                            <p className="text-white/90 text-lg leading-relaxed font-medium">
                                {step.description}
                                <br />
                                <span className="text-white font-bold">{step.subText}</span>
                            </p>
                        </div>
                    </div>

                    <div className="mt-8 space-y-6">
                        {/* ── step dots ── */}
                        <div className="flex justify-center gap-2">
                            {ONBOARDING_STEPS.map((_, i) => (
                                <div
                                    key={i}
                                    className={`h-1.5 rounded-full transition-all duration-300 ${
                                        i === currentStep ? 'w-6 bg-white' : 'w-1.5 bg-white/30'
                                    }`}
                                />
                            ))}
                        </div>

                        {/* ── action button ── */}
                        <div className="space-y-3">
                            <button
                                onClick={handleNext}
                                className="w-full py-4 bg-white text-rose-600 font-extrabold rounded-2xl text-lg shadow-xl transform transition-all active:scale-95 hover:scale-[1.02] flex items-center justify-center gap-2"
                            >
                                {step.buttonText}
                            </button>

                            {currentStep < ONBOARDING_STEPS.length - 1 && (
                                <button
                                    onClick={handleClose}
                                    className="text-white/70 text-sm font-bold hover:text-white transition-colors"
                                >
                                    Hoppa över
                                </button>
                            )}
                        </div>
                    </div>

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
