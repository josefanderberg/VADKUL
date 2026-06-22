// ── V2Map markör- & overlay-CSS ──────────────────────────────────────────────
// Statisk CSS (ingen ${}-interpolation) för brickorna/bubblorna, flipper-läget,
// vattnings-/glitter-/snö-animationer m.m. Bröts ut ur V2Map (~490 rader JSX-CSS).
// Renderas via <style>{V2_MAP_MARKER_STYLES}</style> — injektionen blir identisk.
export const V2_MAP_MARKER_STYLES = `
                .v2-custom-marker {
                    background: none !important;
                    border: none !important;
                    cursor: pointer;
                    width: 44px;
                    height: 52px;
                }
                /* Tangentbordsfokus ska synas tydligt (markören saknar kant/
                   bakgrund så webbläsarens default-ring försvinner lätt). */
                .v2-custom-marker:focus-visible {
                    outline: 3px solid #006AA7;
                    outline-offset: 2px;
                    border-radius: 10px;
                }
                
                @keyframes marker-pop-in {
                    0% {
                        opacity: 0;
                        transform: scale(0.2) translateY(15px);
                    }
                    40% {
                        opacity: 1;
                    }
                    100% {
                        opacity: 1;
                        transform: scale(1) translateY(0);
                    }
                }

                .custom-marker-wrapper {
                    position: relative;
                    width: 44px;
                    height: 52px;
                }
                .needle-element, .pin-element {
                    position: absolute;
                    transform-origin: bottom center;
                }
                .needle-element {
                    bottom: 5px;
                    left: 50%;
                    transform: translateX(-50%);
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                }
                .pin-element {
                    top: 0;
                    left: 0;
                    width: 44px;
                    height: 52px;
                }
                .needle-dot {
                    border-radius: 50%;
                    border: 2px solid #fff;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.2);
                }
                .needle-line {
                    width: 2px;
                    border-radius: 1px;
                    opacity: 0.8;
                }
                .pin-bubble {
                    width: 44px;
                    height: 44px;
                    border-radius: 50% 50% 0 50%;
                    transform: rotate(45deg);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    overflow: hidden;
                    position: relative;
                    transition: transform 0.18s ease, filter 0.18s ease;
                }
                /* Glansig topp-highlight ger brickan en kupad känsla — ligger
                   under emojin (.pin-emoji har z-index 1) och följer bubblans
                   rundning via border-radius: inherit. */
                .pin-bubble::before {
                    content: '';
                    position: absolute;
                    inset: 0;
                    border-radius: inherit;
                    background: radial-gradient(circle at 30% 28%, rgba(255,255,255,0.30) 0%, rgba(255,255,255,0) 48%);
                    pointer-events: none;
                }
                .pin-emoji {
                    transform: rotate(-45deg);
                    font-size: 22px;
                    line-height: 1;
                    position: relative;
                    z-index: 1;
                    /* text-shadow i stället för drop-shadow-filter: samma djup men
                       en vanlig paint i stället för ett eget kompositlager per
                       markör — märkbart billigare med hundratals markörer. */
                    text-shadow: 0 1px 1.5px rgba(0,0,0,0.25);
                }
                /* Hover-lyft på enheter med riktig pekare (inte touch, annars
                   fastnar hover-läget efter tryck). Vattnings-pulsen är en
                   animation och vinner över hover-transformen — ingen krock. */
                @media (hover: hover) and (pointer: fine) {
                    .v2-custom-marker:hover .pin-bubble {
                        transform: rotate(45deg) scale(1.07);
                        filter: brightness(1.05);
                    }
                }
                /* Flipper-läge: RUNDA studsare. Klasserna sätts bara i pinball, så
                   vanliga läget (droppen) är orört. Specificitet (2-3 klasser) vinner
                   över .pin-bubble utan !important → träff-blinken kan ändå skala. */
                .pin-bubble.pin-bubble-round { border-radius: 50%; transform: none; }
                .pin-bubble.pin-bubble-round::before { display: none; }
                .pin-bubble.pin-bubble-round .pin-emoji { transform: none; }
                .pinball-marker .pin-element { transform: none; }
                @media (hover: hover) and (pointer: fine) {
                    .v2-custom-marker:hover .pin-bubble.pin-bubble-round { transform: scale(1.07); }
                }
                /* Träff: studsaren blinkar/poppar när bollen "tar i" den. */
                .pin-bubble.pin-hit-flash { animation: pinHitPulse 0.3s ease-out; z-index: 5; }
                @keyframes pinHitPulse {
                    0%   { transform: scale(1);    filter: brightness(1);   box-shadow: 0 0 0 0 rgba(251,191,36,0.75); }
                    40%  { transform: scale(1.45); filter: brightness(1.9); box-shadow: 0 0 0 10px rgba(251,191,36,0); }
                    100% { transform: scale(1);    filter: brightness(1); }
                }
                .pin-bubble.pin-hit-active {
                    border: 3px solid #fbbf24 !important;
                    box-shadow: 0 0 14px #fbbf24, inset 0 0 8px rgba(251,191,36,0.4) !important;
                    transition: border 0.1s ease-out, box-shadow 0.1s ease-out;
                }
                /* "Kortet visar denna" — pulserande blå ring på studsaren som det
                   öppna event-kortet hör till, så man aldrig tappar bort vilken
                   markör man bläddrar till med Nästa i pinball-läget. Deklareras
                   EFTER pin-hit-active så den blå kanten vinner när en studsare är
                   både senast-träffad (guld) och vald (blå). 3-klass-selektorn kräver
                   .pin-bubble-round (sätts bara i pinball) → helt inert i normalläget. */
                @keyframes vadkul-card-active-pulse {
                    0%, 100% { box-shadow: 0 0 0 3px rgba(0,106,167,0.35), 0 0 16px rgba(0,106,167,0.55); }
                    50%      { box-shadow: 0 0 0 7px rgba(0,106,167,0.15), 0 0 24px rgba(0,106,167,0.70); }
                }
                .pin-bubble.pin-bubble-round.card-active {
                    border: 3px solid #006AA7 !important;
                    animation: vadkul-card-active-pulse 1.3s ease-in-out infinite;
                }
                /* Guld-markör: skimrar med en pulserande gloria runt brickan så
                   det rätta svaret syns tydligt även från avstånd. */
                @keyframes gold-marker-shimmer {
                    0%, 100% {
                        box-shadow: 0 0 0 3px rgba(251,191,36,0.30), 0 6px 22px rgba(217,119,6,0.45);
                        filter: brightness(1);
                    }
                    50% {
                        box-shadow: 0 0 0 7px rgba(251,191,36,0.12), 0 8px 28px rgba(217,119,6,0.7);
                        filter: brightness(1.18);
                    }
                }
                .pin-bubble-gold {
                    animation: gold-marker-shimmer 1.4s ease-in-out infinite;
                }
                .badge-count {
                    position: absolute;
                    top: -6px;
                    right: -6px;
                    min-width: 20px;
                    height: 20px;
                    padding: 0 4px;
                    background: #006AA7;
                    color: #fff;
                    font-size: 10px;
                    font-weight: 700;
                    font-variant-numeric: tabular-nums;
                    border-radius: 999px;
                    border: 2px solid #fff;
                    box-shadow: 0 1px 4px rgba(0,0,0,0.2);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    line-height: 1;
                    z-index: 10;
                }
                .badge-saved {
                    position: absolute;
                    top: -4px;
                    right: -4px;
                    width: 12px;
                    height: 12px;
                    background: #5BA3CC;
                    border-radius: 50%;
                    border: 2px solid #fff;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.15);
                    z-index: 10;
                }
                .badge-needle-count {
                    position: absolute;
                    top: -6px;
                    left: 50%;
                    transform: translateX(-50%);
                    min-width: 14px;
                    height: 14px;
                    padding: 0 2px;
                    background: #006AA7;
                    color: #fff;
                    font-size: 8px;
                    font-weight: 700;
                    font-variant-numeric: tabular-nums;
                    border-radius: 999px;
                    border: 1.5px solid #fff;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    line-height: 1;
                    box-sizing: border-box;
                }

                /* ── Kontrast per kartstil ──────────────────────────────────
                   Mörka kartan: hårfin ljus gloria + djupare skugga så mörka
                   brickor och nålar inte smälter in i den nästan svarta
                   bakgrunden. (Klassen sätts på kartcontainern i mapStyle-
                   effekten.) */
                .map-style-dark .pin-element {
                    filter: drop-shadow(0 0 1.5px rgba(255,255,255,0.45)) drop-shadow(0 5px 12px rgba(0,0,0,0.8));
                }
                .map-style-dark .needle-dot {
                    box-shadow: 0 0 0 1px rgba(255,255,255,0.3), 0 1px 4px rgba(0,0,0,0.8);
                }
                .map-style-dark .needle-line {
                    opacity: 1;
                    filter: brightness(1.7);
                }

                /* ──────────────────────────────────────────────────────────
                   TILLSTÅNDS-KLASSER (Styrs av containerklassen)
                ────────────────────────────────────────────────────────── */

                /* 1. Zoom-läge: GL-massan fälls till billiga prickar. DOM-brickorna
                   är få (bara speciella event) och saknar separat nål, så de står
                   kvar som brickor även under zoom — utan att poppa in på nytt. */
                .map-state-needle .v2-custom-marker .pin-element {
                    display: block;
                }

                /* Fäll flipper-studsarna till billiga små prickar under zoom för att undvika lag. */
                .map-state-needle .v2-custom-marker:has(.pinball-marker) {
                    width: 12px !important;
                    height: 12px !important;
                }
                .map-state-needle .custom-marker-wrapper.pinball-marker {
                    width: 12px !important;
                    height: 12px !important;
                    display: flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                }
                .map-state-needle .custom-marker-wrapper.pinball-marker .pin-element {
                    width: 12px !important;
                    height: 12px !important;
                    display: flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    position: relative !important;
                    top: auto !important;
                    left: auto !important;
                }
                .map-state-needle .custom-marker-wrapper.pinball-marker .pin-bubble {
                    width: 8px !important;
                    height: 8px !important;
                    border: 1.5px solid #fff !important;
                    box-shadow: 0 1px 2px rgba(0,0,0,0.35) !important;
                    border-radius: 50% !important;
                    transform: scale(1) !important;
                    animation: none !important;
                }
                .map-state-needle .custom-marker-wrapper.pinball-marker .pin-emoji,
                .map-state-needle .custom-marker-wrapper.pinball-marker .badge-count,
                .map-state-needle .custom-marker-wrapper.pinball-marker .badge-saved,
                .map-state-needle .custom-marker-wrapper.pinball-marker .marker-flowers,
                .map-state-needle .custom-marker-wrapper.pinball-marker .watering-rain,
                .map-state-needle .custom-marker-wrapper.pinball-marker .watering-progress-svg {
                    display: none !important;
                }

                /* 2. Brick-läge (kartan står still): brickan poppar in. */
                .map-state-full .v2-custom-marker .pin-element {
                    display: block;
                    animation: marker-pop-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both;
                }

                /* Vattnade markörer / blommor */
                .marker-flowers {
                    position: absolute;
                    bottom: -6px;
                    left: 50%;
                    transform: translateX(-50%);
                    display: flex;
                    gap: 1.5px;
                    justify-content: center;
                    pointer-events: none;
                    z-index: 20;
                    width: max-content;
                }
                .sprouting-flower {
                    font-size: 11px;
                    display: inline-block;
                    line-height: 1;
                    transform-origin: bottom center;
                    animation: flower-sprout 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) both, flower-sway 2.5s ease-in-out infinite alternate;
                }
                .anim-flower-1 {
                    animation-delay: 0ms;
                }
                .anim-flower-2 {
                    animation-delay: 150ms;
                    font-size: 9px;
                }
                .anim-flower-3 {
                    animation-delay: 300ms;
                    font-size: 10px;
                }
                @keyframes flower-sprout {
                    0% {
                        transform: scale(0) translateY(8px);
                        opacity: 0;
                    }
                    100% {
                        transform: scale(1) translateY(0);
                        opacity: 1;
                    }
                }
                @keyframes flower-sway {
                    0% {
                        transform: rotate(-8deg);
                    }
                    100% {
                        transform: rotate(8deg);
                    }
                }

                /* Vattnings-feedback (regn, pulserande bubbla + förloppsindikator) */
                .watering-rain {
                    position: absolute;
                    top: -30px;
                    left: 0;
                    width: 44px;
                    height: 30px;
                    overflow: visible;
                    pointer-events: none;
                    z-index: 10;
                }
                .rain-drop {
                    position: absolute;
                    width: 2px;
                    height: 8px;
                    background: linear-gradient(to bottom, rgba(56, 189, 248, 0), rgba(56, 189, 248, 1));
                    border-radius: 999px;
                    opacity: 0;
                    animation: rain-fall-down 0.4s linear infinite;
                }
                .rain-drop:nth-child(1) {
                    left: 10px;
                    animation-delay: 0s;
                }
                .rain-drop:nth-child(2) {
                    left: 22px;
                    animation-delay: 0.12s;
                }
                .rain-drop:nth-child(3) {
                    left: 34px;
                    animation-delay: 0.24s;
                }
                @keyframes rain-fall-down {
                    0% {
                        transform: translateY(0) scaleY(1);
                        opacity: 0;
                    }
                    15% {
                        opacity: 0.9;
                    }
                    85% {
                        opacity: 0.9;
                        transform: translateY(28px) scaleY(1);
                    }
                    100% {
                        transform: translateY(32px) scaleY(0.1);
                        opacity: 0;
                    }
                }

                .watering-progress-svg {
                    position: absolute;
                    top: -4px;
                    left: -4px;
                    width: 52px;
                    height: 52px;
                    z-index: 5;
                    transform: rotate(-90deg);
                    pointer-events: none;
                }
                .watering-progress-bg {
                    fill: none;
                    stroke: rgba(56, 189, 248, 0.2);
                    stroke-width: 3.5;
                }
                .watering-progress-fill {
                    fill: none;
                    stroke: #38bdf8;
                    stroke-width: 3.5;
                    stroke-linecap: round;
                    stroke-dasharray: 100 100;
                    stroke-dashoffset: 100;
                    filter: drop-shadow(0 0 3px rgba(56, 189, 248, 0.8));
                    animation: fill-watering-progress 1.0s cubic-bezier(0.4, 0, 0.2, 1) forwards;
                }
                @keyframes fill-watering-progress {
                    to {
                        stroke-dashoffset: 0;
                    }
                }

                @keyframes bubble-watering-pulse {
                    0%, 100% {
                        transform: rotate(45deg) scale(1);
                    }
                    50% {
                        transform: rotate(45deg) scale(1.06);
                        box-shadow: 0 0 15px rgba(56, 189, 248, 0.6);
                    }
                }
                .pin-bubble-watering {
                    animation: bubble-watering-pulse 0.8s ease-in-out infinite;
                }

                /* Sparkles / Glitter-fall */
                .sparkle-drop {
                    position: absolute;
                    font-size: 14px;
                    opacity: 0;
                    pointer-events: none;
                    animation: sparkle-fall-down 0.5s linear infinite;
                }
                .sparkle-drop:nth-child(1) {
                    left: 6px;
                    animation-delay: 0s;
                }
                .sparkle-drop:nth-child(2) {
                    left: 20px;
                    animation-delay: 0.15s;
                }
                .sparkle-drop:nth-child(3) {
                    left: 32px;
                    animation-delay: 0.3s;
                }
                @keyframes sparkle-fall-down {
                    0% {
                        transform: translateY(0) scale(0) rotate(0deg);
                        opacity: 0;
                    }
                    15% {
                        opacity: 1;
                        transform: translateY(4px) scale(1.1) rotate(45deg);
                    }
                    85% {
                        opacity: 1;
                        transform: translateY(24px) scale(0.9) rotate(180deg);
                    }
                    100% {
                        transform: translateY(32px) scale(0) rotate(270deg);
                        opacity: 0;
                    }
                }

                /* Snowflakes / Snöfall */
                .snow-drop {
                    position: absolute;
                    font-size: 14px;
                    opacity: 0;
                    pointer-events: none;
                    animation: snow-fall-down 0.6s ease-in-out infinite;
                }
                .snow-drop:nth-child(1) {
                    left: 8px;
                    animation-delay: 0s;
                }
                .snow-drop:nth-child(2) {
                    left: 20px;
                    animation-delay: 0.18s;
                }
                .snow-drop:nth-child(3) {
                    left: 32px;
                    animation-delay: 0.36s;
                }
                @keyframes snow-fall-down {
                    0% {
                        transform: translateY(0) translateX(0) rotate(0deg);
                        opacity: 0;
                    }
                    15% {
                        opacity: 0.95;
                    }
                    85% {
                        opacity: 0.95;
                        transform: translateY(24px) translateX(-4px) rotate(180deg);
                    }
                    100% {
                        transform: translateY(32px) translateX(2px) rotate(360deg);
                        opacity: 0;
                    }
                }

                /* Custom bubble pulses for glitter & snow */
                @keyframes bubble-watering-sparkle-pulse {
                    0%, 100% {
                        transform: rotate(45deg) scale(1);
                    }
                    50% {
                        transform: rotate(45deg) scale(1.06);
                        box-shadow: 0 0 15px rgba(244, 114, 182, 0.75);
                    }
                }
                .pin-bubble-watering-sparkle {
                    animation: bubble-watering-sparkle-pulse 0.8s ease-in-out infinite;
                }

                @keyframes bubble-watering-snowball-pulse {
                    0%, 100% {
                        transform: rotate(45deg) scale(1);
                    }
                    50% {
                        transform: rotate(45deg) scale(1.06);
                        box-shadow: 0 0 15px rgba(147, 197, 253, 0.75);
                    }
                }
                .pin-bubble-watering-snowball {
                    animation: bubble-watering-snowball-pulse 0.8s ease-in-out infinite;
                }
`;
