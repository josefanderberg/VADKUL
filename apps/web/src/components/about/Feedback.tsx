import { useState } from 'react';
import { Star, Send, MessageSquarePlus } from 'lucide-react';
import toast from 'react-hot-toast';
import { addDoc, collection, Timestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';

export default function Feedback() {
    const [rating, setRating] = useState(0);
    const [hoverRating, setHoverRating] = useState(0);
    const [message, setMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    // NY: Import och setup
    // (Ensure imports are added at top: import { addDoc, collection, Timestamp } from 'firebase/firestore'; import { db } from '../../lib/firebase';)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (rating === 0) {
            toast.error("Vänligen välj ett betyg!");
            return;
        }

        setIsSubmitting(true);

        try {
            await addDoc(collection(db, 'feedback'), {
                rating,
                message,
                createdAt: Timestamp.now(),
                // Vi kan lägga till userId om vi vill, men feedback är ofta bra anonymt
                // Skickar med user agent för debug
                userAgent: navigator.userAgent
            });

            setSubmitted(true);
            toast.success("Tack för din feedback!");
        } catch (error) {
            console.error("Error sending feedback:", error);
            toast.error("Något gick fel, försök igen.");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (submitted) {
        return (
            <div className="max-w-md mx-auto py-16 text-center animate-in zoom-in duration-500">
                <div className="w-20 h-20 bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Send size={40} className="ml-1 mt-1" />
                </div>
                <h3 className="text-2xl font-bold mb-2">Tack för hjälpen!</h3>
                <p className="text-muted-foreground mb-8">
                    Dina tankar hjälper oss att göra plattformen bättre för alla.
                </p>
                <button
                    onClick={() => {
                        setSubmitted(false);
                        setRating(0);
                        setMessage('');
                    }}
                    className="text-primary font-bold hover:underline"
                >
                    Skicka mer feedback
                </button>
            </div>
        );
    }

    return (
        <div className="max-w-lg mx-auto py-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center space-y-4 mb-10">
                <h2 className="text-3xl font-bold flex items-center justify-center gap-3">
                    <MessageSquarePlus className="text-primary" size={32} /> Tyck till
                </h2>
                <p className="text-muted-foreground">
                    Saknar du en funktion? Har du hittat en bugg? <br />ELLER vill du bara ge oss lite kärlek?
                </p>
            </div>

            <form onSubmit={handleSubmit} className="bg-card border border-border rounded-2xl p-8 shadow-sm space-y-8">

                {/* RATING */}
                <div className="space-y-4 text-center">
                    <label className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Betygsätt din upplevelse</label>
                    <div className="flex justify-center gap-2">
                        {[1, 2, 3, 4, 5].map((star) => (
                            <button
                                key={star}
                                type="button"
                                onMouseEnter={() => setHoverRating(star)}
                                onMouseLeave={() => setHoverRating(0)}
                                onClick={() => setRating(star)}
                                className="transition-transform hover:scale-110 focus:outline-none"
                            >
                                <Star
                                    size={40}
                                    className={`transition-colors duration-200 ${(hoverRating || rating) >= star
                                        ? 'fill-yellow-400 text-yellow-400 drop-shadow-sm'
                                        : 'text-muted stroke-[1.5]'
                                        }`}
                                />
                            </button>
                        ))}
                    </div>
                    <div className="h-6 text-sm font-semibold text-primary">
                        {rating === 1 && "Det kan bli bättre..."}
                        {rating === 2 && "Helt okej"}
                        {rating === 3 && "Bra!"}
                        {rating === 4 && "Mycket bra!"}
                        {rating === 5 && "Fantastiskt!"}
                    </div>
                </div>

                {/* MESSAGE */}
                <div className="space-y-2">
                    <label className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Ditt meddelande</label>
                    <textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Berätta vad du tycker..."
                        className="w-full min-h-[150px] p-4 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none"
                    />
                </div>

                {/* SUBMIT */}
                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-4 rounded-xl bg-primary text-primary-foreground font-bold text-lg hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    {isSubmitting ? (
                        <>Skickar...</>
                    ) : (
                        <>
                            Skicka Feedback <Send size={20} />
                        </>
                    )}
                </button>
            </form>
        </div>
    );
}
