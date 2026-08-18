'use client';

// Kartan — var grupperna ligger, i vilket skick de är, och var vitfläckarna är.
//
// Tre lager underifrån: eventens heatmap (var det FAKTISKT händer saker),
// gruppernas täckningsytor, och nålarna. Tomrummet mellan gult och nålar är
// listan under kartan: orter med event men ingen grupp.
//
// Popup:en är en React-panel under kartan i stället för maplibres egen. Den
// ska innehålla knappar som anropar API:t, och det blir mycket enklare i React
// än i en HTML-sträng.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useAuth } from '@/context/AuthContext';
import { STREETS_STYLE_URL } from '@/components/v2/v2MapBaseStyles';
import { ExternalLink, Image as ImageIcon, MapPin, Plus, RefreshCw, Search, Wand2 } from 'lucide-react';
import AddGroupForm from './AddGroupForm';

/* ── Typer (speglar /api/admin/outreach/map) ──────────────────────────────── */

interface GroupProps {
    id: string;
    name: string;
    city: string | null;
    citySlug: string | null;
    status: string;
    memberCount: number | null;
    nextAllowedAt: number | null;
    lastPostedAt: number | null;
    postCount: number;
    groupUrl: string | null;
    groupPrivacy: string;
    pagesAllowed: boolean | null;
    geoSource: string;
    radiusKm: number;
    eventSupply: number;
    adImageUrl: string;    // brandad — till Sidan/annonser
    mapImageUrl: string;   // ren karta — till grupperna
}

interface Vitflack {
    name: string; lat: number; lng: number;
    eventSupply: number; närmasteGrupp: number | null; sokord: string;
}

interface MapResponse {
    generatedAt: number;
    geojson: GeoJSON.FeatureCollection<GeoJSON.Point, GroupProps>;
    heatmap: GeoJSON.FeatureCollection<GeoJSON.Point, { vikt: number }>;
    vitflackar: Vitflack[];
    utanKoordinat: { id: string; name: string }[];
    counts: { grupper: number; placerade: number; utanKoordinat: number; eventDennaVecka: number };
}

/* ── Statusfärgerna ───────────────────────────────────────────────────────── */

const STATUS_COLOR: Record<string, string> = {
    'orörd': '#94a3b8',
    'utkast': '#a78bfa',
    'postad': '#10b981',
    'väntar-godkännande': '#f59e0b',
    'karens': '#38bdf8',
    'nekad': '#f43f5e',
    'borttagen': '#991b1b',
    'avskriven': '#cbd5e1',
};

const STATUS_LABEL: Record<string, string> = {
    'orörd': 'Orörd',
    'utkast': 'Utkast klart',
    'postad': 'Postad, uppe',
    'väntar-godkännande': 'I godkännandekö',
    'karens': 'Karens',
    'nekad': 'Nekad',
    'borttagen': 'Borttagen',
    'avskriven': 'Avskriven',
};

/**
 * MapLibre-uttryck: färg ur status-egenskapen, byggt ur STATUS_COLOR så
 * legenden och kartan aldrig kan glida isär.
 *
 * Cast via unknown för att ExpressionSpecification är en TUPEL-typ — den kan
 * inte uttrycka "ett godtyckligt antal nyckel/värde-par", så en spread matchar
 * den aldrig oavsett hur rätt innehållet är.
 */
const COLOR_EXPR = [
    'match', ['get', 'status'],
    ...Object.entries(STATUS_COLOR).flatMap(([k, v]) => [k, v]),
    STATUS_COLOR['orörd'],
] as unknown as maplibregl.ExpressionSpecification;

/**
 * Täckningsytan som riktig cirkel på marken. MapLibres circle-radius är i
 * PIXLAR, så en cirkel-layer skulle behålla sin storlek när man zoomar och
 * ljuga om täckningen. En 48-hörning per grupp är exakt och kostar inget vid
 * 85 grupper.
 */
function circlePolygon(lat: number, lng: number, radiusKm: number, steps = 48): number[][] {
    const ring: number[][] = [];
    const dLatMax = radiusKm / 111.32;
    const dLngMax = radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180));
    for (let i = 0; i <= steps; i++) {
        const a = (i / steps) * 2 * Math.PI;
        ring.push([lng + dLngMax * Math.sin(a), lat + dLatMax * Math.cos(a)]);
    }
    return ring;
}

/* ── Panelen ──────────────────────────────────────────────────────────────── */

