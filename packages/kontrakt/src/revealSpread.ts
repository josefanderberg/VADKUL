/**
 * Spridningen i reveal-urvalet (#200): när kartan är utzoomad tänds bara en
 * del av brickorna (zoom-ransonen 7/10), och med "populära först bland de 50
 * närmaste" klumpade de ihop sig i den tätaste trakten - står mitten över
 * Frölunda med hela centrala Göteborg i bild tändes allt i centrala Göteborg.
 * Josef 13/11: "så att det inte blir en klunga i göteborg bättre med
 * spridning ... eller någon skön uppdelning".
 *
 * Urvalet: kartan delas i rutor (fasta i KARTAN, inte i skärmen - annars
 * gled rutgränserna över eventen vid varje panorering och urvalet bytte hela
 * tiden), varje ruta ordnar sina event populära först
 * och sedan närmast rutans mitt, och rutorna turas om - närmast skärmens mitt
 * först - tills antalet är nått. Får alla rutor med event varsitt tar nästa
 * varv en till ur varje. Så hamnar de tända brickorna utspridda över bilden,
 * tätast kring mitten, och varje del av bilden visar sitt populäraste.
 *
 * Delas av webben (V2Map:s pickRevealKeys) och appen (lib/kartUrval) sedan
 * #261 - Josef 19/11: "när man är mycket utzoomat så prioriterar vi de
 * populäraste eventen på kartan. Alltså inte bara i mitten av skärmen", på
 * apparna likadant som på webben. Ändra här, aldrig i en kopia.
 *
 * KANTMARGINALEN (#262, Josef 19/11: "många precis på kanterna lyser upp, så
 * att mestadels av titlarna hamnar utanför. Kan vi sätta en liten margin på
 * vilka eventbrickor som dyker upp"): inga brickor tänds i en ram längs
 * bildens kanter (RevealInset) - spetsen måste stå så långt in att kroppen
 * och en titel under den ryms i bilden. REVEAL_EDGE_INSET är brickans egna
 * mått; appen lägger till sitt krom ovanpå. Gäller både utspridningen och
 * urvalet kring mitten (insideRevealView).
 *
 * Ren modul: inga webbläsar- eller kart-API:er.
 */

export interface SpreadCandidate {
    key: string;
    lat: number;
    lng: number;
    /** Populär (🔥) eller guld - först inom sin ruta. */
    pop: boolean;
}

/** Rutornas sida i skärmpixlar. */
export const REVEAL_SPREAD_CELL_PX = 180;

/** Ramen längs bildens kanter där inga brickor tänds, i skärmpixlar. */
export interface RevealInset {
    top: number;
    right: number;
    bottom: number;
    left: number;
}
export const NO_REVEAL_INSET: RevealInset = { top: 0, right: 0, bottom: 0, left: 0 };
/**
 * Brickans egna mått (#262): kroppen står ~55 px ovanför spetsen och 20 px åt
 * sidorna, titeln under spetsen ~20 px ner och oftast 40-70 px åt varje håll.
 * Sidorna och toppen räcker för kroppen plus luft, botten för en titelrad.
 */
export const REVEAL_EDGE_INSET: RevealInset = { top: 64, right: 40, bottom: 28, left: 40 };

/** Två ramar på varandra (t.ex. brickans mått + appens krom). */
export function addRevealInsets(a: RevealInset, b: RevealInset): RevealInset {
    return { top: a.top + b.top, right: a.right + b.right, bottom: a.bottom + b.bottom, left: a.left + b.left };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const mercatorX = (lng: number) => (lng + 180) / 360;
function mercatorY(lat: number): number {
    const s = Math.sin((clamp(lat, -85, 85) * Math.PI) / 180);
    return 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI);
}

/**
 * En punkts läge i skärmpixlar relativt bildens mitt (öster och söder
 * positivt), vid en viss zoom - norr uppåt, ingen lutning (samma förenkling
 * som utspridningen).
 */
