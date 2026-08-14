// lib/outreach/eventPicker.ts
//
// Utkastgeneratorns eventunderlag. Till skillnad från eventSupply (ranking,
// deploy-snapshot räcker) läser den här LIVE ur aggregatedEvents med Admin SDK
// — i ett utkast är färskheten avgörande (24/7-regeln: ett inlägg får aldrig
// nämna event som redan varit). Snapshoten i public/ är bara reservväg när
// Firestore inte svarar.
//
// Server-only (fs + firebase-admin) — importeras enbart av
// /api/admin/outreach/draft.

import { readFile } from 'fs/promises';
import path from 'path';
import type { Firestore } from 'firebase-admin/firestore';
import type { OutreachContact, PostingMode } from '@/types/outreach';
import { coordForContact } from './eventSupply';

type RawEvent = {
    id: string;
    title: string;
    time: string;
    hasSpecificTime?: boolean;
    lat: number;
    lng: number;
    locationName?: string;
    category?: string;
    emoji?: string;
};

export interface CandidateEvent {
    id: string;               // aggregatets event-id — spåret tillbaka från en postad rad
    title: string;
    timeISO: string;
    weekday: string;          // 'fredag' — Europe/Stockholm, alltid
    date: string;             // '8 aug'
    clockTime?: string;       // '19:00' — bara när tiden är specifik
    place: string;
    distanceKm: number;       // från kontaktens koordinat (8 km-regeln!)
    category?: string;
    emoji?: string;
}

export interface PickedEvents {
    candidates: CandidateEvent[];   // närmast först, max 60
    weekCount: number;              // inom radien under hela fönstret
    nearCount: number;              // inom 8 km — LÄRDOM 3/8: radien ljuger
    radiusKm: number;
    windowStartISO: string;
    windowEndISO: string;
    dataUpdatedAt: string;          // aggregatets updatedAt (färskvarukvitto)
    source: 'live' | 'snapshot';
}

/* ── Datakällan ──────────────────────────────────────────────────────────── */

// Memo per updatedAt: shard-sammanslagningen (~22k event) görs en gång per
// dygnsaggregat och varm instans, inte per genererat utkast.
let memo: { updatedAt: string; events: RawEvent[] } | null = null;

async function loadLive(db: Firestore): Promise<{ updatedAt: string; events: RawEvent[] }> {
    const indexSnap = await db.collection('aggregatedEvents').doc('destinations').get();
    if (!indexSnap.exists) throw new Error('destinations-lagret saknas');
    const indexData = indexSnap.data() as { updatedAt?: string; shardCount?: number; events?: RawEvent[] };
    const updatedAt = typeof indexData?.updatedAt === 'string' ? indexData.updatedAt : '';
    if (memo && updatedAt && memo.updatedAt === updatedAt) return memo;

    // Samma index-doc + shards-mönster som /api/events/[layer].
    let events: RawEvent[] = [];
    const shardCount = typeof indexData?.shardCount === 'number' ? indexData.shardCount : 0;
    if (shardCount > 0) {
        const refs = Array.from({ length: shardCount }, (_, i) =>
            db.collection('aggregatedEvents').doc(`destinations_${i}`));
        const snaps = await db.getAll(...refs);
        for (const s of snaps) if (s.exists) events.push(...(((s.data() as { events?: RawEvent[] })?.events) || []));
    } else {
        events = Array.isArray(indexData?.events) ? indexData.events : [];
    }
    if (events.length === 0) throw new Error('destinations-lagret är tomt');
    memo = { updatedAt, events };
    return memo;
}

async function loadSnapshot(): Promise<{ updatedAt: string; events: RawEvent[] }> {
    const raw = await readFile(path.join(process.cwd(), 'public', 'events-destinations.json'), 'utf8');
    const parsed = JSON.parse(raw) as { updatedAt?: string; events?: RawEvent[] };
    return { updatedAt: parsed.updatedAt ?? '', events: parsed.events ?? [] };
}

/* ── Urvalet ─────────────────────────────────────────────────────────────── */

function distKm(lat1: number, lng1: number, lat2: number, lng2: number) {
    const R = 6371;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
}

