import { useState } from 'react';
import { X, Check, KeyRound } from 'lucide-react';
import toast from 'react-hot-toast';

interface PromoCodeModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (code: string, customName: string) => void;
}

export default function PromoCodeModal({ isOpen, onClose, onSuccess }: PromoCodeModalProps) {
    const [accessCode, setAccessCode] = useState('');
    const [codeUnlocked, setCodeUnlocked] = useState(false);
    const [customCategoryName, setCustomCategoryName] = useState('');

    if (!isOpen) return null;

    const handleCodeSubmit = () => {
        if (accessCode === 'N4TN') {
            setCodeUnlocked(true);
            toast.success("Kod godkänd! Ange namn på nation/kår.");
        } else {
            toast.error("Felaktig kod. Försök igen.");
            setAccessCode('');
        }
    };

    const handleFinalSubmit = () => {
        if (!customCategoryName.trim()) {
            toast.error("Vänligen ange ett namn");
            return;
        }
        onSuccess(accessCode, customCategoryName);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="relative w-full max-w-sm bg-card border border-border rounded-2xl shadow-2xl p-6 animate-in zoom-in-95 duration-200">

                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition-colors"
                >
                    <X size={20} />
                </button>

                <div className="flex flex-col items-center text-center mb-6">
                    <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary mb-3">
                        <KeyRound size={24} />
                    </div>
                    <h3 className="text-xl font-bold">Har du en kod?</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                        Lås upp exklusiva kategorier som Nationer eller Kårer med din accesskod.
                    </p>
                </div>

                <div className="space-y-4">
                    {/* Access Code Input */}
                    <div className="flex gap-2">
                        <input
                            type="text"
                            placeholder="ANGE KOD..."
                            value={accessCode}
                            onChange={e => setAccessCode(e.target.value.toUpperCase())}
                            disabled={codeUnlocked}
                            className={`flex-grow p-3 rounded-xl border bg-background text-foreground text-center font-mono uppercase tracking-widest outline-none focus:ring-2 focus:ring-primary transition-all
                                ${codeUnlocked ? 'border-green-500/50 bg-green-500/10 text-green-600' : 'border-border'}
                            `}
                        />
                        {!codeUnlocked && (
                            <button
                                onClick={handleCodeSubmit}
                                disabled={!accessCode}
                                className="px-4 bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50"
                            >
                                <Check size={20} />
                            </button>
                        )}
                    </div>

                    {/* Step 2: Custom Name (Only if unlocked) */}
                    {codeUnlocked && (
                        <div className="animate-in fade-in slide-in-from-top-2 space-y-3">
                            <div className="text-center text-green-600 font-bold text-sm flex items-center justify-center gap-1.5 bg-green-500/10 py-1.5 rounded-lg">
                                <Check size={14} /> Kod godkänd!
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-muted-foreground uppercase mb-1.5 text-left">Vilken nation/kår?</label>
                                <input
                                    type="text"
                                    placeholder="T.ex. Kalmar Nation"
                                    value={customCategoryName}
                                    onChange={e => setCustomCategoryName(e.target.value)}
                                    autoFocus
                                    className="w-full p-3 rounded-xl border border-border bg-background text-foreground outline-none focus:ring-2 focus:ring-primary"
                                />
                            </div>

                            <button
                                onClick={handleFinalSubmit}
                                disabled={!customCategoryName}
                                className="w-full py-3 bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary/90 transition-colors shadow-lg active:scale-95 duration-200"
                            >
                                Använd kategori
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
