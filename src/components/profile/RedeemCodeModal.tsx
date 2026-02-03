import { useState, useRef, useEffect } from 'react';
import { X, KeyRound, Loader2, PartyPopper } from 'lucide-react';
import { userService } from '../../services/userService';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

interface RedeemCodeModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export default function RedeemCodeModal({ isOpen, onClose, onSuccess }: RedeemCodeModalProps) {
    const { user } = useAuth();
    const [code, setCode] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen && inputRef.current) {
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen]);

    const handleRedeem = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!code || !user) return;

        setIsLoading(true);
        try {
            const result = await userService.redeemCode(user.uid, code);

            if (result.success) {
                setIsSuccess(true);
                toast.success('H2K2! Koden godkänd.');
                setTimeout(() => {
                    onSuccess();
                    onClose();
                    setIsSuccess(false);
                    setCode('');
                }, 2000);
            } else {
                toast.error(result.message);
                // Skaka animation eller liknande kunde vara snyggt
            }
        } catch (error) {
            toast.error("Misslyckades att lösa in koden.");
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity animate-in fade-in"
                onClick={onClose}
            ></div>

            {/* Modal */}
            <div className="relative w-full max-w-sm bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">

                {/* Header Decoration */}
                <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-br from-indigo-600 to-purple-700 opacity-90"></div>
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl"></div>

                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors z-10"
                >
                    <X size={20} />
                </button>

                <div className="relative pt-12 px-6 pb-6 text-center">

                    {/* Icon */}
                    <div className="w-20 h-20 mx-auto bg-background rounded-2xl shadow-xl flex items-center justify-center mb-6 transform rotate-3 hover:rotate-6 transition-transform">
                        {isSuccess ? (
                            <PartyPopper size={40} className="text-green-500 animate-bounce" />
                        ) : (
                            <KeyRound size={40} className="text-primary" />
                        )}
                    </div>

                    <h2 className="text-2xl font-bold mb-2">Lös in kod</h2>
                    <p className="text-muted-foreground text-sm mb-6">
                        Hitta gömda koder på campus för att låsa upp premiumfunktioner!
                    </p>

                    <form onSubmit={handleRedeem} className="space-y-4">
                        <div className="relative">
                            <input
                                ref={inputRef}
                                type="password"
                                maxLength={4}
                                placeholder="****"
                                value={code}
                                onChange={(e) => setCode(e.target.value.toUpperCase())}
                                className="w-full text-center text-3xl font-mono tracking-[0.5em] p-4 rounded-xl bg-muted/50 border-2 border-transparent focus:border-primary focus:bg-background outline-none transition-all placeholder:text-muted-foreground/30 uppercase"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading || code.length < 4}
                            className={`
                                w-full py-4 rounded-xl font-bold text-lg text-white shadow-lg transition-all
                                ${isLoading || code.length < 4
                                    ? 'bg-muted text-muted-foreground cursor-not-allowed'
                                    : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 transform hover:scale-[1.02] active:scale-[0.98]'
                                }
                            `}
                        >
                            {isLoading ? <Loader2 className="animate-spin mx-auto" /> : 'LÅS UPP'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