export function revealViewOffset(
    point: { lat: number; lng: number },
    center: { lat: number; lng: number },
    zoom: number,
): { dx: number; dy: number } {
    const world = 512 * Math.pow(2, zoom);
    return {
        dx: (mercatorX(point.lng) - mercatorX(center.lng)) * world,
        dy: (mercatorY(point.lat) - mercatorY(center.lat)) * world,
    };
}

/** Står punkten (spetsen) innanför bilden minus ramen? */
export function insideRevealView(
    point: { lat: number; lng: number },
    center: { lat: number; lng: number },
    zoom: number,
    viewport: { width: number; height: number },
    inset: RevealInset = NO_REVEAL_INSET,
): boolean {
    if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng) || !Number.isFinite(zoom)) return false;
    const { dx, dy } = revealViewOffset(point, center, zoom);
    return inViewOffset(dx, dy, viewport, inset);
}

function inViewOffset(dx: number, dy: number, viewport: { width: number; height: number }, inset: RevealInset): boolean {
    const halfW = viewport.width / 2;
    const halfH = viewport.height / 2;
    return dx >= -halfW + inset.left && dx <= halfW - inset.right
        && dy >= -halfH + inset.top && dy <= halfH - inset.bottom;
}

/**
 * De `count` brickor som ska tändas, utspridda över vyn. `center` är vyns mitt
 * och `viewport` dess storlek i skärmpixlar; bara event inom vyn minus
 * kantramen (`inset`, #262) räknas. Returen är sorterad på avstånd till mitten.
 */
export function pickSpreadRevealKeys(
    points: readonly SpreadCandidate[],
    center: { lat: number; lng: number },
    zoom: number,
    viewport: { width: number; height: number },
    count: number,
    cellPx: number = REVEAL_SPREAD_CELL_PX,
    inset: RevealInset = NO_REVEAL_INSET,
): string[] {
    if (!(count > 0) || !Number.isFinite(zoom) || !(cellPx > 0)) return [];
    if (!(viewport.width > 0) || !(viewport.height > 0)) return [];
    const world = 512 * Math.pow(2, zoom);
    const cx = mercatorX(center.lng) * world;
    const cy = mercatorY(center.lat) * world;

    type Item = { key: string; pop: boolean; dCell: number; dCenter: number };
    const cells = new Map<string, { items: Item[]; dCenter: number; id: string }>();
    for (const p of points) {
        if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) continue;
        const ax = mercatorX(p.lng) * world;
        const ay = mercatorY(p.lat) * world;
        const dx = ax - cx;
        const dy = ay - cy;
        if (!inViewOffset(dx, dy, viewport, inset)) continue;
        // Rutan i världskoordinater - står still när kartan panoreras.
        const col = Math.floor(ax / cellPx);
        const row = Math.floor(ay / cellPx);
        const id = `${col}_${row}`;
        const mx = (col + 0.5) * cellPx - cx;
        const my = (row + 0.5) * cellPx - cy;
        let cell = cells.get(id);
        if (!cell) {
            cell = { items: [], dCenter: mx * mx + my * my, id };
            cells.set(id, cell);
        }
        cell.items.push({
            key: p.key,
            pop: p.pop,
            dCell: (dx - mx) * (dx - mx) + (dy - my) * (dy - my),
            dCenter: dx * dx + dy * dy,
        });
    }

    const order = [...cells.values()].sort((a, b) => a.dCenter - b.dCenter || (a.id < b.id ? -1 : 1));
    for (const c of order) {
        c.items.sort((a, b) => (Number(b.pop) - Number(a.pop)) || (a.dCell - b.dCell) || (a.key < b.key ? -1 : 1));
    }
    const picked: Item[] = [];
    for (let round = 0; picked.length < count; round++) {
        let any = false;
        for (const c of order) {
            const it = c.items[round];
            if (!it) continue;
            any = true;
            picked.push(it);
            if (picked.length >= count) break;
        }
        if (!any) break;
    }
    picked.sort((a, b) => a.dCenter - b.dCenter || (a.key < b.key ? -1 : 1));
    return picked.map(p => p.key);
}
