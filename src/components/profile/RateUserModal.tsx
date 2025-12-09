import { useState } from 'react';
import { Star, X } from 'lucide-react';
import { toast } from 'react-hot-toast'; // Antar att vi använder denna

interface RateUserModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (rating: number, comment: string) => Promise<void>;
    targetName: string;
}

export default function RateUserModal({ isOpen, onClose, onSubmit, targetName }: RateUserModalProps) {
    const [rating, setRating] = useState(0);
    const [hoverRating, setHoverRating] = useState(0);
    const [comment, setComment] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async () => {
        if (rating === 0) return toast.error("Välj ett betyg!");

        setIsSubmitting(true);
        try {
            await onSubmit(rating, comment);
            onClose();
            // Toast sköts troligen av föräldern eller här
            toast.success("Tack för ditt omdöme! ⭐");
        } catch (error) {
            toast.error("Något gick fel.");
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-sm shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden relative animate-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-6 text-white text-center relative">
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 text-white/80 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors"
                    >
                        <X size={20} />
                    </button>
                    <h2 className="text-xl font-bold mb-1">Betygsätt</h2>
                    <p className="text-white/90 text-sm">{targetName}</p>
                </div>

                <div className="p-6">
                    {/* Stjärnor */}
                    <div className="flex justify-center gap-2 mb-6">
                        {[1, 2, 3, 4, 5].map((star) => (
                            <button
                                key={star}
                                type="button"
                                className="transition-transform hover:scale-110 focus:outline-none"
                                onMouseEnter={() => setHoverRating(star)}
                                onMouseLeave={() => setHoverRating(0)}
                                onClick={() => setRating(star)}
                            >
                                <Star
                                    size={36}
                                    className={`${(hoverRating || rating) >= star
                                            ? 'fill-yellow-400 text-yellow-400 drop-shadow-sm'
                                            : 'text-slate-300 dark:text-slate-600'
                                        } transition-colors duration-200`}
                                />
                            </button>
                        ))}
                    </div>

                    {/* Kommentar */}
                    <textarea
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder="Skriv en kommentar (frivilligt)..."
                        className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-800 outline-none resize-none text-sm min-h-[100px] mb-4"
                    />

                    {/* Knappar */}
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting || rating === 0}
                        className="w-full py-3 rounded-xl bg-indigo-600 text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-indigo-700 active:scale-95 transition-all shadow-lg shadow-indigo-500/30"
                    >
                        {isSubmitting ? 'Skickar...' : 'Skicka Omdöme'}
                    </button>
                </div>
            </div>
        </div>
    );
}
