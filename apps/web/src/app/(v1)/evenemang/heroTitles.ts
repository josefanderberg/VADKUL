import type { HeroMarker } from './heroMarkers';

/**
 * heroTitles.ts - var eventens titlar hamnar runt brickorna i stads-heron
 * (#267, Josef 20/11: "Uppdatera även stadssidornas karta. att man ser
 * titlarna på eventen").
 *
 * Stora kartan låter MapLibre placera titlarna (under, höger, vänster, över,
 * bara där de får plats - kart-ui #196/#204). Heron är en färdig bild med
 * brickorna som DOM ovanpå, så här görs samma sak för hand: varje bricka
 * prövar lägena i stora kartans ordning och tar det första där titeln varken
 * krockar med en annan bricka, en redan placerad titel eller hamnar utanför
 * kartrutan. Får den inte plats någonstans blir brickan utan titel.
 *
 * Ren funktion: måtten uppskattas ur texten (ingen DOM-mätning), så den går
 * att testa och ger samma svar varje gång.
 */

/** Textens mått i heron. Ändras typsnittet i CityMapHeroMarkers måste de här
 *  följa med, annars stämmer inte krockrutorna. */
export const HERO_TITLE_FONT_PX = 11;
export const HERO_TITLE_LINE_PX = 13;

type Box = { x0: number; y0: number; x1: number; y1: number };

/**
 * Brickans kropp runt spetsen (0,0), i px. Droppen är 32 px, flyttad
 * translate(-50%, -92%) och vriden 45 grader (CityMapHeroMarkers): kroppen
 * ligger från 30 px över ankaret till 10 px under, 17 px åt varje sida.
 */
const BRICK_BOX: Box = { x0: -17, y0: -30, x1: 17, y1: 10 };
/** Antalsbubblan på en bricka med flera event (left 8, top -40, 16 px hög). */
const BADGE_BOX: Box = { x0: 8, y0: -40, x1: 30, y1: -24 };
/** Luft mellan brickan och titeln. */
const GAP = 2;
/** Luft mot kartrutans kant. */
const EDGE = 3;

export type HeroTitleSide = 'under' | 'right' | 'left' | 'over';

/** En placerad titel: rutan räknad från brickans ankare (spetsen). */
export type HeroTitle = {
    text: string;
    side: HeroTitleSide;
    /** Rutans övre vänstra hörn, px från brickans ankare. */
    x: number;
    y: number;
    w: number;
};

/** Stora kartans ordning: under först, sedan höger, vänster och över. */
const SIDES: readonly HeroTitleSide[] = ['under', 'right', 'left', 'over'];

/**
 * Textens bredd i px, uppskattad per tecken för fet 11 px-text. Hellre lite
 * för brett än för smalt: en för smal ruta ger titlar som nuddar varandra.
 */
export function heroTitleWidth(text: string): number {
    let w = 0;
    for (const ch of Array.from(text)) {
        if (ch === ' ') w += 3.2;
        else if ('iljI.,:;!\'|'.includes(ch)) w += 3.6;
        else if ('mwMW…'.includes(ch)) w += 9.6;
        else if (ch >= '0' && ch <= '9') w += 6.6;
        else if (ch !== ch.toLowerCase()) w += 7.6;   // versaler
        else w += 6.3;
    }
    return Math.ceil(w) + 2;
}

function titleBox(side: HeroTitleSide, w: number, hasBadge: boolean): Box {
    const h = HERO_TITLE_LINE_PX;
    switch (side) {
        case 'under': return { x0: -w / 2, y0: BRICK_BOX.y1 + GAP, x1: w / 2, y1: BRICK_BOX.y1 + GAP + h };
        case 'right': {
            const x0 = BRICK_BOX.x1 + GAP;
            return { x0, y0: -10 - h / 2, x1: x0 + w, y1: -10 + h / 2 };
        }
        case 'left': {
            const x1 = BRICK_BOX.x0 - GAP;
            return { x0: x1 - w, y0: -10 - h / 2, x1, y1: -10 + h / 2 };
        }
        case 'over': {
            const y1 = (hasBadge ? BADGE_BOX.y0 : BRICK_BOX.y0) - GAP;
            return { x0: -w / 2, y0: y1 - h, x1: w / 2, y1 };
        }
    }
}

const shift = (b: Box, dx: number, dy: number): Box => ({ x0: b.x0 + dx, y0: b.y0 + dy, x1: b.x1 + dx, y1: b.y1 + dy });
const overlaps = (a: Box, b: Box) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
const inside = (a: Box, b: Box) => a.x0 >= b.x0 && a.x1 <= b.x1 && a.y0 >= b.y0 && a.y1 <= b.y1;

/**
 * Titlarna för de brickor heron ritar, i samma ordning som `markers`
 * (null = ingen titel fick plats).
 *
 * `markers` kommer i prioritetsordning (tidigast först, pickHeroMarkers), och
 * titlarna delas ut i den ordningen: det tidigaste eventet väljer läge först.
 *
 * `halfW`/`halfH` = halva kartrutan i px (brickornas dx/dy räknas från mitten).
 * `topReserve` = remsan i överkant där periodchipsen ligger - där läggs ingen
 * titel.
 */
export function placeHeroTitles(
    markers: readonly HeroMarker[],
    opts: { halfW: number; halfH: number; topReserve?: number },
): (HeroTitle | null)[] {
    const { halfW, halfH } = opts;
    const bounds: Box = {
        x0: -halfW + EDGE,
        y0: -halfH + (opts.topReserve ?? 0) + EDGE,
        x1: halfW - EDGE,
        y1: halfH - EDGE,
    };

    // Alla brickors kroppar (och antalsbubblor) är hinder för alla titlar,
    // även för brickor som själva blir utan titel.
    const bodies: { owner: number; box: Box }[] = [];
    markers.forEach((m, i) => {
        bodies.push({ owner: i, box: shift(BRICK_BOX, m.e.dx, m.e.dy) });
        if (m.count > 1) bodies.push({ owner: i, box: shift(BADGE_BOX, m.e.dx, m.e.dy) });
    });

    const placed: Box[] = [];
    return markers.map((m, i) => {
        const text = m.e.title;
        if (!text) return null;
        // Brickor utanför rutan (smal skärm beskär bilden) får ingen titel.
        if (Math.abs(m.e.dx) > halfW || Math.abs(m.e.dy) > halfH) return null;
        const w = heroTitleWidth(text);
        for (const side of SIDES) {
            const rel = titleBox(side, w, m.count > 1);
            const box = shift(rel, m.e.dx, m.e.dy);
            if (!inside(box, bounds)) continue;
            if (bodies.some(b => b.owner !== i && overlaps(box, b.box))) continue;
            if (placed.some(p => overlaps(box, p))) continue;
            placed.push(box);
            return { text, side, x: rel.x0, y: rel.y0, w };
        }
        return null;
    });
}