export default function MapPanel() {
    const { user } = useAuth();
    const holder = useRef<HTMLDivElement | null>(null);
    const map = useRef<maplibregl.Map | null>(null);
    const [ready, setReady] = useState(false);

    const [data, setData] = useState<MapResponse | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [selected, setSelected] = useState<GroupProps | null>(null);
    const [geoMsg, setGeoMsg] = useState<string | null>(null);

    const authFetch = useCallback(async (url: string, init?: RequestInit) => {
        if (!user) throw new Error('Inte inloggad');
        const token = await user.getIdToken();
        return fetch(url, { ...init, headers: { ...init?.headers, Authorization: `Bearer ${token}` } });
    }, [user]);

    const load = useCallback(async () => {
        setBusy(true);
        setError(null);
        try {
            const res = await authFetch('/api/admin/outreach/map');
            if (!res.ok) { setError(`Kunde inte hämta kartan (${res.status}).`); return; }
            setData(await res.json());
        } catch {
            setError('Nätverksfel — försök igen.');
        } finally {
            setBusy(false);
        }
    }, [authFetch]);

    useEffect(() => { load(); }, [load]);

    /* ── Kartan ── */
    useEffect(() => {
        if (!holder.current || map.current) return;
        const m = new maplibregl.Map({
            container: holder.current,
            style: STREETS_STYLE_URL,
            center: [16.5, 62.5],
            zoom: 3.6,
            attributionControl: false,
        });
        m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
        m.on('load', () => setReady(true));
        map.current = m;
        return () => { m.remove(); map.current = null; };
    }, []);

    /* ── Lagren ── */
    const coverage = useMemo<GeoJSON.FeatureCollection<GeoJSON.Polygon> | null>(() => {
        if (!data) return null;
        return {
            type: 'FeatureCollection',
            features: data.geojson.features.map(f => ({
                type: 'Feature' as const,
                geometry: {
                    type: 'Polygon' as const,
                    coordinates: [circlePolygon(
                        f.geometry.coordinates[1], f.geometry.coordinates[0], f.properties.radiusKm,
                    )],
                },
                properties: { status: f.properties.status },
            })),
        };
    }, [data]);

    useEffect(() => {
        const m = map.current;
        if (!m || !ready || !data || !coverage) return;

        const src = (id: string, d: GeoJSON.FeatureCollection) => {
            const existing = m.getSource(id) as maplibregl.GeoJSONSource | undefined;
            if (existing) existing.setData(d as never);
            else m.addSource(id, { type: 'geojson', data: d as never });
        };

        src('om-heat', data.heatmap);
        src('om-coverage', coverage);
        src('om-groups', data.geojson);

        if (!m.getLayer('om-heat')) {
            m.addLayer({
                id: 'om-heat',
                type: 'heatmap',
                source: 'om-heat',
                paint: {
                    'heatmap-weight': ['interpolate', ['linear'], ['get', 'vikt'], 1, 0.25, 40, 1],
                    'heatmap-intensity': 0.7,
                    'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 3, 10, 10, 34],
                    'heatmap-opacity': 0.75,
                    'heatmap-color': [
                        'interpolate', ['linear'], ['heatmap-density'],
                        0, 'rgba(0,0,0,0)',
                        0.3, 'rgba(253,224,71,0.45)',
                        0.7, 'rgba(251,146,60,0.7)',
                        1, 'rgba(239,68,68,0.85)',
                    ],
                },
            });
        }
        if (!m.getLayer('om-coverage')) {
            m.addLayer({
                id: 'om-coverage',
                type: 'fill',
                source: 'om-coverage',
                paint: { 'fill-color': COLOR_EXPR, 'fill-opacity': 0.13 },
            });
        }
        if (!m.getLayer('om-groups')) {
            m.addLayer({
                id: 'om-groups',
                type: 'circle',
                source: 'om-groups',
                paint: {
                    'circle-color': COLOR_EXPR,
                    // Medlemsantal → storlek. Okänt antal ger minsta pricken.
                    'circle-radius': [
                        'interpolate', ['linear'], ['coalesce', ['get', 'memberCount'], 0],
                        0, 6, 1000, 9, 10000, 14, 40000, 20,
                    ],
                    // Gissad koordinat får bärnstensfärgad ring i stället för vit.
                    // (maplibre kan inte strecka cirkelkanter — färg är signalen.)
                    'circle-stroke-color': [
                        'case', ['==', ['get', 'geoSource'], 'gissad-ur-namnet'], '#f59e0b', '#ffffff',
                    ],
                    'circle-stroke-width': 2.5,
                },
            });
        }

        const onClick = (e: maplibregl.MapMouseEvent) => {
            const f = m.queryRenderedFeatures(e.point, { layers: ['om-groups'] })[0];
            if (f) setSelected(f.properties as unknown as GroupProps);
        };
        const enter = () => { m.getCanvas().style.cursor = 'pointer'; };
        const leave = () => { m.getCanvas().style.cursor = ''; };
        m.on('click', 'om-groups', onClick);
        m.on('mouseenter', 'om-groups', enter);
        m.on('mouseleave', 'om-groups', leave);
        return () => {
            m.off('click', 'om-groups', onClick);
            m.off('mouseenter', 'om-groups', enter);
            m.off('mouseleave', 'om-groups', leave);
        };
    }, [ready, data, coverage]);

    const flyTo = useCallback((lat: number, lng: number, zoom = 9) => {
        map.current?.flyTo({ center: [lng, lat], zoom, duration: 900 });
    }, []);

    /* ── Geokodning ── */
    const geocode = useCallback(async (commit: boolean) => {
        setBusy(true);
        setGeoMsg(null);
        try {
            const res = await authFetch('/api/admin/outreach/geocode', { method: commit ? 'POST' : 'GET' });
            const json = await res.json();
            if (!res.ok) { setGeoMsg(json.error ?? 'Geokodningen misslyckades.'); return; }
            const s = json.summering;
            setGeoMsg(
                `${commit ? 'Skrev' : 'Torrkörning'}: ${s.kanSättas} kan sättas ` +
                `(varav ${s.varavGissade} gissade), ${s.redanSatta} hade redan koordinat, ` +
                `${s.gickInteAttTyda} gick inte att tyda.`,
            );
            if (commit) await load();
        } catch {
            setGeoMsg('Nätverksfel.');
        } finally {
            setBusy(false);
        }
    }, [authFetch, load]);

    /* ── Rendering ── */
    return (
        <div className="flex flex-col gap-4">
            {error && <p className="text-sm font-bold text-rose-600">{error}</p>}

            <div className="flex flex-wrap items-center gap-2">
                <button onClick={load} disabled={busy}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-100 transition-colors disabled:opacity-50">
                    <RefreshCw size={13} className={busy ? 'animate-spin' : ''} /> Uppdatera
                </button>
                <button onClick={() => geocode(false)} disabled={busy}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-100 transition-colors disabled:opacity-50">
                    <Wand2 size={13} /> Torrkör geokodning
                </button>
                <button onClick={() => geocode(true)} disabled={busy}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#006AA7] text-white font-bold text-xs hover:bg-[#005590] transition-colors disabled:opacity-50">
                    <Wand2 size={13} /> Geokoda grupper
                </button>
                {data && (
                    <span className="text-xs font-bold text-slate-400">
                        {data.counts.placerade}/{data.counts.grupper} placerade · {data.counts.eventDennaVecka.toLocaleString('sv-SE')} event denna vecka
                    </span>
                )}
            </div>

            {geoMsg && <p className="text-xs font-bold text-slate-600 bg-slate-100 rounded-xl px-3 py-2">{geoMsg}</p>}

            {/* Kartan */}
            <div className="relative">
                <div ref={holder} className="h-[520px] w-full rounded-xl overflow-hidden border border-slate-200 bg-slate-100" />
                <Legend />
            </div>

            {selected && <GroupCard g={selected} onClose={() => setSelected(null)} />}

            {data && data.utanKoordinat.length > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5">
                    <p className="text-xs font-black text-amber-800 mb-1.5">
                        {data.utanKoordinat.length} grupper saknar koordinat och syns inte på kartan
                    </p>
                    <p className="text-xs font-semibold text-amber-700">
                        {data.utanKoordinat.map(u => u.name).join(' · ')}
                    </p>
                </div>
            )}

            {data && <Whitespace rows={data.vitflackar} onPick={flyTo} onSaved={load} />}
        </div>
    );
}

