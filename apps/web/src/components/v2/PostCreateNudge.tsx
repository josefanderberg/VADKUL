'use client';

import { useEffect, useState } from 'react';
import { Share2, Rocket } from 'lucide-react';
import toast from 'react-hot-toast';
import { eventShareSlug } from '@/utils/eventShareSlug';
import { startEventBoostCheckout, BOOST_TIERS } from '@/services/boostService';

/**
 * Spridningsflödet efter skapat event (Josef 14/9: toasten var "lite för
 * mycket på den bannern" — hellre "något mer ordentligt … i mitten av
 * skärmen"). TVÅ steg i EN modal, samma mörka platta-språk som AuthModal:
 *
 *   1. DELA — neutral text (ingen Facebook-referens: måste passa oavsett
 *      varifrån man kom). Native share med urklipp som reserv. Hoppa över,
 *      klick utanför och Escape går alla VIDARE till steg 2 — aldrig rakt ut.
 *   2. BOOSTA — priset stort och tydligt, checkouten direkt (enda nivån är
 *      veckan; beloppet ur BOOST_TIERS så modalen aldrig ljuger). Nej tack,
 *      klick utanför och Escape stänger.
 *
 * Föräldern (page.tsx) visar modalen genom att sätta `event` efter lyckat
 * skapande — bara för riktiga konton (tips-flödet är anonymt och backend
 * avvisar anonyma köp ändå).
 */
interface PostCreateNudgeProps {
    event: { id: string; title: string } | null;
    onClose: () => void;
}

export default function PostCreateNudge({ event, onClose }: PostCreateNudgeProps) {
    const [step, setStep] = useState<'share' | 'boost'>('share');
    const [busy, setBusy] = useState(false);

    // Nytt event → börja om på dela-steget.
    useEffect(() => {
        if (event) { setStep('share'); setBusy(false); }
    }, [event]);

    // Escape = samma väg som klick utanför (standard för dialoger).
    useEffect(() => {
        if (!event) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== 'Escape') return;
            if (step === 'share') setStep('boost'); else onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [event, step, onClose]);

    if (!event) return null;

    const dismissStep = () => { if (step === 'share') setStep('boost'); else onClose(); };

    const share = async () => {
        const url = `${window.location.origin}/e/${eventShareSlug(event.id)}`;
        try {
            if (navigator.share) {
                await navigator.share({ title: event.title, url });
            } else {
                await navigator.clipboard.writeText(url);
                toast.success('Länk kopierad!');
            }
            setStep('boost');
        } catch {
            // Avbruten dela-dialog är ett val, inte ett fel — stanna kvar.
        }
    };

    const weekTier = BOOST_TIERS.find(bt => bt.tier === 'week');

    const boost = async () => {
        if (busy) return;
        setBusy(true);
        try {
            await startEventBoostCheckout(event.id, 'week'); // redirectar vid succé
        } catch (err) {
            console.error(err);
            toast.error(err instanceof Error ? err.message : 'Kunde inte starta boost.');
            setBusy(false);
        }
    };

    return (
        // Samma modal-språk som AuthModal: mörk platta, blur, white/10-kant,
        // guld som accent. Klick utanför = dismissStep (vidare/stäng).
        <div className="fixed inset-0 z-[1300] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={dismissStep}>
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="post-create-nudge-title"
                className="bg-slate-900/85 backdrop-blur-md border border-white/10 rounded-2xl shadow-2xl p-6 w-full max-w-sm flex flex-col items-center gap-4 text-center"
                onClick={(e) => e.stopPropagation()}
            >
                {step === 'share' ? (
                    <>
                        <span aria-hidden className="text-4xl leading-none">🎉</span>
                        <h2 id="post-create-nudge-title" className="text-xl font-black text-white">
                            Eventet är skapat!
                        </h2>
                        <p className="text-sm font-semibold text-white/70 -mt-2">
                            Det syns redan på kartan. Dela det så att fler hittar dit.
                        </p>
                        <button
                            type="button"
                            onClick={share}
                            className="w-full flex items-center justify-center gap-2.5 px-5 py-3 rounded-xl bg-gradient-to-r from-[#0077BC] to-[#005590] hover:from-[#0083CE] hover:to-[#00619F] text-white font-black shadow-lg ring-1 ring-inset ring-white/25 transition-all active:scale-[0.97]"
                        >
                            <Share2 size={18} />
                            Dela eventet
                        </button>
                        <button
                            type="button"
                            onClick={() => setStep('boost')}
                            className="text-xs font-semibold text-white/50 hover:text-white transition-colors"
                        >
                            Hoppa över
                        </button>
                    </>
                ) : (
                    <>
                        <span aria-hidden className="text-4xl leading-none">⭐</span>
                        <h2 id="post-create-nudge-title" className="text-xl font-black text-white">
                            Vill du synas mest?
                        </h2>
                        <p className="text-sm font-semibold text-white/70 -mt-2">
                            {weekTier?.pitch ?? 'Syns på kartan hela veckan med guldstjärna.'}
                        </p>
                        <p className="flex items-baseline gap-1.5">
                            <span className="text-3xl font-black text-[#FECC02]">{weekTier?.priceLabel ?? '99 kr'}</span>
                            <span className="text-sm font-bold text-white/60">/ vecka</span>
                        </p>
                        <button
                            type="button"
                            onClick={boost}
                            disabled={busy}
                            className="w-full flex items-center justify-center gap-2.5 px-5 py-3 rounded-xl bg-[#FECC02] hover:bg-[#ffd633] text-slate-900 font-black shadow-lg transition-all active:scale-[0.97] disabled:opacity-60"
                        >
                            <Rocket size={18} />
                            {busy ? 'Öppnar betalning…' : 'Boosta eventet'}
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="text-xs font-semibold text-white/50 hover:text-white transition-colors"
                        >
                            Nej tack
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}