/** Nästa midnatt i Europe/Stockholm efter `ms` (servern kör UTC i prod). */
function nextStockholmMidnight(ms: number): number {
    // Gå framåt timme för timme tills Stockholm-dygnet växlar, backa sedan till
    // hela timmen där bytet skedde. Grovt men tidszonssäkert utan bibliotek.
    const dayOf = (t: number) => new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'Europe/Stockholm', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date(t));
    const today = dayOf(ms);
    let t = ms - (ms % 3_600_000);
    while (dayOf(t) === today) t += 3_600_000;
    return t;
}

const NEAR_KM = 8;               // 8 km-regeln (Nykvarn-läxan, LÄRDOM 3/8)
const MAX_CANDIDATES = 60;
// Biovakt: kategori 'bio' finns inte i aggregatet, men titelmönstren gör det.
const BIO_RE = /filmstaden|sf bio|\((sv|eng)\.? ?tal\)/i;

/**
 * Kandidatlistan för ett utkast: kommande event inom kontaktens radie under
 * de närmaste 7 dygnen. Approval-/unknown-grupper får fönstret flyttat till
 * NÄSTA dygn — ett kölagt inlägg får aldrig nämna event som hunnit passera.
 */
export async function pickEventsForContact(
    db: Firestore | null,
    c: OutreachContact,
    mode: PostingMode,
): Promise<PickedEvents | null> {
    const coord = coordForContact(c);
    if (!coord) return null;

    let data: { updatedAt: string; events: RawEvent[] };
    let source: PickedEvents['source'] = 'live';
    try {
        if (!db) throw new Error('ingen db');
        data = await loadLive(db);
    } catch {
        data = await loadSnapshot();
        source = 'snapshot';
    }

    const now = Date.now();
    const start = mode === 'direct' ? now : nextStockholmMidnight(now);
    const end = start + 7 * 86_400_000;

    const fmtWeekday = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Stockholm', weekday: 'long' });
    const fmtDate = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Stockholm', day: 'numeric', month: 'short' });
    const fmtClock = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Stockholm', hour: '2-digit', minute: '2-digit' });

    const within: CandidateEvent[] = [];
    for (const e of data.events) {
        const t = Date.parse(e.time);
        if (!Number.isFinite(t) || t < start || t > end) continue;
        if (!e.lat && !e.lng) continue;                       // ogeokodat → kan inte avståndsbedömas
        if (BIO_RE.test(e.title) || BIO_RE.test(e.locationName ?? '')) continue;
        const d = distKm(coord.lat, coord.lng, e.lat, e.lng);
        if (d > coord.radiusKm) continue;
        within.push({
            id: e.id,
            title: e.title.trim(),
            timeISO: e.time,
            weekday: fmtWeekday.format(new Date(t)),
            date: fmtDate.format(new Date(t)),
            clockTime: e.hasSpecificTime ? fmtClock.format(new Date(t)) : undefined,
            place: (e.locationName ?? '').trim(),
            distanceKm: Math.round(d * 10) / 10,
            category: e.category,
            emoji: e.emoji || undefined,
        });
    }

    within.sort((a, b) => a.distanceKm - b.distanceKm || Date.parse(a.timeISO) - Date.parse(b.timeISO));

    // Dubblettitlar (samma event ur flera källor / stående aktiviteter som
    // repeteras) — behåll närmaste förekomsten.
    const seen = new Set<string>();
    const unique = within.filter(e => {
        const key = e.title.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });

    // Kandidattaket får inte äta upp helgens dragplåster: närmaste 40 först,
    // sedan fylls resterande platser med HELG-event (fre–sön) längre ut i
    // radien — det är dem inläggen byggs kring.
    const isWeekend = (e: CandidateEvent) => ['fredag', 'lördag', 'söndag'].includes(e.weekday);
    const candidates = unique.slice(0, 40);
    if (unique.length > 40) {
        for (const e of unique.slice(40)) {
            if (candidates.length >= MAX_CANDIDATES) break;
            if (isWeekend(e)) candidates.push(e);
        }
    }

    return {
        candidates,
        weekCount: unique.length,
        nearCount: unique.filter(e => e.distanceKm <= NEAR_KM).length,
        radiusKm: coord.radiusKm,
        windowStartISO: new Date(start).toISOString(),
        windowEndISO: new Date(end).toISOString(),
        dataUpdatedAt: data.updatedAt,
        source,
    };
}