/* ── Delkomponenter ───────────────────────────────────────────────────────── */

function Legend() {
    return (
        <div className="absolute bottom-3 left-3 rounded-xl bg-white/95 border border-slate-200 px-3 py-2 flex flex-wrap gap-x-3 gap-y-1 max-w-[calc(100%-1.5rem)]">
            {Object.entries(STATUS_LABEL).map(([k, label]) => (
                <span key={k} className="inline-flex items-center gap-1.5 text-[10px] font-bold text-slate-600">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: STATUS_COLOR[k] }} />
                    {label}
                </span>
            ))}
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-amber-600">
                <span className="w-2.5 h-2.5 rounded-full border-2 border-amber-500 bg-white" />
                Gissad koordinat
            </span>
        </div>
    );
}

function GroupCard({ g, onClose }: { g: GroupProps; onClose: () => void }) {
    const karens = g.nextAllowedAt && g.nextAllowedAt > Date.now()
        ? Math.ceil((g.nextAllowedAt - Date.now()) / 86_400_000)
        : 0;

    return (
        <div className="rounded-xl border border-slate-200 bg-white p-3.5">
            <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                    <p className="text-sm font-black text-slate-800">{g.name}</p>
                    <p className="text-xs font-bold text-slate-400">
                        <span style={{ color: STATUS_COLOR[g.status] }}>{STATUS_LABEL[g.status] ?? g.status}</span>
                        {karens > 0 && ` · ${karens} dygn kvar av karensen`}
                        {g.memberCount ? ` · ${g.memberCount.toLocaleString('sv-SE')} medlemmar` : ''}
                        {` · ${g.eventSupply} event inom ${g.radiusKm} km denna vecka`}
                    </p>
                    {g.geoSource === 'gissad-ur-namnet' && (
                        <p className="text-xs font-bold text-amber-600 mt-1">
                            ⚠️ Koordinaten är gissad ur gruppnamnet — kolla att den stämmer.
                        </p>
                    )}
                </div>
                <button onClick={onClose} className="text-xs font-bold text-slate-400 hover:text-slate-600">Stäng</button>
            </div>
            <div className="flex flex-wrap gap-2">
                {g.groupUrl && (
                    <a href={g.groupUrl} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-100 transition-colors">
                        <ExternalLink size={12} /> Öppna gruppen
                    </a>
                )}
                <a href={g.mapImageUrl} target="_blank" rel="noopener noreferrer"
                    title="Ren karta utan logga — den som funkar i grupper"
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-100 transition-colors">
                    <ImageIcon size={12} /> Kartbild (grupp)
                </a>
                <a href={g.adImageUrl} target="_blank" rel="noopener noreferrer"
                    title="Med logga och vadkul.se — till Sidan och annonser"
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-slate-500 font-bold text-xs hover:bg-slate-100 transition-colors">
                    <ImageIcon size={12} /> Annonsbild (Sidan)
                </a>
                {g.citySlug && (
                    <a href={`/evenemang/${g.citySlug}`} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-100 transition-colors">
                        <MapPin size={12} /> Stadssidan
                    </a>
                )}
            </div>
        </div>
    );
}

