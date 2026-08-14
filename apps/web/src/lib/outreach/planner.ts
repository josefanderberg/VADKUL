// lib/outreach/planner.ts
//
// Delningskön: vilka grupper får ett färdigskrivet utkast idag, och när är ett
// utkast för gammalt för att postas som det är.
//
// Varför utkasten skrivs SAMMA DAG och inte veckor i förväg — LÄRDOM 30/7 i
// docs/outreach/facebook-grupper.md: tre utkast skrivna 28/7 postades 30/7,
// Västmanlandsinlägget gick upp med två av fem rader redan passerade och
// Mölndalsinlägget avvisades. Ett stadsinlägg med konkreta event är färskvara.
// Därför: cronen skriver en liten sats varje morgon, och allt som hunnit bli
// inaktuellt märks som PASSERAT i stället för att tyst ligga kvar i kön.
//
// Ren logik — ingen fs, ingen Firestore. Testbar och delad av plan/ready.

import type {
    LinkPlacement, OutreachContact, OutreachLogEntry, PostingMode, QueueItem, ReadyPost,
} from '@/types/outreach';
import type { CandidateEvent } from './eventPicker';
import { stockholmDayKey } from './visits';
import { trigramSimilarity } from './hash';

/** Utkast äldre än så här räknas som färskvara som gått ut, oavsett om
 *  eventraderna råkar ligga kvar i framtiden: kartdatat har hunnit ändras. */
export const MAX_DRAFT_AGE_HOURS = 36;

/** Under så här många event i veckan blir inlägget en ren tipsfråga. Den
 *  varianten kan vara helt rätt (Malå-formatet) men är ett ägarbeslut —
 *  cronen tar inte en dagsplats för den. Generera manuellt i stället. */
export const MIN_SUPPLY_FOR_AUTO = 3;

/** Mjuka grindar som ändå diskvalificerar i den AUTOMATISKA planeringen: när
 *  ingen människa tittar ska tveksamma fall hoppas över, inte varnas om. */
const SOFT_GATES_THAT_BLOCK_AUTO = ['stadskrock', 'nymedlem', 'strikevarning'];

const HOUR_MS = 3_600_000;

/** Epoch-ms för midnatt i Europe/Stockholm det dygn `ms` tillhör.
 *  Stockholm ligger alltid på hela timmar mot UTC, så timstegen är exakta. */
export function startOfStockholmDay(ms: number): number {
    const today = stockholmDayKey(ms);
    let t = ms - (ms % HOUR_MS);
    while (stockholmDayKey(t) === today) t -= HOUR_MS;
    return t + HOUR_MS;
}

/* ── Urvalet ─────────────────────────────────────────────────────────────── */

export interface PlanSelection {
    picked: OutreachContact[];
    skipped: { contactId: string; contactName: string; reason: string }[];
}

/**
 * Plocka dagens grupper ur den redan rankade kön.
 *
 * `alreadyDrafted` = kontakter som redan har ett färskt oanvänt utkast; de får
 * inte ett till (det gör cronen idempotent — kör den två gånger och andra
 * körningen skapar noll).
 */
