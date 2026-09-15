'use client';

import { useEffect, useRef, useState } from 'react';
import { MapPinPlus, Check } from 'lucide-react';
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
 * Skapa/tipsa/önska — kartnål-med-plus i BOTTEN-DOCKANS VÄNSTRA HÖRN (ägarbeslut
 * 15/9: "en meny längst ner med knappen för skapa event"; 🔥 står i högra
 * hörnet, dagväljaren mellan dem ovanför). Bodde 14/8–15/9 under profilen uppe
 * till vänster. Formspråket är oförändrat: blå gradient, gul kant,
 * gold-glow-pulse. 44 px med 16 px luft — samma storlek som profil, sök och 🔥
 * (Josef 15/9: alla hörnknappar lika stora).
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
        <div className={`fixed bottom-4 left-4 ${creationMode === 'placing' ? 'z-[1260]' : 'z-[1090]'} flex items-center gap-2 pointer-events-none`}>
            <button
                ref={plusBtnRef}
                type="button"
                onClick={handlePlusClick}
                disabled={plusDropping}
                aria-label={label}
                className={`peer pointer-events-auto relative bg-gradient-to-br from-[#006AA7] via-[#005590] to-[#003C66] backdrop-blur-md h-11 w-11 flex items-center justify-center rounded-full shadow-lg border-2 border-[#FECC02] ${hint ? 'scale-105' : 'hover:scale-105'} active:scale-95 transition-transform duration-200 shrink-0 group gold-glow-pulse`}
            >
                {creationMode === 'placing'
                    ? <Check size={20} className="text-white shrink-0" />
                    : <MapPinPlus size={20} className={`text-[#FECC02] shrink-0 transition-transform duration-200 ${hint ? 'scale-110' : 'group-hover:scale-110'}`} />}
            </button>
            {/* Josef 10/9: "Skapa event, tipsa eller önska" — alla tre vägarna in. */}
            <HoverLabel show={hint && creationMode === 'idle'}>{label}</HoverLabel>
        </div>
    );
}
