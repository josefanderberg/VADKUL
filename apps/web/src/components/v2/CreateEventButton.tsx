'use client';

import { useEffect, useRef, useState } from 'react';
import { Plus, Check } from 'lucide-react';
import HoverLabel from './HoverLabel';

interface CreateEventButtonProps {
    creationMode?: 'idle' | 'placing' | 'editing';
    /** false → knappen renderas inte alls (shop-flaggan "Skapa event" av). */
    enabled?: boolean;
    onStartCreate?: () => void;
    onConfirmPlacement?: () => void;
    /** Visningsrundan efter veckoblinken (Josef 10/9): true i 4 s → knappen
     *  står i sitt hover-läge (större + etiketten framme). */
    hint?: boolean;
}

/**
 * Skapa/tipsa/önska — "+ Lägg till"-pill i ÖVRE HÖGRA HÖRNET (ägarbeslut 7/10:
 * "ha lägg till + som en knapp längst upp åt höger" — tog sökknappens hörn
 * när sök/filter revs från kartan; samma kväll: "det ska stå lägg till
 * istället. och ett plus" — kartnål-med-plus-ikonen ersatt av text + plus).
 * Historik: under profilknappen 24/9–7/10 (och 14/8–15/9), botten-dockans
 * vänstra hörn 15/9–24/9. Formspråket: blå gradient, gul kant. Den
 * pulserande guld-glöden (gold-glow-pulse) är BORTTAGEN 29/9 (Josef: "gör
 * så den slutar blinka gult"). 44 px hög — samma höjd som profilknappen.
 * Bredden (110 px) är dagplattans gräns: gridet runt plattan i page.tsx har
 * en högerkolumn på minst 118 px (pillen + 8) - gör inte pillen bredare
 * utan att höja den.
 *
 * z-[1090] = samma som dagväljaren → hamnar under eventkortet (1250) när ett
 * kort är uppe, precis som väljaren. I placerings-läget är knappen bekräfta-
 * knappen (✓) och lyfts över kortet så den alltid går att nå. Mitt i drop-
 * animationen får den inte unmountas (då fastnar plusDropping-låset) — därför
 * gäller editing-grinden bara läget, inte animationen.
 */
export default function CreateEventButton({
    creationMode = 'idle',
    enabled = true,
    onStartCreate,
    onConfirmPlacement,
    hint = false,
}: CreateEventButtonProps) {
    const plusBtnRef = useRef<HTMLButtonElement>(null);
    const animationRef = useRef<Animation | null>(null);
    const [plusDropping, setPlusDropping] = useState(false);

    // Avbryt plus-animation när creationMode återgår till idle
    useEffect(() => {
        if (creationMode === 'idle' && animationRef.current) {
            animationRef.current.cancel();
            animationRef.current = null;
            setPlusDropping(false);
        }
    }, [creationMode]);

    const handlePlusClick = () => {
        if (creationMode === 'placing') {
            onConfirmPlacement?.();
            return;
        }
        if (plusDropping || creationMode !== 'idle') return;
        const btn = plusBtnRef.current;
        if (!btn) return;
        // Knappen "droppar" till skärmens mitt där nålen placeras — räknat från
        // sin egen rect, så vägen följer med oavsett var knappen bor.
        const rect = btn.getBoundingClientRect();
        const dx = window.innerWidth / 2 - (rect.left + rect.width / 2);
        const dy = window.innerHeight / 2 - (rect.top + rect.height / 2);

        setPlusDropping(true);

        const animation = btn.animate(
            [
                { transform: 'translate(0px, 0px)', easing: 'ease-in-out' },
                { transform: `translate(0px, ${dy}px)`, offset: 0.5, easing: 'ease-in-out' },
                { transform: `translate(${dx}px, ${dy}px)` },
            ],
            { duration: 800, fill: 'forwards' },
        );
        animationRef.current = animation;
        animation.onfinish = () => {
            onStartCreate?.();
            setPlusDropping(false);
        };
    };

    if (creationMode === 'editing' || !enabled) return null;

    const label = creationMode === 'placing' ? 'Välj denna plats' : 'Skapa event, tipsa eller önska';

    return (
        // ÖVRE HÖGRA HÖRNET sedan 7/10 (ägarbeslut: "ha lägg till + som en
        // knapp längst upp åt höger, sen ta bort den under profilen" — tog
        // sökknappens gamla hörn när den revs). Samma kolumn som toppraden
        // (top-6 + px-4 + max-w-[1400px] mx-auto) så pillen står i linje med
        // profilknappen även på bred skärm. Etiketten hänger UNDER pillen
        // (flex-col items-end) - till vänster om den låg den över dagplattan.
        <div className={`fixed inset-x-0 top-6 px-4 ${creationMode === 'placing' ? 'z-[1260]' : 'z-[1090]'} pointer-events-none`}>
            <div className="max-w-[1400px] mx-auto flex flex-col items-end gap-2">
                <button
                    ref={plusBtnRef}
                    type="button"
                    onClick={handlePlusClick}
                    disabled={plusDropping}
                    aria-label={creationMode === 'placing' ? label : `Lägg till: ${label}`}
                    className={`peer pointer-events-auto relative bg-gradient-to-br from-[#006AA7] via-[#005590] to-[#003C66] backdrop-blur-md h-11 pl-3 pr-4 flex items-center justify-center gap-1.5 rounded-full shadow-lg border-2 border-[#FECC02] text-white text-[13px] font-black whitespace-nowrap ${hint ? 'scale-105' : 'hover:scale-105'} active:scale-95 transition-transform duration-200 shrink-0 group`}
                >
                    {creationMode === 'placing' ? (
                        <>
                            <Check size={18} strokeWidth={3} className="shrink-0" />
                            Välj plats
                        </>
                    ) : (
                        <>
                            <Plus size={18} strokeWidth={3} className={`text-[#FECC02] shrink-0 transition-transform duration-200 ${hint ? 'scale-110' : 'group-hover:scale-110'}`} />
                            Lägg till
                        </>
                    )}
                </button>
                {/* Josef 10/9: "Skapa event, tipsa eller önska" — alla tre vägarna in. */}
                <HoverLabel show={hint && creationMode === 'idle'}>{label}</HoverLabel>
            </div>
        </div>
    );
}