export function selectForPlanning(
    queue: QueueItem[],
    opts: { limit: number; alreadyDrafted: Set<string> },
): PlanSelection {
    const picked: OutreachContact[] = [];
    const skipped: PlanSelection['skipped'] = [];
    const citiesInBatch = new Set<string>();

    for (const item of queue) {
        const c = item.contact;
        const skip = (reason: string) => skipped.push({ contactId: c.id, contactName: c.name, reason });

        if (picked.length >= opts.limit) break;

        // Hårda grindar är redan avgjorda i buildQueueResponse (item.blocked),
        // men kön kan ha byggts av en annan anropare — kontrollera ändå.
        if (item.blocked) { skip('Spärrad av en hård grind (karens/avskriven/veckodag)'); continue; }

        if (opts.alreadyDrafted.has(c.id)) { skip('Har redan ett färskt utkast i delningskön'); continue; }

        const failedSoft = item.gates.find(g => !g.ok && SOFT_GATES_THAT_BLOCK_AUTO.includes(g.id));
        if (failedSoft) { skip(failedSoft.label); continue; }

        if (c.eventSupplyThisWeek === undefined) {
            skip('Saknar koordinat — utbudet går inte att räkna (fyll i lat/lng på kontakten)');
            continue;
        }
        if (c.eventSupplyThisWeek < MIN_SUPPLY_FOR_AUTO) {
            skip(`Bara ${c.eventSupplyThisWeek} event i veckan — tipsfrågeformat är ett ägarbeslut, generera manuellt`);
            continue;
        }

        // Stadskrock INOM satsen: grinden ser bara bekräftade postningar, så två
        // grupper i samma ort skulle annars kunna hamna i samma morgonsats.
        const city = c.city?.toLowerCase();
        if (city && citiesInBatch.has(city)) {
            skip(`En annan grupp i ${c.city} ligger redan i dagens sats`);
            continue;
        }

        picked.push(c);
        if (city) citiesInBatch.add(city);
    }

    return { picked, skipped };
}

/* ── Varianten ───────────────────────────────────────────────────────────── */

/** Godkännandekö (och okänt läge) ⇒ V1, länken i inlägget: en kölagd post kan
 *  inte kommenteras före godkännandet. Direktpublicering ⇒ V2. */
export function variantFor(mode: PostingMode): { variant: string; linkPlacement: LinkPlacement } {
    return mode === 'direct'
        ? { variant: 'V2', linkPlacement: 'i-första-kommentaren' }
        : { variant: 'V1', linkPlacement: 'i-inlägget' };
}

/* ── Eventraderna tillbaka till riktiga event ────────────────────────────── */

const normTitle = (t: string) => t.toLowerCase().replace(/\s+/g, ' ').trim();

export interface ResolvedEvents {
    // eventId är alltid satt: en rad hamnar här bara om den matchat en kandidat,
    // och kandidaterna bär aggregatets id.
    events: { eventId: string; title: string; timeISO: string; emoji?: string }[];
    /** Titlar modellen skrev som inte fanns bland kandidaterna. Ska vara tom —
     *  en icke-tom lista betyder att texten måste läsas igenom före postning. */
    unmatched: string[];
}

/**
 * Modellen svarar med titel + veckodag, inte med id och tidpunkt. För att
 * kunna avgöra om ett utkast HUNNIT BLI INAKTUELLT måste varje nämnd rad
 * kopplas tillbaka till kandidaten den kom ur — det är timeISO som bär
 * färskvarudatumet.
 */
export function resolveMentionedEvents(
    mentioned: { title: string; emoji?: string }[],
    candidates: CandidateEvent[],
): ResolvedEvents {
    const byTitle = new Map<string, CandidateEvent>();
    for (const c of candidates) {
        const key = normTitle(c.title);
        if (!byTitle.has(key)) byTitle.set(key, c);
    }

    const events: ResolvedEvents['events'] = [];
    const unmatched: string[] = [];

    for (const m of mentioned) {
        const key = normTitle(m.title);
        let hit = byTitle.get(key);

        // Modellen kortar ibland en lång titel ("Sommarglitter i Hembygdsparken
        // – fri entré" → "Sommarglitter"). Fall tillbaka på entydig delsträng.
        if (!hit && key.length >= 6) {
            const partial = candidates.filter(c => {
                const ck = normTitle(c.title);
                return ck.includes(key) || key.includes(ck);
            });
            if (partial.length === 1) hit = partial[0];
        }

        if (hit) {
            events.push({
                eventId: hit.id,
                title: hit.title,
                timeISO: hit.timeISO,
                emoji: m.emoji || hit.emoji || undefined,
            });
        } else {
            unmatched.push(m.title);
        }
    }

    return { events, unmatched };
}

/* ── Färskvaran ──────────────────────────────────────────────────────────── */

export interface Freshness { fresh: boolean; reason?: string }

