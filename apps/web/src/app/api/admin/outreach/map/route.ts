// /api/admin/outreach/map — grupperna som GeoJSON + vitfläckarna.
//
// Två frågor kartan besvarar:
//   1. VAR har vi grupper, och i vilket skick är de? (features)
//   2. VAR händer det saker men vi saknar grupp? (vitflackar)
//
// Fråga 2 är den som ersätter "flera facebookkonton": i stället för att fejka
// täckning visar den vilka RIKTIGA grupper som är värda att gå med i, rankat
// på hur mycket som faktiskt händer på orten.

import { NextResponse } from 'next/server';
import { getAdminDb, requireAdmin } from '@/lib/firestore-admin';
import { getAllContacts } from '@/lib/outreach/repo';
import { coordForContact } from '@/lib/outreach/eventSupply';
import { CITY_POINTS } from '@/utils/cityPoints';
import { readFile } from 'fs/promises';
import path from 'path';
import type { OutreachContact } from '@/types/outreach';

export const dynamic = 'force-dynamic';

const DAY_MS = 86_400_000;
/** Hur nära en grupp måste ligga för att orten ska räknas som täckt. */
const COVERED_KM = 25;
/** Radien vi räknar eventutbud inom för en ort i vitfläckslistan. */
const SUPPLY_KM = 25;

type Dest = { time: string; lat?: number; lng?: number };

function distKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
}

/** Samma deploy-snapshot som eventSupply/stadssidorna läser. */
async function loadDests(): Promise<Dest[]> {
    try {
        const raw = await readFile(path.join(process.cwd(), 'public', 'events-destinations.json'), 'utf8');
        return (JSON.parse(raw) as { events: Dest[] }).events ?? [];
    } catch {
        return [];   // saknad fil ⇒ tom heatmap, aldrig krasch
    }
}

function adPlatsUrl(lat: number, lng: number, namn: string, radiusKm: number, stil: 'annons' | 'karta') {
    const p = new URLSearchParams({
        lat: lat.toFixed(4), lng: lng.toFixed(4), namn, radie: String(radiusKm), stil,
    });
    return `/api/marketing/ad-plats?${p.toString()}`;
}

/** Kartans statusfärg. Karens vinner över 'postad' — det är den som styr
 *  om du får posta idag, och det är frågan man ställer till kartan. */
function mapStatus(c: OutreachContact, now: number): string {
    if (c.doNotPost) return 'avskriven';
    if (c.status === 'borttagen' || c.lastOutcome === 'borttagen') return 'borttagen';
    if (c.lastOutcome === 'nekad') return 'nekad';
    if (c.status === 'väntar-godkännande') return 'väntar-godkännande';
    if (c.nextAllowedAt && c.nextAllowedAt > now) return 'karens';
    if (c.status === 'postad') return 'postad';
    if (c.status === 'utkast') return 'utkast';
    return 'orörd';
}

