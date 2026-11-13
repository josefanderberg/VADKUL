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

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const mercatorX = (lng: number) => (lng + 180) / 360;
function mercatorY(lat: number): number {
    const s = Math.sin((clamp(lat, -85, 85) * Math.PI) / 180);
    return 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI);
}

/**
 * De `count` brickor som ska tändas, utspridda över vyn. `center` är vyns mitt
 * och `viewport` dess storlek i skärmpixlar; bara event inom vyn räknas.
 * Returen är sorterad på avstånd till mitten.
 */
export function pickSpreadRevealKeys(
    points: readonly SpreadCandidate[],
    center: { lat: number; lng: number },
    zoom: number,
    viewport: { width: number; height: number },
    count: number,
    cellPx: number = REVEAL_SPREAD_CELL_PX,
): string[] {
    if (!(count > 0) || !Number.isFinite(zoom) || !(cellPx > 0)) return [];
    if (!(viewport.width > 0) || !(viewport.height > 0)) return [];
    const world = 512 * Math.pow(2, zoom);
    const cx = mercatorX(center.lng) * world;
    const cy = mercatorY(center.lat) * world;
    const halfW = viewport.width / 2;
    const halfH = viewport.height / 2;

    type Item = { key: string; pop: boolean; dCell: number; dCenter: number };
    const cells = new Map<string, { items: Item[]; dCenter: number; id: string }>();
    for (const p of points) {
        if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) continue;
        const ax = mercatorX(p.lng) * world;
        const ay = mercatorY(p.lat) * world;
        const dx = ax - cx;
        const dy = ay - cy;
        if (Math.abs(dx) > halfW || Math.abs(dy) > halfH) continue;
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
