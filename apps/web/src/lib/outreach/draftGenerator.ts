// lib/outreach/draftGenerator.ts
//
// Själva utkastskrivandet: kandidatlista ur eventPicker → Claude → V1/V2.
// Bruten ur /api/admin/outreach/draft när morgonkörningen (plan-routen)
// behövde exakt samma text-motor. ✨-knappen i konsolen och cronen SKA gå
// genom samma kod — annars glider formatreglerna isär mellan de två vägarna.
//
// Server-only (firebase-admin + eventPicker som läser fs). Postar aldrig
// någonting någonstans; returnerar text som en människa klistrar in (§0 i
// docs/outreach/admin-konsol-plan.md).

import Anthropic from '@anthropic-ai/sdk';
import type { Firestore } from 'firebase-admin/firestore';
import { pickEventsForContact, type PickedEvents } from './eventPicker';
import { resolveMentionedEvents, startOfStockholmDay, variantFor } from './planner';
import { bodyHash } from './hash';
import type { OutreachContact, OutreachLogEntry } from '@/types/outreach';

export const DRAFT_MODEL = 'claude-opus-5';

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

export interface DraftOutput {
    v1: string;
    v2Post: string;
    v2FirstComment: string;
    mentionedEvents: { title: string; day: string; place: string; emoji: string }[];
    angle: string;
}

export interface DraftGeneration {
    draft: DraftOutput;
    picked: PickedEvents;
    linkTarget: string;
    model: string;
    generatedAt: number;
}

/** Fel med färdig HTTP-status — routen slipper tolka om felorsaker. */
export class DraftError extends Error {
    constructor(message: string, readonly status: number) {
        super(message);
        this.name = 'DraftError';
    }
}

/** Stadssidan när gruppen har en, annars startsidan. Aldrig egna parametrar. */
export function linkTargetFor(c: OutreachContact): string {
    return c.hasCityPage && c.citySlug
        ? `https://vadkul.se/evenemang/${c.citySlug}`
        : 'https://vadkul.se';
}

/**
 * Skriv V1+V2 för en kontakt ur färskt eventdata.
 * Kastar DraftError vid saknad nyckel, saknad koordinat eller modellfel.
 */
export async function generateDraft(db: Firestore, contact: OutreachContact): Promise<DraftGeneration> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
        throw new DraftError(
            'ANTHROPIC_API_KEY saknas på servern — lägg den i apps/web/.env.local (dev) resp. apps/web/.env (deploy).',
            503,
        );
    }

    const picked = await pickEventsForContact(db, contact, contact.postingMode);
    if (!picked) {
        throw new DraftError(
            `${contact.name} saknar koordinater (lat/lng) och stadssida — fyll i koordinat på kontakten först, annars kan inga lokala event plockas.`,
            422,
        );
    }

    const linkTarget = linkTargetFor(contact);

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
    let msg;
    try {
        msg = await client.messages.create({
            model: DRAFT_MODEL,
            max_tokens: 10000,
            thinking: { type: 'adaptive' },
            output_config: { format: { type: 'json_schema', schema: DRAFT_SCHEMA } },
            system: SYSTEM_PROMPT,
            messages: [{ role: 'user', content: userMessage }],
        });
    } catch (e) {
        if (e instanceof Anthropic.APIError) throw new DraftError('Claude svarade inte — försök igen.', 502);
        throw e;
    }

    if (msg.stop_reason === 'refusal') {
        throw new DraftError('Modellen avböjde förfrågan — försök igen.', 502);
    }
    if (msg.stop_reason === 'max_tokens') {
        throw new DraftError('Svaret blev avhugget (max_tokens) — försök igen.', 502);
    }

    const text = msg.content.find(b => b.type === 'text')?.text ?? '';
    let draft: DraftOutput;
    try {
        draft = JSON.parse(text) as DraftOutput;
    } catch {
        console.error('[draftGenerator] oparsbart svar:', text.slice(0, 400));
        throw new DraftError('Kunde inte tolka modellens svar — försök igen.', 502);
    }

    return { draft, picked, linkTarget, model: DRAFT_MODEL, generatedAt: Date.now() };
}

/* ── Spara utkastet i delningskön ────────────────────────────────────────── */

/** Firestore vägrar undefined-värden — plocka bort dem, även i nästlade fält. */
function stripUndefined<T>(value: T): T {
    if (Array.isArray(value)) return value.map(stripUndefined) as unknown as T;
    if (value && typeof value === 'object') {
        const out: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
            if (v !== undefined) out[k] = stripUndefined(v);
        }
        return out as T;
    }
    return value;
}

/**
 * Skriv utkastet till outreachLog som en oanvänd rad (status 'utkast',
 * confirmedByOwner false). Både morgonkörningen och ✨-knappen går hit, så att
 * allt som går att posta hamnar i EN kö — det är den kön /ready läser.
 *
 * Rekommenderad variant väljs av gruppens läge; den andra sparas som
 * `alternate` ifall läget visar sig vara ett annat i verkligheten.
 */
export async function persistDraft(
    db: Firestore,
    contact: OutreachContact,
    generation: DraftGeneration,
    plannedBy: 'auto' | 'manuell',
): Promise<{ logId: string; variant: string; entry: OutreachLogEntry }> {
    const { draft, picked: supply, linkTarget, model, generatedAt } = generation;

    const { variant, linkPlacement } = variantFor(contact.postingMode);
    const isV2 = variant === 'V2';
    const text = isV2 ? draft.v2Post : draft.v1;

    const resolved = resolveMentionedEvents(draft.mentionedEvents, supply.candidates);
    // Sortera på tidpunkt, inte på sträng: ISO-formaten i aggregatet är inte
    // garanterat teckenvis jämförbara (offset vs Z, med/utan millisekunder).
    const earliest = resolved.events
        .map(e => e.timeISO)
        .filter(t => Number.isFinite(Date.parse(t)))
        .sort((a, b) => Date.parse(a) - Date.parse(b))[0];

    const ref = db.collection('outreachLog').doc();
    const entry: OutreachLogEntry = {
        id: ref.id,
        contactId: contact.id,
        contactName: contact.name,
        channel: 'fb-grupp',

        draftCreatedAt: generatedAt,
        confirmedByOwner: false,
        status: 'utkast',
        outcome: 'okänt',
        plannedFor: startOfStockholmDay(generatedAt),
        plannedBy,

        variant,
        bodyText: text,
        bodyHash: bodyHash(text),
        firstCommentText: isV2 ? draft.v2FirstComment : undefined,
        linkPlacement,
        linkUrl: linkTarget,
        starCode: 'STJARNA1',
        angle: draft.angle,
        alternate: isV2
            ? { bodyText: draft.v1, linkPlacement: 'i-inlägget' }
            : {
                bodyText: draft.v2Post,
                firstCommentText: draft.v2FirstComment,
                linkPlacement: 'i-första-kommentaren',
            },

        mentionedEvents: resolved.events,
        unmatchedTitles: resolved.unmatched,
        eventCountClaimed: resolved.events.length,
        eventsDataFetchedAt: generatedAt,
        earliestMentionedEventISO: earliest,
        supplyWeekCount: supply.weekCount,
        supplyNearCount: supply.nearCount,
        supplySource: supply.source,
        model,
    };

    await ref.set(stripUndefined(entry));
    return { logId: ref.id, variant, entry };
}
