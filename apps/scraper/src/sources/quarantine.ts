/**
 * Auto-karantän — pausar källor som bevisat inte levererar, i stället för att
 * hamra dem varje natt tills en människa märker det.
 *
 * Kriteriet sätts av scripts/auto-quarantine.ts (körs i nattkedjan efter
 * scrapersteget): N raka körningar där källan inte såg NÅGONTING
 * (found=0, inga dubblett-/fönster-skips) ⇒ in i karantän. Källor med
 * found>0 men saved=0 är friska-men-tysta (allt var dubbletter) och rörs inte.
 *
 * Självläkning: var RETRY_INTERVAL_DAYS:e dag släpps en karantänsatt källa
 * igenom schemat för EN retry-körning. Ser den liv igen (found/skips > 0)
 * släpper auto-quarantine.ts ut den; annars förblir den pausad.
 *
 * Tillståndet bor i apps/scraper/quarantine.json (versionerad — committas av
 * nattjobbet så historiken syns i git). Manuella körningar med --ids/--id
 * går ALDRIG genom schemat och påverkas därför inte av karantänen.
 */

import fs from 'fs';
import path from 'path';
import { Source } from './types';

/** Lokal kopia av schedule.localDayNumber — medvetet, för att undvika cirkulär import. */
function localDayNumber(d: Date): number {
    return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000);
}

export const RETRY_INTERVAL_DAYS = 7;

export interface QuarantineEntry {
    /** YYYY-MM-DD när källan sattes i karantän */
    since: string;
    reason: string;
    /** YYYY-MM-DD för senaste retry-försöket (sätts när retry-körningen utvärderats) */
    lastRetry?: string;
    /** Antal retries som fortfarande var tomma */
    emptyRetries?: number;
}

export interface QuarantineFile {
    version: 1;
    /** sourceId → entry */
    sources: Record<string, QuarantineEntry>;
}

export const QUARANTINE_PATH = path.resolve(__dirname, '../../quarantine.json');

export function loadQuarantine(): QuarantineFile {
    try {
        const parsed = JSON.parse(fs.readFileSync(QUARANTINE_PATH, 'utf8'));
        if (parsed && parsed.version === 1 && parsed.sources) return parsed;
    } catch {
        /* saknas eller trasig → tom */
    }
    return { version: 1, sources: {} };
}

export function saveQuarantine(q: QuarantineFile): void {
    const sorted: QuarantineFile = {
        version: 1,
        sources: Object.fromEntries(Object.entries(q.sources).sort(([a], [b]) => a.localeCompare(b))),
    };
    fs.writeFileSync(QUARANTINE_PATH, JSON.stringify(sorted, null, 2) + '\n');
}

export function todayISO(d: Date = new Date()): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function daysBetween(fromISO: string, to: Date): number {
    const [y, m, d] = fromISO.split('-').map(Number);
    return localDayNumber(to) - localDayNumber(new Date(y, m - 1, d));
}

/** Är källan i karantän och INTE due för retry idag? */
export function isHeldToday(entry: QuarantineEntry, today: Date = new Date()): boolean {
    const anchor = entry.lastRetry ?? entry.since;
    return daysBetween(anchor, today) < RETRY_INTERVAL_DAYS;
}

/**
 * Partitionera schemalagda källor mot karantänen.
 *  - run:      körs som vanligt (ej i karantän)
 *  - retrying: i karantän men due för sin veckoretry — körs idag
 *  - held:     i karantän, pausade idag
 */
export function applyQuarantine(
    sources: Source[],
    today: Date = new Date(),
): { run: Source[]; retrying: Source[]; held: Source[] } {
    const q = loadQuarantine();
    const run: Source[] = [];
    const retrying: Source[] = [];
    const held: Source[] = [];
    for (const s of sources) {
        const entry = q.sources[s.id];
        if (!entry) run.push(s);
        else if (isHeldToday(entry, today)) held.push(s);
        else retrying.push(s);
    }
    return { run, retrying, held };
}
