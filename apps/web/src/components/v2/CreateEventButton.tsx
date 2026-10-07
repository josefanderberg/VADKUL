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
 * Skapa/tipsa/önska — RUND +-KNAPP OVANFÖR DAGVÄLJARENS HÖGERKOLUMN (ägarbeslut
 * 7/10 kväll: "lägg till symbolen som ett plus på motsvarande sida som den
 * reset knappen. alltså ovanför åt höger om dagsväljaren" — spegelbild av ↺,
 * som står ovanför bakåtpilen till vänster). Renderas INUTI väljarens relativa
 * container i page.tsx (absolute bottom-full right-0), med samma tryckyte-
 * recept som väljarens cirklar: osynlig 66px-knapp, cirkeln på ett inre spann.
 * Historik: "+ Lägg till"-pill uppe till höger 7/10 (hörnet ägs nu av
 * filterknappen), under profilknappen 24/9-7/10 (och 14/8-15/9), botten-
 * dockans vänstra hörn 15/9-24/9. Formspråket: blå gradient, gul kant, STILL
 * (guld-glöden riven 29/9 — lägg inte tillbaka den).
 *
 * I placerings-läget är knappen bekräfta-knappen (✓) och etiketten "Välj
 * denna plats" visas — texten "Välj plats" som stod i pillen ryms inte i en
 * cirkel. Mitt i drop-animationen får den inte unmountas (då fastnar
 * plusDropping-låset) — därför gäller editing-grinden bara läget.
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
        <>
            {/* Samma frikoppling av träffyta och utseende som väljarens
                cirklar (2c i page.tsx): knappen är en osynlig 66×66-kolumn,
                cirkeln (56px) sitter på det inre spannet. bottom-full right-0
                = rakt ovanför framåtpilen, i lod — spegelbilden av ↺. */}
            <button
                ref={plusBtnRef}
                type="button"
                onClick={handlePlusClick}
                disabled={plusDropping}
                aria-label={creationMode === 'placing' ? label : `Lägg till: ${label}`}
                title={label}
                className="peer group pointer-events-auto absolute bottom-full right-0 flex h-[66px] w-[66px] items-center justify-center outline-none"
            >
                <span className={`flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[#006AA7] via-[#005590] to-[#003C66] border-2 border-[#FECC02] text-white shadow-lg transition-transform duration-200 ${hint ? 'scale-110' : 'group-hover:scale-110'} group-active:scale-95 group-focus-visible:ring-2 group-focus-visible:ring-white/70`}>
                    {creationMode === 'placing' ? (
                        <Check size={24} strokeWidth={3} className="shrink-0" />
                    ) : (
                        <Plus size={24} strokeWidth={3} className="text-[#FECC02] shrink-0" />
                    )}
                </span>
            </button>
            {/* Etiketten ovanför cirkeln: visningsrundans create-steg, och
                ALLTID i placerings-läget — "Välj denna plats" måste synas nu
                när pillen med text är borta. */}
            <HoverLabel
                show={creationMode === 'placing' || (hint && creationMode === 'idle')}
                className="absolute bottom-full right-0 mb-[66px]"
            >
                {label}
            </HoverLabel>
        </>
    );
}
