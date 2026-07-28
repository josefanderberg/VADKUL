/**
 * audit-pending-daemon.ts — kontinuerlig audit av dagens-och-framåt events.
 *
 * Loop:
 *   1. Hämta upp till BATCH_SIZE events som ännu inte klassats med nya taxonomin
 *      (aiVerdict IS NULL ELLER emoji IS NULL) och som är i framtiden + ej dolda.
 *   2. Kör auditEvent() per event → skriv verdict + kategori + emoji + pris.
 *      Auto-hide om verdict='junk' (high-conf eller utanför Sverige).
 *   3. Om minst 1 event uppdaterades: kör runAggregation() så JSON + Firestore
 *      uppdateras → Josef ser ändringar live.
 *   4. Tom batch → sov 60s och loopa igen (fångar nyskrapade events).
 *
 * Idempotens: `emoji` sätts alltid vid lyckad audit, så samma event plockas
 * aldrig om — inga oändliga om-auditeringar (även genuina 'other' får emoji).
 * Transienta Ollama-fel skrivs INTE (event retrias nästa varv).
 *
 * Körning:
 *   npm run audit-daemon                     # kör för evigt
 *   npm run audit-daemon -- --max-batches=1  # en batch (smoke-test)
 *   npm run audit-daemon -- --batch-size=20
 *   npm run audit-daemon -- --dry-run        # ingen DB-write, ingen aggregate
 *
 * Schemaläggning: launchd se.vadkul.audit-pending (KeepAlive). Se infra/launchd/.
 */

import Database from 'better-sqlite3';
import path from 'path';
import { auditEvent, ollamaIsAvailable } from '../utils/llmAudit';
import { setEventAuditWithCategory, setHidden } from '../utils/sqliteHelper';
import { db as firestoreDb } from '../config/firebase';
import { runAggregation } from './aggregate-events';

const args = (() => {
    const out: Record<string, string | boolean> = {};
    for (const a of process.argv.slice(2)) {
        const m = a.match(/^--([^=]+)=(.+)$/);
        if (m) { out[m[1]] = m[2]; continue; }
        if (a.startsWith('--')) out[a.slice(2)] = true;
    }
    return out;
})();

const BATCH_SIZE  = args['batch-size'] ? parseInt(args['batch-size'] as string, 10) : 50;
const MAX_BATCHES = args['max-batches'] ? parseInt(args['max-batches'] as string, 10) : Infinity;
const DRY_RUN     = !!args['dry-run'];
const IDLE_SLEEP_MS = 60_000;

const DB_PATH = process.env.SCRAPER_SQLITE_PATH
    ? path.resolve(process.env.SCRAPER_SQLITE_PATH)
    : path.resolve(__dirname, '../../events.db');

// Reasons som betyder "transient LLM-fel" → skriv inte, retria nästa varv.
const TRANSIENT_REASONS = new Set(['LLM-anrop misslyckades', 'Kunde inte parsa LLM-svar']);

interface Row {
    url: string;
    firestoreId: string | null;
    title: string;
    locationName: string | null;
    extractedAddress: string | null;
    description: string | null;
    hostName: string | null;
}

let running = true;

function log(msg: string): void {
    console.log(`${new Date().toISOString()} ${msg}`);
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => {
        const t = setTimeout(resolve, ms);
        // Låt SIGTERM avbryta sömnen direkt.
        const onStop = () => { clearTimeout(t); resolve(); };
        process.once('SIGTERM', onStop);
        process.once('SIGINT', onStop);
    });
}

function fetchBatch(): Row[] {
    const rdb = new Database(DB_PATH, { readonly: true });
    try {
        return rdb.prepare<[], Row>(`
            SELECT url, firestoreId, title, locationName, extractedAddress, description, hostName
            FROM link_events
            WHERE time >= datetime('now')
              AND hidden = 0
              AND (aiVerdict IS NULL OR emoji IS NULL)
            ORDER BY time ASC
            LIMIT ${BATCH_SIZE}
        `).all();
    } finally {
        rdb.close();
    }
}

