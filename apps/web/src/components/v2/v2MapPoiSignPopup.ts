/**
 * Tryck på en platsskylt visar vad den är (#225): "Badplats" och platsens namn
 * när kaklen har ett. Josef 13/11: "det kan väl komma upp vad det är om man
 * klickar på en skylt okså. gärna namnet på badplatsen eller naturreservatet."
 *
 * queryRenderedFeatures är opålitlig i V2Map (kan kasta eller ge skräpträffar,
 * se kommentaren vid kartans klick-lyssnare). Den används här ändå, eftersom
 * bara den vet vilka skyltar som faktiskt ritats - men ALDRIG rakt av: frågan
 * gäller bara skyltlagret, ligger i try/catch, och varje träff räknas om från
 * sin egen koordinat och måste ligga under trycket (utils/mapPoiSigns
 * pickPoiSignHit, testad). Skräpträffar faller bort där.
 */
import * as maplibregl from 'maplibre-gl';
import { POI_SIGN_HIT, POI_SIGN_LAYER_ID, pickPoiSignHit, poiSignInfo, type PoiSignInfo } from '@/utils/mapPoiSigns';

export interface PoiSignPopup {
    /** Ett tryck på kartan som inte tog en eventbricka. true = en skylt träffades. */
    handleClick(point: { x: number; y: number }): boolean;
    close(): void;
    remove(): void;
}

interface Hit { info: PoiSignInfo; lngLat: [number, number] }

function findSign(map: maplibregl.Map, point: { x: number; y: number }): Hit | null {
    if (!map.getLayer(POI_SIGN_LAYER_ID)) return null;
    let features: maplibregl.MapGeoJSONFeature[] = [];
    try {
        features = map.queryRenderedFeatures(
            [
                [point.x - POI_SIGN_HIT.halfWidth, point.y - POI_SIGN_HIT.below],
                [point.x + POI_SIGN_HIT.halfWidth, point.y + POI_SIGN_HIT.above],
            ],
            { layers: [POI_SIGN_LAYER_ID] },
        );
    } catch {
        return null;
    }
    const hits: Hit[] = [];
    const feet: { x: number; y: number }[] = [];
    for (const f of features) {
        if (f.geometry.type !== 'Point') continue;
        const info = poiSignInfo(f.properties?.kind, f.properties?.name);
        if (!info) continue;
        const lngLat = f.geometry.coordinates as [number, number];
        const p = map.project(lngLat);
        hits.push({ info, lngLat });
        feet.push({ x: p.x, y: p.y });
    }
    const index = pickPoiSignHit(feet, point);
    return index == null ? null : hits[index];
}

function content(info: PoiSignInfo): HTMLElement {
    const el = document.createElement('div');
    el.className = 'text-center leading-tight';
    const type = document.createElement('div');
    type.className = info.name
        ? 'text-[10px] font-bold uppercase tracking-wider text-slate-500'
        : 'text-sm font-bold text-slate-900';
    type.textContent = info.type;
    el.appendChild(type);
    if (info.name) {
        const name = document.createElement('div');
        name.className = 'text-sm font-bold text-slate-900';
        name.textContent = info.name;
        el.appendChild(name);
    }
    return el;
}

export function createPoiSignPopup(map: maplibregl.Map): PoiSignPopup {
    let popup: maplibregl.Popup | null = null;
    const close = () => {
        popup?.remove();
        popup = null;
    };
    return {
        handleClick(point) {
            const hit = findSign(map, point);
            close();
            if (!hit) return false;
            popup = new maplibregl.Popup({
                closeButton: false,
                // Vi stänger själva: nästa kartklick går genom handleClick.
                closeOnClick: false,
                anchor: 'bottom',
                offset: POI_SIGN_HIT.above,
                maxWidth: '220px',
                className: 'vadkul-skylt-popup',
            })
                .setLngLat(hit.lngLat)
                .setDOMContent(content(hit.info))
                .addTo(map);
            return true;
        },
        close,
        remove: close,
    };
}
