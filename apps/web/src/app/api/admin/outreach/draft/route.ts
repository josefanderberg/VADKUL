// /api/admin/outreach/draft — utkastgeneratorn (planens etapp 2, POST-delen).
//
// POST { contactId } → plockar RIKTIGA event för kontakten (eventPicker, live
// ur aggregatedEvents) och låter Claude formulera V1 (länk i inlägget, för
// godkännandeköer) + V2 (länk i första kommentaren, för direktpublicering)
// enligt formatreglerna ur docs/outreach/facebook-grupper.md. Routen postar
// ALDRIG något — den skriver text som ägaren kopierar manuellt (§0 i planen).
//
// Varje lyckat utkast sparas i outreachDrafts/{contactId} och GET läser
// tillbaka de som är färskare än 48 h — så konsolens utkastlager (DraftStore)
// överlever flikbyten och omladdningar. Äldre än så är färskvara som ruttnat.
//
// ANTHROPIC_API_KEY är server-only (aldrig NEXT_PUBLIC): .env.local i dev,
// och i prod via apps/web/.env som följer med firebase deploy.

import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { getAdminDb, requireAdmin } from '@/lib/firestore-admin';
import { pickEventsForContact } from '@/lib/outreach/eventPicker';
import type { OutreachContact, OutreachLogEntry } from '@/types/outreach';

export const dynamic = 'force-dynamic';
// Opus + adaptivt tänkande kan ta en stund — låt inte SSR-funktionens
// standardtimeout kapa svaret.
export const maxDuration = 120;

const MODEL = 'claude-opus-5';
// Samma prisklass ($5/$25 per MTok) — används när Opus 5 är överbelastad (529).
const FALLBACK_MODEL = 'claude-opus-4-8';

/**
 * Opus 5-listpriser i USD per miljon tokens — för förbrukningskortet i
 * konsolen. Cache-läsning är 0,1× input, cache-skrivning 1,25× (5 min-TTL).
 * Uppskattning, inte faktura: facit finns i Anthropic-konsolens Usage.
 */
const PRICE_PER_MTOK = { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 };

/**
 * Räkna kostnaden och uppdatera outreachStats/apiUsage (fire-and-forget —
 * bokföringen får aldrig sinka eller fälla själva utkastet). keyCreatedAt
 * sätts vid FÖRSTA anropet och driver konsolens 30-dagars rotations-
 * påminnelse; "Ny nyckel inlagd"-knappen nollställer den.
 */
function trackApiUsage(db: Firestore, usage: Anthropic.Usage, model: string): number {
    const inTok = usage.input_tokens ?? 0;
    const outTok = usage.output_tokens ?? 0;
    const cacheRead = usage.cache_read_input_tokens ?? 0;
    const cacheWrite = usage.cache_creation_input_tokens ?? 0;
    const costUsd = (
        inTok * PRICE_PER_MTOK.input + outTok * PRICE_PER_MTOK.output +
        cacheRead * PRICE_PER_MTOK.cacheRead + cacheWrite * PRICE_PER_MTOK.cacheWrite
    ) / 1_000_000;

    const ref = db.collection('outreachStats').doc('apiUsage');
    ref.get().then(snap => ref.set({
        ...(snap.exists ? {} : { keyCreatedAt: Date.now() }),
        calls: FieldValue.increment(1),
        inputTokens: FieldValue.increment(inTok),
        outputTokens: FieldValue.increment(outTok),
        cacheReadTokens: FieldValue.increment(cacheRead),
        cacheWriteTokens: FieldValue.increment(cacheWrite),
        estimatedCostUsd: FieldValue.increment(costUsd),
        lastCallAt: Date.now(),
        lastModel: model,
    }, { merge: true })).catch(e => console.warn('[outreach/draft] usage-bokföringen misslyckades:', e));

    return costUsd;
}

// Alla fält required + additionalProperties:false — strikta scheman validerar
// bäst; "tomt" uttrycks som tom sträng/array, aldrig som utelämnat fält.
const DRAFT_SCHEMA = {
    type: 'object',
    additionalProperties: false,
    properties: {
        v1: {
            type: 'string',
            description: 'Komplett V1-inlägg: länken i själva inlägget (för grupper med godkännandekö).',
        },
        v2Post: {
            type: 'string',
            description: 'Komplett V2-inlägg: INGEN länk i texten, hänvisar till första kommentaren.',
        },
        v2FirstComment: {
            type: 'string',
            description: 'Första kommentaren till V2: länken + kort inbjudan att tipsa.',
        },
        mentionedEvents: {
            type: 'array',
            description: 'Exakt de event som nämns i utkasten, i radordning.',
            items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                    title: { type: 'string' },
                    day: { type: 'string', description: 'veckodag i gemener, t.ex. "lördag"' },
                    place: { type: 'string', description: 'platsnamn om det står på raden, annars tom sträng' },
                    emoji: { type: 'string', description: 'radens emoji, annars tom sträng' },
                },
                required: ['title', 'day', 'place', 'emoji'],
            },
        },
        angle: {
            type: 'string',
            description: 'En mening om vald vinkel (för loggen), t.ex. "ABBA-partyt som dragplåster, helgfokus".',
        },
    },
    required: ['v1', 'v2Post', 'v2FirstComment', 'mentionedEvents', 'angle'],
} as const;

