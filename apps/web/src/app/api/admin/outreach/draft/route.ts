// /api/admin/outreach/draft — utkastgeneratorn för EN grupp (✨-knappen).
//
// POST { contactId } → plockar RIKTIGA event för kontakten (eventPicker, live
// ur aggregatedEvents), låter Claude formulera V1 (länk i inlägget, för
// godkännandeköer) + V2 (länk i första kommentaren, för direktpublicering),
// och SPARAR utkastet i delningskön. Routen postar ALDRIG något — den skriver
// text som ägaren kopierar manuellt (§0 i docs/outreach/admin-konsol-plan.md).
//
// Själva motorn bor i lib/outreach/draftGenerator.ts och delas med
// morgonkörningen (/api/admin/outreach/plan). Skillnaden mellan vägarna är
// bara plannedBy: 'manuell' här, 'auto' där.
//
// ANTHROPIC_API_KEY är server-only (aldrig NEXT_PUBLIC): .env.local i dev,
// och i prod via apps/web/.env som följer med firebase deploy.

import { NextResponse } from 'next/server';
import { getAdminDb, requireAdmin } from '@/lib/firestore-admin';
import { DraftError, generateDraft, persistDraft } from '@/lib/outreach/draftGenerator';
import type { OutreachContact } from '@/types/outreach';

export const dynamic = 'force-dynamic';
// Opus + adaptivt tänkande kan ta en stund — låt inte SSR-funktionens
// standardtimeout kapa svaret.
export const maxDuration = 120;

export async function POST(request: Request) {
    const denied = await requireAdmin(request);
    if (denied) return denied;

    const db = getAdminDb();
    if (!db) return NextResponse.json({ error: 'DB unavailable' }, { status: 503 });

    let body: { contactId?: unknown };
    try { body = await request.json(); } catch {
        return NextResponse.json({ error: 'Ogiltig JSON' }, { status: 400 });
    }
    const contactId = typeof body.contactId === 'string' ? body.contactId : '';
    if (!contactId) return NextResponse.json({ error: 'contactId saknas' }, { status: 400 });

    try {
        const snap = await db.collection('outreachContacts').doc(contactId).get();
        if (!snap.exists) return NextResponse.json({ error: 'Kontakten finns inte' }, { status: 404 });
        const contact = { ...(snap.data() as OutreachContact), id: snap.id };

        const generation = await generateDraft(db, contact);
        const saved = await persistDraft(db, contact, generation, 'manuell');

        const { draft, picked, linkTarget, model } = generation;
        return NextResponse.json({
            logId: saved.logId,
            drafts: { v1: draft.v1, v2Post: draft.v2Post, v2FirstComment: draft.v2FirstComment },
            mentionedEvents: draft.mentionedEvents,
            unmatchedTitles: saved.entry.unmatchedTitles ?? [],
            angle: draft.angle,
            meta: {
                contactId: contact.id,
                contactName: contact.name,
                postingMode: contact.postingMode,
                variant: saved.variant,
                linkTarget,
                weekCount: picked.weekCount,
                nearCount: picked.nearCount,
                radiusKm: picked.radiusKm,
                dataUpdatedAt: picked.dataUpdatedAt,
                source: picked.source,
                model,
                generatedAt: generation.generatedAt,
            },
        }, { headers: { 'Cache-Control': 'private, no-store' } });
    } catch (e) {
        if (e instanceof DraftError) {
            return NextResponse.json({ error: e.message }, { status: e.status });
        }
        console.error('[outreach/draft]', e);
        return NextResponse.json({ error: 'Utkastet kunde inte genereras — försök igen.' }, { status: 500 });
    }
}
