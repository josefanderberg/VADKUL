'use client';

import { useEffect, useRef, useState } from 'react';
import { THEMEPARK_LAND_COLOR_NEAR } from '@/components/v2/v2MapBaseStyles';

// Den RIKTIGA VADKUL-kartan bakom stads-heron.
//
// De statiska Carto-kaklen i CityMapHero är Voyagers grå-beige palett, medan
// huvudkartan kör "nöjesfält": samma Voyager-geometri men grönt land, blått
// vatten, vita vägar och beiga hus. Stadssidorna ska kännas som kartan — därför
// ritas samma stil här i en riktig MapLibre-canvas ovanpå kaklen och tonas in
// när den är klar. Kaklen är numera BARA reservväg: en platta i kartans
// landfärg täcker dem redan i server-HTML:en (Voyagers grå-beige hann annars
// synas en sekund och byttes sedan — "ett annat utseende", Josef 11/8) och
// släpps fram enbart om WebGL saknas eller stilen inte går att hämta.
//
// Kartan är helt passiv (interactive:false) — inga event-lyssnare, ingen
// tröghet, och hela heron förblir EN länk. maplibre-gl laddas dynamiskt när
// webbläsaren är ledig, så SEO-sidornas första paint aldrig väntar på den.
//
// maplibre-gl.css importeras INTE (den är render-blockerande CSS på en sida
// som ska vara lätt) — utan kontroller behövs bara de två reglerna för
// canvas-positionering, och de sätts som utility-klasser på hållaren nedan.
export default function CityMapHeroCanvas({ lat, lng, zoom }: {
    lat: number;
    lng: number;
    /** MapLibre-zoom, INTE kakel-zoom — se HERO_GL_ZOOM i CityMapHero. */
    zoom: number;
}) {
    const holderRef = useRef<HTMLDivElement>(null);
    const [ready, setReady] = useState(false);
    // GL gick inte att starta (ingen WebGL / stilen onåbar) → släpp fram
    // Voyager-kaklen under. Tills dess täcker landfärgs-plattan dem, så heron
    // ser ut som kartan REDAN FRÅN SERVER-HTML:EN (Josef 11/8: inget
    // "annat utseende" som byts en sekund senare — samma knep som huvudkartans
    // BOOTSTRAP_STYLE, fast den ljusa stadsnivå-tonen eftersom heron ligger på
    // zoom 11).
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        const el = holderRef.current;
        if (!el) return;
        let map: { remove: () => void } | null = null;
        let cancelled = false;

        const start = async () => {
            try {
                const [{ Map }, { fetchAndTransformThemeParkStyle }] = await Promise.all([
                    import('maplibre-gl'),
                    import('@/components/v2/v2MapBaseStyles'),
                ]);
                const style = await fetchAndTransformThemeParkStyle();
                if (cancelled) return;
                const m = new Map({
                    container: el,
                    style,
                    center: [lng, lat],
                    zoom,
                    interactive: false,
                    // Heron har redan sin egen © OpenStreetMap © CARTO-rad.
                    attributionControl: false,
                });
                map = m;
                m.on('load', () => { if (!cancelled) setReady(true); });
            } catch {
                // Ingen WebGL eller ingen stil — göm plattan så de statiska
                // kaklen under blir synliga igen.
                if (!cancelled) setFailed(true);
            }
        };

        // Starta först när heron faktiskt syns, och då med en kort fördröjning
        // så hydreringen av eventlistan inte samsas med maplibre-chunken.
        // (requestIdleCallback dög inte: i en dold/bakgrundsflik körs den
        // aldrig, och då stod heron kvar på de grå kaklen.)
        let timer = 0;
        const arm = () => { if (!timer) timer = window.setTimeout(start, 250); };
        const io = typeof IntersectionObserver === 'undefined' ? null
            : new IntersectionObserver(entries => {
                if (entries.some(en => en.isIntersecting)) { io?.disconnect(); arm(); }
            }, { rootMargin: '200px' });
        if (io) io.observe(el); else arm();

        return () => {
            cancelled = true;
            io?.disconnect();
            clearTimeout(timer);
            map?.remove();
        };
    }, [lat, lng, zoom]);

    return (
        <>
            {/* Landfärgs-plattan: ligger ÖVER rastret från första server-
                renderade rutan (inget Voyager-blink), och tas bara bort om GL
                fallerar. GL-canvasen tonas in ovanpå. */}
            <div
                aria-hidden
                className={`absolute inset-0 pointer-events-none transition-opacity duration-300 ${
                    failed ? 'opacity-0' : 'opacity-100'
                }`}
                style={{ backgroundColor: THEMEPARK_LAND_COLOR_NEAR }}
            />
            <div
                ref={holderRef}
                aria-hidden
                className={`absolute inset-0 overflow-hidden pointer-events-none transition-opacity duration-500 [&_canvas]:absolute [&_canvas]:left-0 [&_canvas]:top-0 ${
                    ready ? 'opacity-100' : 'opacity-0'
                }`}
            />
        </>
    );
}
