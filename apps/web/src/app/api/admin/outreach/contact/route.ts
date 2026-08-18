// /api/admin/outreach/contact — PATCH vitlistade fält på en kontakt,
// POST för att skapa en NY fb-grupp (vitfläcksflödet: hitta grupp på kartan →
// spara länken → gruppen dyker upp i Kön/Städer/Planering som orörd).
//
// PATCH-body: { contactId, set: { ... } }. Bara fälten i VALIDATORS släpps
// igenom — mejluppföljningens knappar (replyStatus/followUpDueAt), avskrivning
// och admin-DM-anteckningar. Allt annat (identitet, historik, ranking-cache)
// ägs av import-skriptet och kö-/logg-routerna och ska inte kunna skrivas
// härifrån.

import { NextResponse } from 'next/server';
import { getAdminDb, requireAdmin } from '@/lib/firestore-admin';
import { CITIES } from '@/app/(v1)/evenemang/cityData';

export const dynamic = 'force-dynamic';

const VALIDATORS: Record<string, (v: unknown) => boolean> = {
    replyStatus: v => ['inget svar', 'svar', 'nej'].includes(v as string),
    followUpDueAt: v => typeof v === 'number' && Number.isFinite(v),
    doNotPost: v => typeof v === 'boolean',
    status: v => ['orörd', 'utkast', 'postad', 'väntar-godkännande', 'borttagen', 'avskriven'].includes(v as string),
    notes: v => typeof v === 'string',
    adminDmStatus: v => ['ej kontaktad', 'DM skickad', 'ja', 'nej', 'inget svar'].includes(v as string),
    adminDmSentAt: v => typeof v === 'number' && Number.isFinite(v),
    adminDmNote: v => typeof v === 'string',

    // Kartan skriver dessa. Koordinaten sätts när ägaren rättar en gissad nål;
    // sekretess/Pages-tillåtelse när hen ändå är inne i gruppen.
    lat: v => typeof v === 'number' && v >= 55 && v <= 69.3,
    lng: v => typeof v === 'number' && v >= 10.5 && v <= 24.6,
    geoSource: v => ['manuell', 'stadssida', 'gissad-ur-namnet'].includes(v as string),
    groupPrivacy: v => ['öppen', 'stängd', 'okänd'].includes(v as string),
    pagesAllowed: v => typeof v === 'boolean',
};

/** Samma id-konvention som import-outreach-md.ts — likalydande namn ⇒ samma id. */
const slugify = (s: string) =>
    s.toLowerCase()
        .replace(/å|ä/g, 'a').replace(/ö/g, 'o').replace(/é/g, 'e')
        .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
        .slice(0, 80);

/** facebook.com/groups/… på kanonisk form — annars null (fel länk inklistrad). */
const normalizeGroupUrl = (raw: string): string | null => {
    try {
        const u = new URL(raw.trim());
        if (!/^(www\.|m\.|web\.)?facebook\.com$/.test(u.hostname)) return null;
        if (!u.pathname.startsWith('/groups/')) return null;
        return `https://www.facebook.com${u.pathname.replace(/\/+$/, '')}`;
    } catch { return null; }
};