export async function GET(request: Request) {
    const denied = await requireAdmin(request);
    if (denied) return denied;

    const db = getAdminDb();
    if (!db) return NextResponse.json({ error: 'DB unavailable' }, { status: 503 });

    try {
        const [contacts, dests] = await Promise.all([getAllContacts(db), loadDests()]);
        const now = Date.now();
        const horizon = now + 7 * DAY_MS;

        // Kommande veckans event, en gång — används både till heatmapen och
        // till utbudsräkningen nedan.
        const upcoming = dests.filter(d => {
            const t = Date.parse(d.time);
            return !isNaN(t) && t >= now && t < horizon
                && typeof d.lat === 'number' && typeof d.lng === 'number';
        }) as { lat: number; lng: number }[];

        const groups = contacts.filter(c => c.kind === 'fb-grupp');
        const placed: { c: OutreachContact; lat: number; lng: number; radiusKm: number }[] = [];
        const utanKoordinat: { id: string; name: string }[] = [];

        for (const c of groups) {
            const coord = coordForContact(c);
            if (!coord) { utanKoordinat.push({ id: c.id, name: c.name }); continue; }
            placed.push({ c, ...coord });
        }

        const features = placed.map(({ c, lat, lng, radiusKm }) => ({
            type: 'Feature' as const,
            geometry: { type: 'Point' as const, coordinates: [lng, lat] },
            properties: {
                id: c.id,
                name: c.name,
                city: c.city ?? null,
                citySlug: c.citySlug ?? null,
                status: mapStatus(c, now),
                memberCount: c.memberCount ?? null,
                nextAllowedAt: c.nextAllowedAt ?? null,
                lastPostedAt: c.lastPostedAt ?? null,
                postCount: c.postCount ?? 0,
                groupUrl: c.groupUrl ?? null,
                groupPrivacy: c.groupPrivacy ?? 'okänd',
                pagesAllowed: c.pagesAllowed ?? null,
                geoSource: c.geoSource ?? 'stadssida',
                radiusKm,
                eventSupply: upcoming.filter(e => distKm(lat, lng, e.lat, e.lng) <= radiusKm).length,
                // Två bilder för två ytor: den brandade till Sidan/annonser,
                // den rena kartan till grupperna (se ad-plats-routens header).
                adImageUrl: adPlatsUrl(lat, lng, c.city ?? c.name, radiusKm, 'annons'),
                mapImageUrl: adPlatsUrl(lat, lng, c.city ?? c.name, radiusKm, 'karta'),
            },
        }));

        /* ── Vitfläckarna: orter med event men utan grupp ──────────────────── */
        const vitflackar = CITY_POINTS
            .map(city => ({
                name: city.name,
                lat: city.lat,
                lng: city.lng,
                eventSupply: upcoming.filter(e => distKm(city.lat, city.lng, e.lat, e.lng) <= SUPPLY_KM).length,
                närmasteGrupp: placed.reduce<number | null>((min, p) => {
                    const d = distKm(city.lat, city.lng, p.lat, p.lng);
                    return min === null || d < min ? d : min;
                }, null),
            }))
            .filter(c => c.eventSupply > 0 && (c.närmasteGrupp === null || c.närmasteGrupp > COVERED_KM))
            .sort((a, b) => b.eventSupply - a.eventSupply)
            .slice(0, 60)
            .map(c => ({
                ...c,
                närmasteGrupp: c.närmasteGrupp === null ? null : Math.round(c.närmasteGrupp),
                // Färdig söksträng att klistra in i Facebooks sökruta.
                sokord: `Vad händer i ${c.name}`,
            }));

        return NextResponse.json({
            generatedAt: now,
            geojson: { type: 'FeatureCollection' as const, features },
            // Heatmapen dedupe:as per ~1 km-cell. Hundra spelningar på samma
            // scen ska inte lysa som en storstad, och nyttolasten går från
            // tusentals punkter till några hundra.
            heatmap: {
                type: 'FeatureCollection' as const,
                features: [...upcoming.reduce((cells, e) => {
                    const k = `${Math.round(e.lat / 0.01)}:${Math.round(e.lng / 0.01)}`;
                    cells.set(k, (cells.get(k) ?? 0) + 1);
                    return cells;
                }, new Map<string, number>())].map(([k, vikt]) => {
                    const [la, ln] = k.split(':').map(Number);
                    return {
                        type: 'Feature' as const,
                        geometry: { type: 'Point' as const, coordinates: [ln * 0.01, la * 0.01] },
                        properties: { vikt },
                    };
                }),
            },
            vitflackar,
            utanKoordinat,
            counts: {
                grupper: groups.length,
                placerade: placed.length,
                utanKoordinat: utanKoordinat.length,
                eventDennaVecka: upcoming.length,
            },
        });
    } catch (e) {
        console.error('[outreach/map]', e);
        return NextResponse.json({ error: 'Kunde inte bygga kartan' }, { status: 500 });
    }
}
