/**
 * Zoom-bannerns MÅLPUNKT (Josef 1/10: "när man zoomar in ... hamnar centrerat
 * över de markörerna som finns ... centrera oss mer i den genomsnittliga mitt
 * av de markörer som finns"). Förr flög "🔍 Zooma in över {stad}" till ortens
 * mittpunkt (cityPoints), och där låg ofta bara en del av eventen - resten
 * hamnade vid sidan av.
 *
 * Genomsnittet av ALLA markörer i orten räcker inte: målzoomen visar bara
 * ~1,5 km tvärs en mobilskärm, så en ensam markör i utkanten drog mitten så
 * långt att klungan i centrum hamnade halvt utanför bild. Därför:
 *   1. markörerna inom CITY_RADIUS_KM från orten (samma "i orten"-mått som
 *      stadssidornas utbud, ≤ 10 km),
 *   2. den markör som har FLEST grannar inom CLUSTER_RADIUS_KM (lika många →
 *      den närmast ortens mitt),
 *   3. mitten = genomsnittet av den markörens grannar (inklusive den själv).
 * Inga markörer i orten → ortens mittpunkt, som förut.
 *
 * Ren logik, testas i zoomInCenter.test.ts.
 */

export interface LatLngPoint {
    lat: number;
    lng: number;
}

export const CITY_RADIUS_KM = 10;
export const CLUSTER_RADIUS_KM = 1;

// Ekvirektangulär närmelse - exakt nog på några km, och billig i O(n²)-loopen.
function distKm(a: LatLngPoint, b: LatLngPoint): number {
    const kx = 111.32 * Math.cos(((a.lat + b.lat) / 2) * Math.PI / 180);
    const dx = (a.lng - b.lng) * kx;
    const dy = (a.lat - b.lat) * 110.57;
    return Math.sqrt(dx * dx + dy * dy);
}

export function zoomInCenter(
    points: LatLngPoint[],
    city: LatLngPoint,
    cityRadiusKm = CITY_RADIUS_KM,
    clusterRadiusKm = CLUSTER_RADIUS_KM,
): LatLngPoint {
    const near = points.filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng) && distKm(p, city) <= cityRadiusKm);
    if (near.length === 0) return { lat: city.lat, lng: city.lng };

    let best: LatLngPoint[] = [];
    let bestCityDist = Infinity;
    for (const p of near) {
        const members = near.filter(q => distKm(p, q) <= clusterRadiusKm);
        const cityDist = distKm(p, city);
        if (members.length > best.length || (members.length === best.length && cityDist < bestCityDist)) {
            best = members;
            bestCityDist = cityDist;
        }
    }
    const lat = best.reduce((s, p) => s + p.lat, 0) / best.length;
    const lng = best.reduce((s, p) => s + p.lng, 0) / best.length;
    return { lat, lng };
}
