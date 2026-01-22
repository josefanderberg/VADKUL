import { X, Copy, Gift } from 'lucide-react';
import toast from 'react-hot-toast';

interface InviteModalProps {
    isOpen: boolean;
    onClose: () => void;
    inviteLink: string;
    inviteCount: number;
}

export default function InviteModal({ isOpen, onClose, inviteLink, inviteCount }: InviteModalProps) {
    if (!isOpen) return null;

    const copyToClipboard = () => {
        navigator.clipboard.writeText(inviteLink);
        toast.success("Länk kopierad!");
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
            <div
                className="bg-card w-full max-w-md rounded-2xl shadow-2xl border border-border overflow-hidden animate-in zoom-in-95 duration-200"
                onClick={e => e.stopPropagation()}
            >
                <div className="p-6 relative">
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 rounded-full hover:bg-muted text-muted-foreground transition-colors"
                    >
                        <X size={20} />
                    </button>

                    <div className="text-center space-y-4">
                        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto text-primary">
                            <Gift size={32} />
                        </div>

                        <div>
                            <h2 className="text-2xl font-bold">Bjud in vänner</h2>
                            <p className="text-muted-foreground mt-1">
                                Dela din unika länk och klättra på topplistan "Ambassadörerna"!
                            </p>
                        </div>

                        <div className="bg-muted/50 rounded-xl p-4 border border-border">
                            <p className="text-sm font-medium mb-3">
                                Du har bjudit in <span className="text-primary font-bold text-lg mx-1">{inviteCount}</span> personer
                            </p>

                            <div className="flex gap-2">
                                <code className="flex-1 bg-background border border-border rounded-lg px-3 py-3 text-xs md:text-sm font-mono text-muted-foreground truncate select-all">
                                    {inviteLink}
                                </code>
                                <button
                                    onClick={copyToClipboard}
                                    className="px-4 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors flex items-center justify-center"
                                    title="Kopiera länk"
                                >
                                    <Copy size={18} />
                                </button>
                            </div>
                        </div>

                        <button
                            onClick={onClose}
                            className="w-full py-3 bg-secondary hover:bg-secondary/80 text-secondary-foreground font-bold rounded-xl transition-colors"
                        >
                            Stäng
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
