'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowUp } from 'lucide-react';
import type maplibregl from 'maplibre-gl';

// useLayoutEffect varnar vid SSR — komponenten är klient-only, men Next
// pre-renderar ändå trädet en gång. Faller tillbaka på useEffect på servern.
const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export interface SignpostCity { name: string; lat: number; lng: number }

interface CitySignpostsProps {
    /** Kartinstansen. Skyltarna ankras i geografiska punkter och projiceras om
     *  vid varje 'move' — de sitter fast i marken, inte i skärmen. */
    map: maplibregl.Map | null;
    /** Hela stadslistan (samma som bildspelets rutt) — komponenten väljer själv
     *  ut de närmaste utifrån var kartan står. */
    cities: SignpostCity[];
    /** Klick på en skylt: hoppa till staden. index = platsen i `cities`. */
    onPick: (city: SignpostCity, index: number) => void;
    /** Antal skyltar. Fler än 3 blir grötigt på mobil. */
    count?: number;
    /** Göm skyltarna helt (bildspelet står still, skapa-läge, utzoomad
     *  Sverigevy, öppna paneler …). */
    hidden?: boolean;
    /** Bumpas när KAMERAN flyttats programmatiskt (bildspelets stadshopp) →
     *  skyltarna sätts ut på nytt i den nya staden, efter att kameran landat.
     *  Egen panorering rör dem aldrig — se komponentens filhuvud. */
    placeKey?: number;
}

// Städer närmare än så räknas som "den vi står i" — ingen skylt till sig själv.
const OWN_CITY_KM = 20;
// Skyltarna placeras ut på en ellips inne i en säker yta: navbaren/stadsrutan i
// toppen och eventkortet i botten ska inte krocka med dem.
const SAFE_TOP = 190;
const SAFE_BOTTOM = 170;
const SAFE_SIDE = 20;
// Halva skyltens bredd/höjd — används för att klämma in dem i vyn.
const PLATE_HALF_W = 82;
const PLATE_HALF_H = 26;
// Hur mycket en skylt får luta. Riktningen syns exakt i pilen inuti; lutningen
// är bara en känsla (och text som står på huvudet går inte att läsa).
const MAX_TILT_DEG = 26;
// Två städer i nästan samma väderstreck hamnar på varandra. Skyltarna knuffas
// då isär tills de inte krockar — som plattorna på en riktig vägvisare.
const PUSH_HALF_W = 108;
const PUSH_HALF_H = 25;
const PUSH_ITERATIONS = 24;
// Hur länge vi som mest väntar in bildspelets kamerahopp innan skyltarna sätts
// ut ändå (V2Map fördröjer sitt jumpTo ~300 ms bakom stadsöverlägget).
const JUMP_SETTLE_MS = 1200;

const haversineKm = (lat1: number, lng1: number, lat2: number, lng2: number) => {
    const R = 6371;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
};

/** En utplacerad skylt. anchor = den geo-punkt skylten står på; allt annat är
 *  låst när skylten sattes ut och ändras inte när man panorerar. */
interface PlacedSign {
    city: SignpostCity;
    index: number;
    km: number;
    anchor: { lng: number; lat: number };
    pointsLeft: boolean;
    tilt: number;
    bearingDeg: number;
}

/**
 * Vägskyltar över kartan som pekar mot de närmaste städerna — VADKULs sätt att
 * byta stad. Ersätter den gamla "Nästa stad"-knappen: i stället för att bli
 * slängd till nästa stad i en rutt man inte ser väljer man själv väderstreck,
 * precis som vid en vägkorsning.
 *
 * Skyltarna SITTER FAST I KARTAN (Josef 9/8): de sätts ut en gång, i den
 * riktning staden ligger, och följer sedan med marken när man panorerar och
 * zoomar. De räknas ALDRIG om medan man rör kartan själv — panorerar man iväg
 * glider de lugnt ut ur bild och stannar där de står, precis som riktiga
 * skyltar. (Förut sattes de ut på nytt så fort en skylt hamnat utanför vyn
 * eller man zoomat — de "sprang efter" en över hela kartan.)
 *
 * Skyltarna hör till BILDSPELET (Josef 10/8) och visas bara medan det rullar —
 * de går inte att klicka fram på egen hand. Rör man kartan stoppas bildspelet
 * och skyltarna försvinner; play hämtar tillbaka dem.
 *
 * De placeras om bara när bildspelet flyttat kameran till en ny stad
 * (`placeKey`) eller vyn bytt storlek. Att de göms tillfälligt bakom
 * eventkortet eller multi-listan (`hidden`) flyttar dem INTE — annars blinkade
 * de fram på nya ställen så fort man bläddrade till nästa event.
 *
 * Storleken är konstant i pixlar; en skylt ska gå att läsa på alla zoomnivåer.
 */