// Formatreglerna är destillatet av tre veckors lärdomar i
// docs/outreach/facebook-grupper.md — ändra inte utan att läsa LÄRDOMARNA där.
const SYSTEM_PROMPT = `Du skriver Facebook-gruppinlägg för VADKUL (vadkul.se) — en gratis karta där allt som händer i Sverige samlas på ett ställe. Tonen är "granne som tipsar": varm, folklig, kort, aldrig reklamig. Alltid på svenska.

Du får en grupp och en kandidatlista med RIKTIGA event. Regler, i prioritetsordning:

1. Nämn ENDAST event ur kandidatlistan, med exakta titlar. Hitta ALDRIG på event, tider eller platser.
2. Välj 3–5 dragplåster: störst namn/roligast först, helgens event viktigast. Sprid över olika dagar och kategorier. Engångshändelser slår stående veckoaktiviteter — hoppa över "varje tisdag"-artade rader och rena föreningsträningar.
3. 8 KM-REGELN: kandidater med distanceKm > 8 ligger utanför huvudorten — då MÅSTE platsnamnet stå på raden ("i Gyttorp", "på Bjärehalvön"). Skriv aldrig så att ett grannortsevent ser ut att ligga i huvudorten.
4. Om nearCount < 5: använd tips-frågeformatet i stället — max 2–3 eventrader (med ärliga platsnamn), en ärlig rad om att kartan är tunn just här, och be gruppen om tips. Ett inlägg som låtsas att det händer massor när det inte gör det får (välförtjänt) kritik.
5. Varje eventrad: emoji (eventets egen om den finns, annars en passande) + titel + platsnamn vid behov + (veckodag) i gemener.
6. Syftesblocket ska alltid med, med varierad formulering: allt som händer samlas på EN karta, så man enkelt ser vad som är på gång var man än är.
7. Medlemsnyttan ska alltid med (variera lätt): ➕ lägga in egna event · 💡 tipsa om sånt som saknas · ✨ önska event · 🔔 notis när något man gillat drar igång. Kartan är gratis och kräver inget konto för att titta.
8. Avsluta med en öppen fråga till gruppen.
9. Skriv ALDRIG likadant som de tidigare inläggen du får se — variera hälsningsfras, ordföljd och slutfråga. Facebook demoterar kopierad text.
10. Inga hashtags, ingen URL-shortener, länken exakt som angiven — inga egna parametrar.
11. V1 = länken i inlägget (godkännandeköer har ingen kommentarsmöjlighet före godkännande). V2 = INGEN länk i inläggstexten; texten pekar på första kommentaren ("kartan ligger i första kommentaren 👇") och länken bor i v2FirstComment.

FORMATEXEMPEL för V1 (följ strukturen, inte ordvalen):

Härlig helg på gång i Ängelholm 👇

🎉 ABBA Party med The Visitors på Enkegården (lördag)
🎶 Sommarglitter i Hembygdsparken (lördag)
🎨 Vernissage "Immortal animals" på Galleri AM (fredag)
🎨 Finissage på Bjäre Konsthall, Bjärehalvön (söndag)

Hela grejen med vadkul.se: allt som händer samlas på EN karta, så du enkelt ser vad som är på gång var du än är — hela helgens utbud i trakten finns där:
https://vadkul.se

Och med ett gratis konto kan du:
➕ lägga in egna event   💡 tipsa om sånt som saknas
✨ önska event du vill se hända   🔔 få en notis när något du gillat drar igång

Vad hittar ni på i helgen? 👇`;

type DraftOutput = {
    v1: string;
    v2Post: string;
    v2FirstComment: string;
    mentionedEvents: { title: string; day: string; place: string; emoji: string }[];
    angle: string;
};

// Färskvaruregeln (23/7): utkast äldre än så här serveras inte tillbaka.
const DRAFT_TTL_MS = 48 * 3_600_000;