async function processBatch(rows: Row[]): Promise<number> {
    let updated = 0;
    const total = rows.length;
    for (let i = 0; i < rows.length && running; i++) {
        const r = rows[i];
        try {
            const result = await auditEvent({
                title:            r.title,
                locationName:     r.locationName  ?? undefined,
                extractedAddress: r.extractedAddress ?? undefined,
                description:      r.description   ?? undefined,
                hostName:         r.hostName      ?? undefined,
                url:              r.url,
            });

            // Transient LLM-fel: skriv inte, låt eventet ligga kvar till nästa varv.
            if (TRANSIENT_REASONS.has(result.reason)) {
                log(`  [${i + 1}/${total}] ⏳ skippar (LLM-fel) | ${(r.title || '').slice(0, 45)}`);
                continue;
            }

            const swFlag = result.inSweden ? '' : ' [EJ-SE]';
            const priceTag = result.price ? ` 💰${result.price}` : '';
            log(`  [${i + 1}/${total}] ${result.emoji} ${result.verdict}/${result.confidence}${swFlag}`
                + ` ${result.category}${priceTag} | ${(r.hostName || '?').slice(0, 14)} | ${(r.title || '').slice(0, 45)}`);

            if (!DRY_RUN) {
                setEventAuditWithCategory(r.url, {
                    verdict: result.verdict,
                    confidence: result.confidence,
                    category: result.category,
                    categoryConfidence: result.categoryConfidence,
                    emoji: result.emoji,
                    price: result.price,
                });
                const autoHide = result.verdict === 'junk' && (result.confidence === 'high' || !result.inSweden);
                if (autoHide) {
                    setHidden(r.url, true);
                    log(`           ↳ 🙈 auto-hidden`);
                }
                // Spegla till Firestore — audit-resultatet får inte vara
                // maskinlokalt (aggregate från annan maskin tappar det annars).
                if (firestoreDb && r.firestoreId) {
                    try {
                        await firestoreDb.collection('linkEvents').doc(r.firestoreId).update({
                            category: result.category,
                            emoji: result.emoji,
                            ...(result.price ? { price: result.price } : {}),
                            ...(autoHide ? { hidden: 1 } : {}),
                        });
                    } catch (err) {
                        log(`           ↳ ⚠️ Firestore-spegling misslyckades: ${(err as Error).message}`);
                    }
                }
                updated++;
            }
        } catch (err) {
            log(`  [${i + 1}/${total}] ❌ FEL: ${(err as Error).message} | ${(r.title || '').slice(0, 50)}`);
            // fortsätt — daemon dör aldrig på ett enskilt event
        }
    }
    return updated;
}

async function main(): Promise<void> {
    log(`🚀 audit-pending-daemon startar (batch=${BATCH_SIZE}, maxBatches=${MAX_BATCHES === Infinity ? '∞' : MAX_BATCHES}, dryRun=${DRY_RUN})`);

    let batchNo = 0;
    while (running && batchNo < MAX_BATCHES) {
        if (!await ollamaIsAvailable()) {
            log('⚠️  Ollama svarar inte — väntar 60s och försöker igen.');
            await sleep(IDLE_SLEEP_MS);
            continue;
        }

        const rows = fetchBatch();
        if (rows.length === 0) {
            log(`💤 Inga events att audita — sover ${IDLE_SLEEP_MS / 1000}s.`);
            batchNo++;
            await sleep(IDLE_SLEEP_MS);
            continue;
        }

        log(`📦 Batch ${batchNo + 1}: ${rows.length} events`);
        const started = Date.now();
        const updated = await processBatch(rows);
        const secs = ((Date.now() - started) / 1000).toFixed(1);
        log(`✅ Batch klar: ${updated}/${rows.length} uppdaterade på ${secs}s`);

        if (updated > 0 && !DRY_RUN) {
            try {
                log('🔄 Kör aggregate (JSON + Firestore)…');
                await runAggregation();
                log('🔄 Aggregate klar.');
            } catch (err) {
                log(`⚠️  Aggregate misslyckades: ${(err as Error).message}`);
            }
        }
        batchNo++;
    }
    log('👋 audit-pending-daemon avslutar.');
}

function shutdown(sig: string): void {
    log(`🛑 ${sig} mottagen — stoppar efter pågående event…`);
    running = false;
    // Ge loopen en chans att avsluta rent; tvinga annars exit efter 5s.
    setTimeout(() => process.exit(0), 5000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

main()
    .then(() => process.exit(0))
    .catch(err => { log(`💥 Fatal: ${err?.stack || err}`); process.exit(1); });
