// /api/admin/outreach/page-post — publicerar på VADKUL:s EGEN Facebook-sida
// via Pages API (planens etapp 5). Egen sida är den enda ytan Meta tillåter
// API-publicering på — grupp-API:t dog april 2024, så gruppflödet förblir
// kopiera-klistra. Tänkt kedja: publicera på sidan här → dela sidinlägget
// manuellt till grupperna ("delat sidinlägg" i A/B-loggen).
//
// KRÄVER två env-variabler (server-only, .env.local i dev + .env för deploy):
//   FB_PAGE_ID           — sidans numeriska id
//   FB_PAGE_ACCESS_TOKEN — sid-token med pages_manage_posts (app i dev-läge
//                          räcker för egen sida där man själv är app-admin)
//
// POST { message } → { postId, url }. Routen postar ENBART på egen sida.

import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/firestore-admin';

export const dynamic = 'force-dynamic';

const GRAPH = 'https://graph.facebook.com/v21.0';

export async function POST(request: Request) {
    const denied = await requireAdmin(request);
    if (denied) return denied;

    const pageId = process.env.FB_PAGE_ID;
    const token = process.env.FB_PAGE_ACCESS_TOKEN;
    if (!pageId || !token) {
        return NextResponse.json({
            error: 'Sidpublicering är inte påkopplad än — lägg FB_PAGE_ID och FB_PAGE_ACCESS_TOKEN i apps/web/.env.local (dev) resp. .env (deploy).',
        }, { status: 503 });
    }

    let body: { message?: unknown };
    try { body = await request.json(); } catch {
        return NextResponse.json({ error: 'Ogiltig JSON' }, { status: 400 });
    }
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    if (!message) return NextResponse.json({ error: 'message saknas' }, { status: 400 });

    try {
        const res = await fetch(`${GRAPH}/${pageId}/feed`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message, access_token: token }),
        });
        const json = await res.json().catch(() => null) as { id?: string; error?: { message?: string; code?: number } } | null;
        if (!res.ok || !json?.id) {
            console.error('[outreach/page-post] Graph-fel:', json?.error ?? res.status);
            return NextResponse.json({
                error: `Meta avvisade inlägget: ${json?.error?.message ?? `HTTP ${res.status}`}`,
            }, { status: 502 });
        }
        // id har formen "<pageId>_<postId>" — facebook.com/<id> leder rätt.
        return NextResponse.json({ postId: json.id, url: `https://www.facebook.com/${json.id}` });
    } catch (e) {
        console.error('[outreach/page-post]', e);
        return NextResponse.json({ error: 'Nätverksfel mot Meta — försök igen.' }, { status: 502 });
    }
}
