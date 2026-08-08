'use client';

import { useEffect, useRef, useState } from 'react';

// Den RIKTIGA VADKUL-kartan bakom stads-heron.
//
// De statiska Carto-kaklen i CityMapHero är Voyagers grå-beige palett, medan
// huvudkartan kör "nöjesfält": samma Voyager-geometri men grönt land, blått
// vatten, vita vägar och beiga hus. Stadssidorna ska kännas som kartan — därför
// ritas samma stil här i en riktig MapLibre-canvas ovanpå kaklen och tonas in
// när den är klar. Kaklen ligger kvar som serverrenderad grund: de syns direkt,
// finns i HTML:en, och räddar heron om WebGL saknas eller stilen inte går att
// hämta.
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
                /* Ingen WebGL eller ingen stil — de statiska kaklen får stå kvar. */
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
        <div
            ref={holderRef}
            aria-hidden
            className={`absolute inset-0 overflow-hidden pointer-events-none transition-opacity duration-500 [&_canvas]:absolute [&_canvas]:left-0 [&_canvas]:top-0 ${
                ready ? 'opacity-100' : 'opacity-0'
            }`}
        />
    );
}