/**
 * Är utkastet fortfarande postbart som det är?
 *
 * En eventrad räknas som passerad när den ligger före MIDNATT I DAG, inte före
 * "nu": heldagsevent lagras kl 00:00 och ett sådant event idag är fortfarande
 * högst aktuellt kl 09:00. Kvällens event får alltså ligga kvar dagen ut —
 * det är gårdagens rader som sänker ett inlägg.
 */
export function draftFreshness(entry: OutreachLogEntry, now: number): Freshness {
    const ageH = (now - entry.draftCreatedAt) / HOUR_MS;
    if (ageH > MAX_DRAFT_AGE_HOURS) {
        return { fresh: false, reason: `Utkastet är ${Math.round(ageH)} h gammalt — kartdatat har hunnit ändras, generera om` };
    }

    const cutoff = startOfStockholmDay(now);
    const rows = entry.mentionedEvents ?? [];
    const passed = rows.filter(e => {
        const t = Date.parse(e.timeISO);
        return Number.isFinite(t) && t < cutoff;
    });
    if (passed.length > 0) {
        return {
            fresh: false,
            reason: `${passed.length} av ${rows.length} eventrader har redan varit (${passed.map(p => p.title).slice(0, 2).join(', ')}${passed.length > 2 ? '…' : ''})`,
        };
    }

    return { fresh: true };
}

/* ── Loggraden → det klienten får ────────────────────────────────────────── */

export function toReadyPost(
    entry: OutreachLogEntry,
    contact: OutreachContact | undefined,
    now: number,
): ReadyPost {
    const { fresh, reason } = draftFreshness(entry, now);

    const warnings: string[] = [];
    if (entry.unmatchedTitles?.length) {
        warnings.push(
            `${entry.unmatchedTitles.length} eventrad(er) matchade ingen kandidat (${entry.unmatchedTitles.slice(0, 2).join(', ')}) — läs igenom texten innan du postar`,
        );
    }
    if (typeof entry.supplyNearCount === 'number' && entry.supplyNearCount < 5) {
        warnings.push(`Bara ${entry.supplyNearCount} event inom 8 km — utkastet är skrivet som tipsfråga, inte som utbudslista`);
    }
    if (entry.supplySource === 'snapshot') {
        warnings.push('Eventdatat kom från deploy-snapshoten, inte live — kontrollera raderna mot kartan');
    }

    return {
        logId: entry.id,
        contactId: entry.contactId,
        contactName: entry.contactName,
        city: contact?.city,
        groupUrl: contact?.groupUrl,
        memberCount: contact?.memberCount,
        postingMode: contact?.postingMode ?? 'unknown',
        variant: entry.variant ?? 'V1',
        linkPlacement: entry.linkPlacement ?? 'i-inlägget',
        linkUrl: entry.linkUrl,
        bodyText: entry.bodyText ?? '',
        firstCommentText: entry.firstCommentText,
        alternate: entry.alternate,
        angle: entry.angle,
        mentionedEvents: entry.mentionedEvents ?? [],
        fresh,
        staleReason: reason,
        warnings,
        draftCreatedAt: entry.draftCreatedAt,
        plannedFor: entry.plannedFor,
        plannedBy: entry.plannedBy,
    };
}

/**
 * Copy-paste-spärren inom en och samma sats: Facebook demoterar återanvänd
 * text, och två grannorter som får nästan samma inlägg samma morgon är precis
 * det misstaget. Lägger varningen på BÅDA raderna så den syns var man än tittar.
 */
export function flagNearDuplicates(posts: ReadyPost[], threshold = 0.8): void {
    for (let i = 0; i < posts.length; i++) {
        for (let j = i + 1; j < posts.length; j++) {
            const sim = trigramSimilarity(posts[i].bodyText, posts[j].bodyText);
            if (sim < threshold) continue;
            const pct = Math.round(sim * 100);
            posts[i].warnings.push(`${pct} % lik utkastet till ${posts[j].contactName} — skriv om ett av dem`);
            posts[j].warnings.push(`${pct} % lik utkastet till ${posts[i].contactName} — skriv om ett av dem`);
        }
    }
}