/** GET → alla sparade utkast färskare än 48 h, för DraftStorens uppstart. */
export async function GET(request: Request) {
    const denied = await requireAdmin(request);
    if (denied) return denied;
    const db = getAdminDb();
    if (!db) return NextResponse.json({ error: 'DB unavailable' }, { status: 503 });
    const snap = await db.collection('outreachDrafts')
        .where('generatedAt', '>=', Date.now() - DRAFT_TTL_MS)
        .get();
    return NextResponse.json(
        { drafts: snap.docs.map(d => d.data()) },
        { headers: { 'Cache-Control': 'private, no-store' } },
    );
}

/**
 * 529 Overloaded från Anthropic kan drabba en enskild modell eller
 * serveringsväg (structured output har egen kapacitet) medan andra svarar
 * direkt. Stegen provas i tur och ordning tills en går igenom; alla andra
 * fel än 529 kastas vidare direkt.
 */
async function generateDraftMessage(client: Anthropic, userMessage: string) {
    const jsonInstruktion = `${SYSTEM_PROMPT}\n\nSVARA ENBART med ett JSON-objekt — ingen inledande text, inga \`\`\`-staket — som exakt följer detta JSON-schema (alla fält obligatoriska, "tomt" = tom sträng/array):\n${JSON.stringify(DRAFT_SCHEMA)}`;
    const steg = [
        { model: MODEL, structured: true },
        { model: FALLBACK_MODEL, structured: true },
        { model: FALLBACK_MODEL, structured: false },
    ] as const;

    let sistaFel: unknown;
    for (const { model, structured } of steg) {
        try {
            const msg = await client.messages.create({
                model,
                max_tokens: 10000,
                thinking: { type: 'adaptive' },
                ...(structured ? { output_config: { format: { type: 'json_schema', schema: DRAFT_SCHEMA } } } : {}),
                system: structured ? SYSTEM_PROMPT : jsonInstruktion,
                messages: [{ role: 'user', content: userMessage }],
            });
            return { msg, structured, model };
        } catch (e) {
            if (!(e instanceof Anthropic.APIError) || e.status !== 529) throw e;
            sistaFel = e;
            console.warn(`[outreach/draft] 529 Overloaded på ${model}${structured ? ' (structured)' : ' (prompt-JSON)'} — provar nästa steg`);
        }
    }
    throw sistaFel;
}