export default function CitySignposts({
    map,
    cities,
    onPick,
    count = 3,
    hidden = false,
    placeKey = 0,
}: CitySignpostsProps) {
    const [signs, setSigns] = useState<PlacedSign[]>([]);
    // DOM-noderna, så vi kan flytta dem vid varje 'move' utan att rendera om
    // React-trädet (en pan fyrar 'move' i 60 Hz).
    const elRefs = useRef<Record<string, HTMLButtonElement | null>>({});

    /** Sätt ut skyltarna på nytt utifrån var kartan står just nu. */
    const place = useCallback(() => {
        if (!map) return;
        const container = map.getContainer();
        const vpW = container.clientWidth;
        const vpH = container.clientHeight;
        const center = map.getCenter();

        // Närmaste städerna, den vi står i bortsorterad.
        const near = cities
            .map((city, index) => ({
                city,
                index,
                km: haversineKm(center.lat, center.lng, city.lat, city.lng),
            }))
            .filter(c => c.km > OWN_CITY_KM)
            .sort((a, b) => a.km - b.km)
            .slice(0, count);

        // Säker yta att lägga skyltarna i. På låga vyer (liggande mobil) skulle
        // de fasta marginalerna äta upp hela höjden — då krymper de i stället.
        const insetTop = Math.min(SAFE_TOP, vpH * 0.28);
        const insetBottom = Math.min(SAFE_BOTTOM, vpH * 0.24);
        const left = SAFE_SIDE + PLATE_HALF_W;
        const right = vpW - SAFE_SIDE - PLATE_HALF_W;
        const top = insetTop + PLATE_HALF_H;
        const bottom = vpH - insetBottom - PLATE_HALF_H;
        // Får de inte plats alls: nolla — men behåll identiteten på en redan tom
        // lista, annars triggar setState en ny runda i placerings-effekten.
        if (right <= left || bottom <= top) { setSigns(prev => (prev.length ? [] : prev)); return; }
        const cx = (left + right) / 2;
        const cy = (top + bottom) / 2;
        const rx = (right - left) / 2;
        const ry = (bottom - top) / 2;

        const raw = near.map(({ city, index, km }) => {
            // Platt approximation räcker på Sverige-skala: dx österut, dy norrut.
            const midLat = ((center.lat + city.lat) / 2) * Math.PI / 180;
            const dx = (city.lng - center.lng) * Math.cos(midLat);
            const dy = city.lat - center.lat;
            // Skärmkoordinater har y nedåt → norr blir minus.
            const screenAngle = Math.atan2(-dy, dx);          // 0 = höger, -π/2 = upp
            const bearingDeg = (Math.atan2(dx, dy) * 180) / Math.PI; // 0 = norr, medurs

            const x = cx + Math.cos(screenAngle) * rx;
            const y = cy + Math.sin(screenAngle) * ry;

            // Skylten pekar åt det håll staden ligger; texten ska aldrig stå
            // upp och ner, så vi speglar i stället för att rotera hela varvet.
            const pointsLeft = Math.cos(screenAngle) < 0;
            const rawTilt = (screenAngle * 180) / Math.PI;
            const tilt = Math.max(
                -MAX_TILT_DEG,
                Math.min(MAX_TILT_DEG, pointsLeft ? rawTilt - (rawTilt > 0 ? 180 : -180) : rawTilt),
            );

            return { city, index, km, x, y, pointsLeft, tilt, bearingDeg };
        });

        // Knuffa isär skyltar som täcker varandra (två städer i samma
        // väderstreck) och håll dem innanför den säkra ytan.
        for (let iter = 0; iter < PUSH_ITERATIONS; iter++) {
            let moved = false;
            for (let i = 0; i < raw.length; i++) {
                for (let j = i + 1; j < raw.length; j++) {
                    const a = raw[i], b = raw[j];
                    const dx = b.x - a.x, dy = b.y - a.y;
                    const overlapX = PUSH_HALF_W * 2 - Math.abs(dx);
                    const overlapY = PUSH_HALF_H * 2 + 10 - Math.abs(dy);
                    if (overlapX <= 0 || overlapY <= 0) continue;
                    moved = true;
                    if (overlapY <= overlapX) {
                        const push = (overlapY / 2) * (dy >= 0 ? 1 : -1);
                        a.y -= push; b.y += push;
                    } else {
                        const push = (overlapX / 2) * (dx >= 0 ? 1 : -1);
                        a.x -= push; b.x += push;
                    }
                }
            }
            raw.forEach(s => {
                s.x = Math.min(Math.max(s.x, left), right);
                s.y = Math.min(Math.max(s.y, top), bottom);
            });
            if (!moved) break;
        }

        // Lås fast varje skylt i marken: skärmläget blir en geo-punkt.
        setSigns(raw.map(({ city, index, km, x, y, pointsLeft, tilt, bearingDeg }) => {
            const ll = map.unproject([x, y]);
            return { city, index, km, anchor: { lng: ll.lng, lat: ll.lat }, pointsLeft, tilt, bearingDeg };
        }));
    }, [map, cities, count]);

    // Spegling av signs — effekten nedan får INTE ha signs i sina deps
    // (place() sätter ny state → effekten hade satt igång sig själv i loop).
    const signsRef = useRef<PlacedSign[]>([]);
    useEffect(() => { signsRef.current = signs; }, [signs]);

    // Sätt ut skyltarna. INGA kartlyssnare för 'move'/'zoom': rör man kartan
    // själv ska de stå kvar i marken och glida ut ur bild. Det finns exakt TVÅ
    // anledningar att placera om — allt annat låter dem stå:
    //   1. placeKey — bildspelet har flyttat kameran till en ny stad,
    //   2. första gången (inga skyltar ute än) utan väntande stadshopp.
    // Att `hidden` slår av och på räcker INTE (Josef 9/8): den flaggan går
    // fram och tillbaka hela tiden av tillfälliga skäl — eventkortet öppnas,
    // man bläddrar till nästa event, multi-listan fälls ut, man zoomar ut en
    // aning — och en omplacering vid varje sådan gömning fick skyltarna att
    // blinka fram på nya ställen medan man bara klickade sig vidare.
    // Vystorleken lyssnar vi däremot fortfarande på: den säkra ytan är en annan
    // efter en rotation, och skyltarna kan hamna under navbaren.
    const prevPlaceKeyRef = useRef(placeKey);
    useEffect(() => {
        if (!map || hidden) return;
        const onResize = () => place();
        window.addEventListener('resize', onResize);
        const dropResize = () => window.removeEventListener('resize', onResize);

        // Inget stadshopp på gång: sätt bara ut dem om vi står helt utan
        // skyltar (allra första gången, eller efter en vy som var för liten).
        // Annars låt dem stå kvar där de står.
        if (placeKey === prevPlaceKeyRef.current) {
            if (signsRef.current.length === 0) place();
            return dropResize;
        }

        // Stadshopp. Kameran flyttar sig en bit EFTER att placeKey ändrats:
        // V2Map tonar in sitt stadsöverlägg i 300 ms och kör jumpTo först då.
        // Placerar vi direkt står skyltarna kvar i den gamla staden — vänta in
        // nästa 'moveend' (jumpTo fyrar ett) med en tidsgräns som säkerhet.
        let done = false;
        let timer = 0;
        const run = () => {
            if (done) return;
            done = true;
            map.off('moveend', run);
            window.clearTimeout(timer);
            place();
        };
        map.on('moveend', run);
        timer = window.setTimeout(run, JUMP_SETTLE_MS);
        return () => {
            done = true;
            map.off('moveend', run);
            window.clearTimeout(timer);
            dropResize();
        };
    }, [map, cities, count, hidden, placeKey, place]);
    // Efter placerings-effekten (körordning = deklarationsordning) så den hinner
    // se de GAMLA värdena.
    // placeKey kvitteras BARA när skyltarna är synliga: hoppar bildspelet till
    // en ny stad medan de är gömda (t.ex. play-knappen från en utzoomad vy)
    // måste hoppet ligga kvar och tas om hand så fort de kommer fram — annars
    // blev de stående kvar i den gamla staden, långt utanför bild.
    useEffect(() => { if (!hidden) prevPlaceKeyRef.current = placeKey; }, [placeKey, hidden]);

    // Projicera om skyltarna vid varje kartrörelse — utan omrendering.
    // useLayoutEffect + hidden i deps: när de kommer fram igen monteras
    // knapparna på nytt utan känt läge (transform utan position = uppe i
    // vänstra hörnet). Positionen måste sättas FÖRE målningen, annars ser man
    // dem hoppa in från hörnet.
    useIsoLayoutEffect(() => {
        if (!map || hidden || signs.length === 0) return;
        const update = () => {
            for (const s of signs) {
                const el = elRefs.current[s.city.name];
                if (!el) continue;
                const p = map.project([s.anchor.lng, s.anchor.lat]);
                el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -50%) rotate(${s.tilt}deg)`;
            }
        };
        update();
        map.on('move', update);
        return () => { map.off('move', update); };
    }, [map, signs, hidden]);

    if (hidden || signs.length === 0) return null;

    return (
        <div className="absolute inset-0 z-[900] overflow-hidden pointer-events-none">
            {signs.map(({ city, index, km, pointsLeft, tilt, bearingDeg }) => (
                <button
                    key={city.name}
                    ref={el => { elRefs.current[city.name] = el; }}
                    type="button"
                    onClick={() => onPick(city, index)}
                    aria-label={`Åk till ${city.name}, ${Math.round(km)} kilometer`}
                    // w-max: absolut placerade element krymper annars mot vyns
                    // högerkant och kapar stadsnamnet ("Stock…").
                    // left/top 0 + transform: hela positionen sätts imperativt av
                    // projektionen ovan, så skylten följer marken ruta för ruta.
                    // INGEN animate-in här: enter-animationen sätter en egen
                    // transform och skulle skriva över positionen medan den
                    // körs — skylten kom då glidande in från hörnet. Skyltarna
                    // ska stå på sin plats direkt (Josef 9/8). Den lilla
                    // intoningen ligger i stället på plattan inuti, som inte
                    // har någon egen position att förstöra.
                    className="pointer-events-auto absolute left-0 top-0 w-max origin-center transition-[filter] duration-200 hover:brightness-110 active:brightness-95"
                    style={{ transform: `translate(-50%, -50%) rotate(${tilt}deg)` }}
                >
                    {/* drop-shadow på wrappern: box-shadow skulle klippas bort av
                        clip-path:en som ger plattan sin spets. */}
                    <span className="block animate-in fade-in duration-150" style={{ filter: 'drop-shadow(0 5px 12px rgba(15,23,42,0.4))' }}>
                        {/* Gul kant runt HELA skylten — SPETSEN INKLUDERAD (Josef
                            9/8: man ska se åt vilket håll den pekar). En klippt
                            form kan inte ha border på sina diagonaler, så kanten
                            är i stället en YTTRE gul platta i pilform med den blå
                            plattan klippt i samma form 3 px innanför.
                            Inre spetsen är 12 px (mot yttre 14) — då blir
                            diagonalerna nästan parallella och kanten lika bred
                            hela vägen runt. */}
                        <span
                            className="block bg-[#FECC02] p-[3px]"
                            style={{
                                clipPath: pointsLeft
                                    ? 'polygon(14px 0, 100% 0, 100% 100%, 14px 100%, 0 50%)'
                                    : 'polygon(0 0, calc(100% - 14px) 0, 100% 50%, calc(100% - 14px) 100%, 0 100%)',
                            }}
                        >
                        <span
                            className="flex h-8 items-center gap-1.5 bg-[#006AA7]"
                            style={{
                                clipPath: pointsLeft
                                    ? 'polygon(12px 0, 100% 0, 100% 100%, 12px 100%, 0 50%)'
                                    : 'polygon(0 0, calc(100% - 12px) 0, 100% 50%, calc(100% - 12px) 100%, 0 100%)',
                                paddingLeft: pointsLeft ? 20 : 12,
                                paddingRight: pointsLeft ? 12 : 20,
                            }}
                        >
                            <ArrowUp
                                size={13}
                                strokeWidth={3}
                                className="shrink-0 text-[#FECC02]"
                                // Pilen visar EXAKT bäring — plattans lutning är
                                // kapad, så vi räknar bort den här.
                                style={{ transform: `rotate(${bearingDeg - tilt}deg)` }}
                            />
                            <span className="whitespace-nowrap text-[13px] font-black leading-none tracking-tight text-white">
                                {city.name}
                            </span>
                            <span className="shrink-0 text-[10px] font-black leading-none tabular-nums text-white/70">
                                {Math.round(km)} km
                            </span>
                        </span>
                        </span>
                    </span>
                </button>
            ))}
        </div>
    );
}