function Whitespace({ rows, onPick, onSaved }: {
    rows: Vitflack[];
    onPick: (lat: number, lng: number) => void;
    onSaved: () => void;
}) {
    const [n, setN] = useState(15);
    // Vilken vitfläcksrad som har spara-formuläret öppet (en i taget räcker).
    const [addFor, setAddFor] = useState<string | null>(null);

    return (
        <div className="rounded-xl border border-slate-200 bg-white p-3.5">
            <p className="text-sm font-black text-slate-800 mb-1">Vitfläckar — det händer saker, men vi saknar grupp</p>
            <p className="text-xs font-semibold text-slate-500 mb-3">
                Orter med event kommande vecka och ingen grupp inom 25 km, mest event först.
                Sökordet är färdigt att klistra in i Facebooks sökruta — hittar du en grupp:
                Spara grupp på raden, så följer ortens koordinat med och gruppen dyker upp i Städer.
            </p>
            <ul className="flex flex-col divide-y divide-slate-100">
                {rows.slice(0, n).map(r => (
                    <li key={r.name} className="py-2">
                        <div className="flex items-center justify-between gap-3">
                            <button onClick={() => onPick(r.lat, r.lng)}
                                className="text-left text-xs font-bold text-slate-700 hover:text-[#006AA7] transition-colors">
                                {r.name}
                                <span className="font-semibold text-slate-400">
                                    {' · '}{r.eventSupply} event
                                    {r.närmasteGrupp !== null && ` · närmsta grupp ${r.närmasteGrupp} km bort`}
                                </span>
                            </button>
                            <div className="shrink-0 flex items-center gap-1.5">
                                <a href={`https://www.facebook.com/search/groups/?q=${encodeURIComponent(r.sokord)}`}
                                    target="_blank" rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 font-bold text-[11px] hover:bg-slate-100 transition-colors">
                                    <Search size={11} /> Sök grupp
                                </a>
                                <button onClick={() => setAddFor(v => v === r.name ? null : r.name)}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#006AA7] text-white font-bold text-[11px] hover:bg-[#005590] transition-colors">
                                    <Plus size={11} /> Spara grupp
                                </button>
                            </div>
                        </div>
                        {addFor === r.name && (
                            <div className="mt-2">
                                <AddGroupForm
                                    initial={{ city: r.name, lat: r.lat, lng: r.lng }}
                                    onSaved={() => { setAddFor(null); onSaved(); }}
                                    onClose={() => setAddFor(null)}
                                />
                            </div>
                        )}
                    </li>
                ))}
                {rows.length === 0 && (
                    <li className="text-xs font-semibold text-slate-400 py-2">Inga vitfläckar — alla orter med event har en grupp inom 25 km.</li>
                )}
            </ul>
            {n < rows.length && (
                <button onClick={() => setN(v => v + 20)}
                    className="mt-3 inline-flex items-center px-3 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-100 transition-colors">
                    Visa fler ({rows.length - n} kvar)
                </button>
            )}
        </div>
    );
}
