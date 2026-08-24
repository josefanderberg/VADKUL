/**
 * sweref99.ts — SWEREF99 TM (EPSG:3006) → WGS84, utan beroenden.
 *
 * Gauss-Krügers inversa formler med Lantmäteriets parametrar (GRS80,
 * medelmeridian 15°E, skala 0.9996, false easting 500 000). Behövs för
 * SCB:s öppna geodata (tätorter m.m.) som levereras i SWEREF99 TM.
 * Precision: <0,1 m — långt under vad eventkartan behöver.
 */

const A = 6378137.0;                 // GRS80 halva storaxeln
const F = 1 / 298.257222101;         // GRS80 avplattning
const K0 = 0.9996;
const LAMBDA0 = (15 * Math.PI) / 180;
const FALSE_E = 500000.0;

const e2 = F * (2 - F);
const n = F / (2 - F);
const aRoof = (A / (1 + n)) * (1 + n * n / 4 + (n ** 4) / 64);

const d1 = n / 2 - (2 * n * n) / 3 + (37 * n ** 3) / 96 - (n ** 4) / 360;
const d2 = (n * n) / 48 + (n ** 3) / 15 - (437 * n ** 4) / 1440;
const d3 = (17 * n ** 3) / 480 - (37 * n ** 4) / 840;
const d4 = (4397 * n ** 4) / 161280;

const Astar = e2 + e2 ** 2 + e2 ** 3 + e2 ** 4;
const Bstar = -(7 * e2 ** 2 + 17 * e2 ** 3 + 30 * e2 ** 4) / 6;
const Cstar = (224 * e2 ** 3 + 889 * e2 ** 4) / 120;
const Dstar = -(4279 * e2 ** 4) / 1260;

/** [northing, easting] i SWEREF99 TM → [lat, lng] i WGS84 (grader). */
export function sweref99tmToWgs84(northing: number, easting: number): [number, number] {
    const xi = northing / (K0 * aRoof);
    const eta = (easting - FALSE_E) / (K0 * aRoof);

    const xiPrim = xi
        - d1 * Math.sin(2 * xi) * Math.cosh(2 * eta)
        - d2 * Math.sin(4 * xi) * Math.cosh(4 * eta)
        - d3 * Math.sin(6 * xi) * Math.cosh(6 * eta)
        - d4 * Math.sin(8 * xi) * Math.cosh(8 * eta);
    const etaPrim = eta
        - d1 * Math.cos(2 * xi) * Math.sinh(2 * eta)
        - d2 * Math.cos(4 * xi) * Math.sinh(4 * eta)
        - d3 * Math.cos(6 * xi) * Math.sinh(6 * eta)
        - d4 * Math.cos(8 * xi) * Math.sinh(8 * eta);

    const phiStar = Math.asin(Math.sin(xiPrim) / Math.cosh(etaPrim));
    const deltaLambda = Math.atan2(Math.sinh(etaPrim), Math.cos(xiPrim));

    const sinPhi = Math.sin(phiStar);
    const phi = phiStar + sinPhi * Math.cos(phiStar) * (
        Astar + Bstar * sinPhi ** 2 + Cstar * sinPhi ** 4 + Dstar * sinPhi ** 6
    );

    return [(phi * 180) / Math.PI, ((LAMBDA0 + deltaLambda) * 180) / Math.PI];
}
