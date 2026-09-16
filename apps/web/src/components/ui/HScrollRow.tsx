'use client';

import { useRef, type Ref } from 'react';

/** Så här långt (px) måste musen flyttas innan det räknas som drag, inte klick. */
const DRAG_SLOP_PX = 4;

interface HScrollRowProps {
    children: React.ReactNode;
    /** Läggs på själva scroll-elementet (flex-raden). */
    className?: string;
    /** Sant = ett vanligt (lodrätt) scrollhjul rullar raden i sidled. Av som
     *  standard: inne i eventkortet äger kortet hjulet (det växer kortet), och
     *  en enradig remsa som kapar hjulet vore en fälla. */
    wheel?: boolean;
    ref?: Ref<HTMLDivElement>;
}

/**
 * Vågrätt rullande rad UTAN synlig scrollbar — texten stannar inne i sin
 * behållare och glider fram i stället för att kapas med "…" (Josef 16/9:
 * "precis som i sökfältet … så att du kan slida och se all text, annars
 * missar man massa i onödan").
 *
 * Bryts ut ur CategoryChipRow (16/9) så eventkortets tid/plats-rad och
 * värdnamnet kan rulla på samma sätt.
 *
 * MUS (Josef 16/9: "dator utan touchpad"): raden går att DRA i sidled; ett
 * drag räknas inte som klick på det man började dra i. Touch sköts av
 * webbläsaren (touch-action pan-x). `data-hscroll` är kontraktet mot
 * eventkortets gestlogik: kortet släpper en mus-gest som börjar i en rad
 * som faktiskt rullar, och låter ett vågrätt touch-svep i raden gå till
 * webbläsaren i stället för att dras upp som kortdrag.
 */
export default function HScrollRow({ children, className = '', wheel = false, ref }: HScrollRowProps) {
    const innerRef = useRef<HTMLDivElement | null>(null);
    const dragRef = useRef<{ x: number; left: number; moved: boolean } | null>(null);
    const suppressClickRef = useRef(false);

    const setRef = (el: HTMLDivElement | null) => {
        innerRef.current = el;
        if (typeof ref === 'function') ref(el);
        else if (ref) ref.current = el;
    };

    const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        if (e.pointerType !== 'mouse' || e.button !== 0 || !innerRef.current) return;
        dragRef.current = { x: e.clientX, left: innerRef.current.scrollLeft, moved: false };
    };
    const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        const drag = dragRef.current;
        const el = innerRef.current;
        if (!drag || !el) return;
        // Knappen släppt utanför raden utan att pointerup nådde hit — avsluta.
        if (e.buttons === 0) { dragRef.current = null; return; }
        const dx = e.clientX - drag.x;
        if (!drag.moved && Math.abs(dx) > DRAG_SLOP_PX) {
            drag.moved = true;
            // Fångsten håller draget vid liv när musen lämnar raden. Går den
            // inte att ta fortsätter draget ändå.
            try { el.setPointerCapture(e.pointerId); } catch { /* ingen fångst */ }
        }
        if (drag.moved) el.scrollLeft = drag.left - dx;
    };
    const endDrag = () => {
        if (dragRef.current?.moved) suppressClickRef.current = true;
        dragRef.current = null;
    };
    // Klicket som avslutar ett drag ska inte träffa det man började dra i.
    const onClickCapture = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!suppressClickRef.current) return;
        suppressClickRef.current = false;
        e.preventDefault();
        e.stopPropagation();
    };
    // Vanligt scrollhjul (bara lodrätt) rullar raden i sidled.
    const onWheel = (e: React.WheelEvent<HTMLDivElement>) => {
        const el = innerRef.current;
        if (!wheel || !el || el.scrollWidth <= el.clientWidth) return;
        if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) el.scrollLeft += e.deltaY;
    };

    return (
        <div
            ref={setRef}
            data-hscroll
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onClickCapture={onClickCapture}
            onWheel={onWheel}
            className={`flex items-center overflow-x-auto no-scrollbar [touch-action:pan-x] select-none cursor-grab active:cursor-grabbing ${className}`}
        >
            {children}
        </div>
    );
}