export async function POST(request: Request) {
    const denied = await requireAdmin(request);
    if (denied) return denied;

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
        return NextResponse.json({
            error: 'ANTHROPIC_API_KEY saknas på servern — lägg den i apps/web/.env.local (dev) resp. apps/web/.env (deploy).',
        }, { status: 503 });
    }

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

        const picked = await pickEventsForContact(db, contact, contact.postingMode);
        if (!picked) {
            return NextResponse.json({
                error: `${contact.name} saknar koordinater (lat/lng) och stadssida — fyll i koordinat på kontakten först, annars kan inga lokala event plockas.`,
            }, { status: 422 });
        }

        const linkTarget = contact.hasCityPage && contact.citySlug
            ? `https://vadkul.se/evenemang/${contact.citySlug}`
            : 'https://vadkul.se';

        // De senaste inläggstexterna → "skriv inte likadant"-underlaget.
        const recentSnap = await db.collection('outreachLog')
            .orderBy('draftCreatedAt', 'desc').limit(15).get();
        const recentTexts = recentSnap.docs
            .map(d => (d.data() as OutreachLogEntry).bodyText)
            .filter((t): t is string => typeof t === 'string' && t.length > 0)
            .slice(0, 5)
            .map((t, i) => `--- tidigare inlägg ${i + 1} ---\n${t.slice(0, 700)}`);

        const candidatesCompact = picked.candidates.map(e => ({
            title: e.title,
            dag: `${e.weekday} ${e.date}`,
            tid: e.clockTime ?? null,
            plats: e.place,
            distanceKm: e.distanceKm,
            kategori: e.category ?? null,
            emoji: e.emoji ?? null,
        }));

        const userMessage = [
            `GRUPP: ${contact.name}${contact.city ? ` (${contact.city})` : ''}${typeof contact.memberCount === 'number' ? ` — ca ${contact.memberCount} medlemmar` : ''}`,
            `LÄGE: ${contact.postingMode} (${contact.postingMode === 'approval' ? 'godkännandekö — V1 är den som postas' : contact.postingMode === 'direct' ? 'publicerar direkt — V2 är den som postas' : 'okänt — båda kan behövas'})`,
            `LÄNKMÅL (exakt denna): ${linkTarget}`,
            contact.groupRulesNote ? `GRUPPENS REGLER: ${contact.groupRulesNote}` : null,
            '',
            `EVENTUNDERLAG (${picked.source === 'live' ? 'live ur kartdatat' : 'deploy-snapshot, kan vara äldre'}, uppdaterat ${picked.dataUpdatedAt || 'okänt'}; fönster ${picked.windowStartISO.slice(0, 10)}–${picked.windowEndISO.slice(0, 10)}):`,
            `- ${picked.weekCount} event inom ${picked.radiusKm} km denna vecka`,
            `- ${picked.nearCount} event inom 8 km från huvudorten${picked.nearCount < 5 ? ' ⚠ under 5 → tips-frågeformatet gäller' : ''}`,
            '',
            `KANDIDATER (närmast först):`,
            JSON.stringify(candidatesCompact, null, 1),
            '',
            recentTexts.length ? `TIDIGARE INLÄGG — skriv INTE likadant:\n${recentTexts.join('\n')}` : null,
        ].filter((x): x is string => x !== null).join('\n');

        const client = new Anthropic({ apiKey });
        const { msg, structured, model } = await generateDraftMessage(client, userMessage);

        if (msg.stop_reason === 'refusal') {
            return NextResponse.json({ error: 'Modellen avböjde förfrågan — försök igen.' }, { status: 502 });
        }
        if (msg.stop_reason === 'max_tokens') {
            return NextResponse.json({ error: 'Svaret blev avhugget (max_tokens) — försök igen.' }, { status: 502 });
        }

        let text = msg.content.find(b => b.type === 'text')?.text ?? '';
        // Fallback-vägen kan trots instruktionen sätta ```-staket runt JSON:en.
        if (!structured) text = text.trim().replace(/^```(?:json)?\s*/, '').replace(/\s*```\s*$/, '');
        let draft: DraftOutput;
        try { draft = JSON.parse(text) as DraftOutput; } catch {
            console.error('[outreach/draft] oparsbart svar:', text.slice(0, 400));
            return NextResponse.json({ error: 'Kunde inte tolka modellens svar — försök igen.' }, { status: 502 });
        }

        // Bokför förbrukningen + skicka med den i svaret, så både API-kortet
        // och den enskilda utkast-rutan visar vad genereringen faktiskt drog.
        const costUsd = trackApiUsage(db, msg.usage, model);

        const body = {
            drafts: { v1: draft.v1, v2Post: draft.v2Post, v2FirstComment: draft.v2FirstComment },
            mentionedEvents: draft.mentionedEvents,
            angle: draft.angle,
            meta: {
                contactId: contact.id,
                contactName: contact.name,
                postingMode: contact.postingMode,
                linkTarget,
                weekCount: picked.weekCount,
                nearCount: picked.nearCount,
                radiusKm: picked.radiusKm,
                dataUpdatedAt: picked.dataUpdatedAt,
                source: picked.source,
                model,
                generatedAt: Date.now(),
                usage: {
                    inputTokens: msg.usage.input_tokens ?? 0,
                    outputTokens: msg.usage.output_tokens ?? 0,
                    costUsd: Math.round(costUsd * 10_000) / 10_000,
                },
            },
        };

        // Spara utkastet (fire-and-forget — sparningen får aldrig fälla svaret):
        // ett doc per kontakt, senaste utkastet vinner. GET ovan läser tillbaka.
        db.collection('outreachDrafts').doc(contact.id).set({
            contactId: contact.id,
            contactName: contact.name,
            payload: body,
            generatedAt: body.meta.generatedAt,
        }).catch(e => console.warn('[outreach/draft] kunde inte spara utkastet:', e));

        return NextResponse.json(body, { headers: { 'Cache-Control': 'private, no-store' } });
    } catch (e) {
        console.error('[outreach/draft]', e);
        if (e instanceof Anthropic.APIError) {
            const s = e.status;
            const error =
                s === 529 ? 'Anthropic är överbelastat just nu (529) — vänta en liten stund och försök igen.'
                : s === 429 ? 'Rate limit hos Anthropic (429) — vänta en stund och försök igen.'
                : s === 401 ? 'API-nyckeln avvisades av Anthropic (401) — kontrollera ANTHROPIC_API_KEY.'
                : `Anthropic-fel (${s ?? 'nätverk'}) — försök igen.`;
            return NextResponse.json({ error }, { status: 502 });
        }
        return NextResponse.json({ error: 'Utkastet kunde inte genereras — försök igen.' }, { status: 500 });
    }
}
