'use client';

import { createPortal } from 'react-dom';
import { Rocket, X } from 'lucide-react';
import { BOOST_TIERS, type BoostTier } from '../../services/boostService';

interface Props {
    /** True när eventet redan är boostat — rubriken säger "förläng" i stället. */
    isExtension?: boolean;
    onSelect: (tier: BoostTier) => void;
    onClose: () => void;
}

/**
 * Nivåväljaren för boost-köpet: 1 dag / 1 vecka / 1 månad. Ren presentation —
 * nivåerna (etikett, visningspris, säljtext) ägs av BOOST_TIERS i
 * boostService.ts och det riktiga beloppet av Stripe/backend.
 *
 * z-[1300]: modalskiktet — över eventkortet (1250), som alla andra modaler.
 *
 * Portalas till document.body: komponenten monteras inne i eventkortets
 * bottensheet, som alltid bär en inline-transform (translateX/rotate även i
 * vila) och overflow-hidden — en transform gör sheeten till containing block
 * för fixed-ättlingar, så utan portalen skulle overlayn spänna över sheeten i
 * stället för viewporten och modalen klippas av sheetens box.
 */
export default function BoostTierPicker({ isExtension = false, onSelect, onClose }: Props) {
    return createPortal(
        <div
            className="fixed inset-0 z-[1300] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-6"
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            // Modalen renderas i eventkortets DOM-träd — utan stoppet skulle
            // pekar-drag på overlayn dra i bottensheeten bakom.
            onPointerDown={(e) => e.stopPropagation()}
        >
            <div
                className="w-full sm:max-w-md bg-card rounded-t-[2rem] sm:rounded-3xl shadow-2xl border border-border/20 p-5 sm:p-6 animate-in fade-in slide-in-from-bottom-4 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-start justify-between gap-3 mb-1">
                    <h3 className="flex items-center gap-2 text-lg font-black text-black dark:text-white">
                        <Rocket size={20} className="text-amber-500 shrink-0" />
                        {isExtension ? 'Förläng boosten' : 'Boosta eventet'}
                    </h3>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Stäng"
                        className="w-8 h-8 -mr-1 -mt-1 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-slate-300 transition-colors shrink-0"
                    >
                        <X size={18} />
                    </button>
                </div>
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-4">
                    Ditt event lyfts fram och syns direkt på kartan — välj hur länge. 🚀
                </p>

                <div className="flex flex-col gap-2.5">
                    {BOOST_TIERS.map(({ tier, label, priceLabel, pitch }) => (
                        <button
                            key={tier}
                            type="button"
                            onClick={() => onSelect(tier)}
                            className={`w-full text-left rounded-2xl border-2 p-3.5 transition-all active:scale-[0.98] ${
                                tier === 'week'
                                    ? 'border-amber-400 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/30 dark:hover:bg-amber-950/50'
                                    : 'border-border bg-white hover:border-amber-300 hover:bg-amber-50/50 dark:bg-slate-800 dark:hover:bg-slate-800/70'
                            }`}
                        >
                            <div className="flex items-center justify-between gap-3 mb-0.5">
                                <span className="flex items-center gap-2 text-sm font-black text-black dark:text-white">
                                    {label}
                                    {/* Veckan lyfts fram som det självklara valet. */}
                                    {tier === 'week' && (
                                        <span className="inline-flex items-center text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-400 text-slate-900">
                                            Populärast
                                        </span>
                                    )}
                                </span>
                                <span className="text-sm font-black text-black dark:text-white whitespace-nowrap tabular-nums">
                                    {priceLabel}
                                </span>
                            </div>
                            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 leading-snug">
                                {pitch}
                            </p>
                        </button>
                    ))}
                </div>

                <p className="mt-4 text-[10px] font-semibold text-slate-400 text-center">
                    Betalningen sker tryggt via Stripe — boosten aktiveras direkt efter köpet.
                </p>
            </div>
        </div>,
        document.body,
    );
}