// POST { name, groupUrl, city?, lat?, lng?, memberCount?, groupRulesNote? }
// → ny fb-grupp-kontakt, status 'orörd'. citySlug/hasCityPage härleds ur
// CITIES (stadssidorna) så länkmålet blir rätt av sig självt. 409 vid
// dubblett (samma namn-slug eller samma grupp-URL) — hellre ett tydligt nej
// än en tyst överskrivning av historiken.
export async function POST(request: Request) {
    const denied = await requireAdmin(request);
    if (denied) return denied;

    const db = getAdminDb();
    if (!db) return NextResponse.json({ error: 'DB unavailable' }, { status: 503 });

    let body: Record<string, unknown>;
    try { body = await request.json(); } catch {
        return NextResponse.json({ error: 'Ogiltig JSON' }, { status: 400 });
    }

    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (name.length < 3 || name.length > 120) {
        return NextResponse.json({ error: 'Ange gruppens ORDAGRANNA namn (3–120 tecken).' }, { status: 400 });
    }
    const groupUrl = typeof body.groupUrl === 'string' ? normalizeGroupUrl(body.groupUrl) : null;
    if (!groupUrl) {
        return NextResponse.json({ error: 'Länken måste vara en facebook.com/groups/…-adress.' }, { status: 400 });
    }
    const city = typeof body.city === 'string' && body.city.trim() ? body.city.trim().slice(0, 60) : undefined;
    const lat = typeof body.lat === 'number' && body.lat >= 55 && body.lat <= 69.3 ? body.lat : undefined;
    const lng = typeof body.lng === 'number' && body.lng >= 10.5 && body.lng <= 24.6 ? body.lng : undefined;
    const memberCount = typeof body.memberCount === 'number' && body.memberCount >= 0 && body.memberCount <= 10_000_000
        ? Math.round(body.memberCount) : undefined;
    const groupRulesNote = typeof body.groupRulesNote === 'string' && body.groupRulesNote.trim()
        ? body.groupRulesNote.trim().slice(0, 500) : undefined;

    const id = slugify(name);
    if (!id) return NextResponse.json({ error: 'Namnet gav inget giltigt id.' }, { status: 400 });

    // Stadssida? Matcha ortnamnet mot CITIES både som namn och som slug.
    const citySlug = city
        ? (CITIES.find(c => c.name.toLowerCase() === city.toLowerCase() || c.slug === slugify(city))?.slug ?? null)
        : null;

    try {
        const ref = db.collection('outreachContacts').doc(id);
        const [existing, sameUrl] = await Promise.all([
            ref.get(),
            db.collection('outreachContacts').where('groupUrl', '==', groupUrl).limit(1).get(),
        ]);
        if (existing.exists) {
            return NextResponse.json({ error: `Finns redan: "${existing.get('name')}" (id ${id}).` }, { status: 409 });
        }
        if (!sameUrl.empty) {
            return NextResponse.json({ error: `Länken är redan sparad på "${sameUrl.docs[0].get('name')}".` }, { status: 409 });
        }

        const now = Date.now();
        await ref.set({
            id, kind: 'fb-grupp',
            name,
            groupUrl,
            ...(city ? { city } : {}),
            citySlug,
            hasCityPage: !!citySlug,
            // Vitfläcksflödet skickar ortens koordinat med — då kan utbudet
            // räknas direkt och gruppen rankas i kön utan geokodningsrundan.
            ...(lat !== undefined && lng !== undefined ? { lat, lng, geoSource: 'manuell' as const } : {}),
            ...(memberCount !== undefined ? { memberCount } : {}),
            ...(groupRulesNote ? { groupRulesNote } : {}),
            postingMode: 'unknown',
            doNotPost: false,
            postCount: 0,
            usedVariants: [],
            status: 'orörd',
            createdAt: now, updatedAt: now,
        });
        return NextResponse.json({ ok: true, id });
    } catch (e) {
        console.error('[outreach/contact POST]', e);
        return NextResponse.json({ error: 'Kunde inte spara gruppen' }, { status: 500 });
    }
}

export async function PATCH(request: Request) {
    const denied = await requireAdmin(request);
    if (denied) return denied;

    const db = getAdminDb();
    if (!db) return NextResponse.json({ error: 'DB unavailable' }, { status: 503 });

    let body: { contactId?: unknown; set?: unknown };
    try { body = await request.json(); } catch {
        return NextResponse.json({ error: 'Ogiltig JSON' }, { status: 400 });
    }

    const contactId = typeof body.contactId === 'string' ? body.contactId : '';
    const set = body.set && typeof body.set === 'object' ? body.set as Record<string, unknown> : null;
    if (!contactId || !set) return NextResponse.json({ error: 'contactId/set saknas' }, { status: 400 });

    const update: Record<string, unknown> = {};
    for (const [field, value] of Object.entries(set)) {
        if (!VALIDATORS[field]) {
            return NextResponse.json({ error: `Fältet '${field}' får inte skrivas härifrån` }, { status: 400 });
        }
        if (!VALIDATORS[field](value)) {
            return NextResponse.json({ error: `Ogiltigt värde för '${field}'` }, { status: 400 });
        }
        update[field] = value;
    }
    if (Object.keys(update).length === 0) {
        return NextResponse.json({ error: 'Inget att spara' }, { status: 400 });
    }
    update.updatedAt = Date.now();

    try {
        const ref = db.collection('outreachContacts').doc(contactId);
        if (!(await ref.get()).exists) {
            return NextResponse.json({ error: 'Kontakten finns inte' }, { status: 404 });
        }
        await ref.set(update, { merge: true });
        return NextResponse.json({ ok: true });
    } catch (e) {
        console.error('[outreach/contact]', e);
        return NextResponse.json({ error: 'Sparning misslyckades' }, { status: 500 });
    }
}
