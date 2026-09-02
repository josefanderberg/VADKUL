/**
 * igQueue.ts — schemakö för Instagram.
 *
 * VARFÖR EN EGEN KÖ: Facebooks Graph API kan schemalägga sidinlägg
 * (`scheduled_publish_time`), men Instagrams Content Publishing API kan INTE
 * — där finns bara "skapa container → publicera nu". Business Suite kan
 * schemalägga IG, fast bara i sitt eget gränssnitt, inte via API. Stadsinläggen
 * (schedule-city-posts.ts) schemaläggs därför på FB direkt hos Meta, medan
 * IG-tvillingen läggs i den här kön och publiceras av `publish-ig-queue.ts`
 * när klockan slår (launchd: se.vadkul.ig-queue, varje hel timme).
 *
 * Kön är en JSON-fil på den maskin som kör jobbet (Mac minin) — inte
 * Firestore: den läses/skrivs varje timme och innehåller inget som webben
 * behöver. Filen är gitignorerad (den innehåller inläggstexter i utkastform).
 *
 * FÄRSKVARA: en post som blivit mer än `STALE_MS` gammal publiceras INTE.
 * Ett stadsinlägg hör till en bestämd vecka; ligger jobbet nere ett dygn ska
 * torsdagens lista inte trilla ut på lördagen — den markeras `förfallen`.
 *
 * Ren logik (upsert/due/markering) är testad i igQueue.test.ts; I/O:t är
 * tunt med flit.
 */

import fs from 'fs';
import path from 'path';

export type IgQueueStatus = 'väntar' | 'publicerad' | 'misslyckad' | 'förfallen';

export interface IgQueueItem {
    /** Stabil nyckel — `<slug>-<YYYY-MM-DD-HH>`. Två körningar för samma ort
     *  och timme uppdaterar samma post i stället för att posta dubbelt. */
    id: string;
    /** Ortens namn, som det står i inlägget ("Västerås"). */
    town: string;
    /** Bildtexten som publiceras (FB-texten + hashtaggar). */
    caption: string;
    /**
     * Kartbilden — normalt vår ad-route. PNG duger här: runnern konverterar
     * till JPEG och lägger den i Firebase Storage innan IG får se den (Meta
     * hämtar bilden serverside och tar bara JPEG).
     */
    imageUrl: string;
    /** När inlägget ska ut, epoch ms — samma tid som FB-tvillingen. */
    publishAt: number;
    status: IgQueueStatus;
    /** FB-inlägget den hör ihop med, när posten kom ur schemakön där. */
    fbPostId?: string;
    igMediaId?: string;
    publishedAt?: number;
    attempts?: number;
    lastError?: string;
}

/** Så länge efter publishAt får en post fortfarande gå ut (6 h). */
export const STALE_MS = 6 * 60 * 60 * 1000;

export const QUEUE_PATH = process.env.IG_QUEUE_PATH
    ? path.resolve(process.env.IG_QUEUE_PATH)
    : path.resolve(__dirname, '../../ig-queue.json');

/* ── Ren logik ────────────────────────────────────────────────────────────── */

/** Nyckel för en ort + publiceringstid. Timupplösning räcker — vi lägger
 *  aldrig två inlägg för samma ort samma timme. */
export function queueId(slugOrTown: string, publishAt: number): string {
    const d = new Date(publishAt);
    const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}-${String(d.getHours()).padStart(2, '0')}`;
    return `${slugOrTown.toLowerCase()}-${stamp}`;
}

/**
 * Lägg till eller uppdatera en post. En REDAN PUBLICERAD post rörs aldrig —
 * annars skulle en omkörning av schedule-city-posts nolla status och posta
 * samma inlägg en gång till.
 */
export function upsertQueueItem(items: IgQueueItem[], item: IgQueueItem): IgQueueItem[] {
    const i = items.findIndex(x => x.id === item.id);
    if (i === -1) return [...items, item];
    if (items[i].status === 'publicerad') return items;
    const next = [...items];
    next[i] = { ...items[i], ...item, status: item.status ?? items[i].status };
    return next;
}

/** Poster som ska publiceras nu: väntande, förfallna i tid, inte för gamla. */
export function dueItems(items: IgQueueItem[], now: number, staleMs = STALE_MS): IgQueueItem[] {
    return items
        .filter(x => x.status === 'väntar' && x.publishAt <= now && now - x.publishAt <= staleMs)
        .sort((a, b) => a.publishAt - b.publishAt);
}

/** Väntande poster som hunnit bli för gamla — de ska markeras, inte postas. */
export function staleItems(items: IgQueueItem[], now: number, staleMs = STALE_MS): IgQueueItem[] {
    return items.filter(x => x.status === 'väntar' && now - x.publishAt > staleMs);
}

/**
 * Poster som ska TVINGAS ut oavsett klockslag och färskvara — läget när
 * token/behörigheten varit trasig och dagens inlägg redan hunnit markeras
 * `förfallen`. Selektorn är antingen ett exakt id (`landskrona-2026-09-02-06`)
 * eller ett datum (`2026-09-02`) som tar alla poster den dagen. En redan
 * publicerad post rörs aldrig — det får inte gå att dubbelposta den här vägen.
 */
export function forcedItems(items: IgQueueItem[], selectors: string[]): IgQueueItem[] {
    const wanted = selectors.map(s => s.trim().toLowerCase()).filter(Boolean);
    if (wanted.length === 0) return [];
    const matches = (x: IgQueueItem) => wanted.some(s =>
        (/^\d{4}-\d{2}-\d{2}$/.test(s) ? x.id.includes(`-${s}-`) : x.id === s));
    return items
        .filter(x => x.status !== 'publicerad' && matches(x))
        .sort((a, b) => a.publishAt - b.publishAt);
}

/** Ersätt en post (matchat på id) med en uppdaterad kopia. */
export function replaceItem(items: IgQueueItem[], id: string, patch: Partial<IgQueueItem>): IgQueueItem[] {
    return items.map(x => (x.id === id ? { ...x, ...patch } : x));
}

/* ── I/O ──────────────────────────────────────────────────────────────────── */

export function loadQueue(file = QUEUE_PATH): IgQueueItem[] {
    if (!fs.existsSync(file)) return [];
    try {
        const parsed = JSON.parse(fs.readFileSync(file, 'utf-8'));
        return Array.isArray(parsed) ? (parsed as IgQueueItem[]) : [];
    } catch (e) {
        console.error(`[IG-kö] Kunde inte läsa ${file}: ${(e as Error).message}`);
        return [];
    }
}

export function saveQueue(items: IgQueueItem[], file = QUEUE_PATH): void {
    const sorted = [...items].sort((a, b) => a.publishAt - b.publishAt);
    fs.writeFileSync(file, JSON.stringify(sorted, null, 2) + '\n');
}
