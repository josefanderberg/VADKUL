/**
 * Audit-events: kör llmAudit mot framtida events och sparar resultatet
 * på Firestore-dokumentet som `aiAudit` { verdict, confidence, reason, at }.
 *
 * Användning:
 *   npx ts-node src/scripts/audit-events.ts                       # dry-run, alla
 *   npx ts-node src/scripts/audit-events.ts --apply
 *   npx ts-node src/scripts/audit-events.ts --apply --limit=50
 *   npx ts-node src/scripts/audit-events.ts --apply --only-new    # skipper redan auditerade
 *   npx ts-node src/scripts/audit-events.ts --apply --auto-hide-junk
 *     → sätter hidden=1 om verdict='junk' OCH inSweden=false ELLER confidence='high'
 *   npx ts-node src/scripts/audit-events.ts --apply --check-gps
 *     → kör även reverse-geocode + LLM-fuzzy match → aiAudit.gpsCheck
 *   npx ts-node src/scripts/audit-events.ts --apply --check-gps --auto-hide-wrong-gps
 *     → döljer events där GPS hamnar i fel land
 */

import Database from 'better-sqlite3';
import { db } from '../config/firebase';
import { auditEvent, auditGps, ollamaIsAvailable } from '../utils/llmAudit';
import { setHidden, setEventAuditWithCategory } from '../utils/sqliteHelper';
import { stamped } from '../utils/firestoreStamp';
import { looksLikeCinema } from '../utils/cinema';
import { ruleEmojiFor } from '../utils/emojiRules';
import { OLLAMA_CONCURRENCY, chunk } from '../utils/ollamaPool';

const AUDIT_MODEL = process.env.OLLAMA_AUDIT_MODEL ?? process.env.OLLAMA_MODEL ?? 'gemma4:latest';

const args = (() => {
    const out: any = {};
    for (const a of process.argv.slice(2)) {
        const m = a.match(/^--([^=]+)=(.+)$/);
        if (m) { out[m[1]] = m[2]; continue; }
        if (a.startsWith('--')) out[a.slice(2)] = true;
    }
    return out;
})();

const APPLY = !!args.apply;
const LIMIT = args.limit ? parseInt(args.limit, 10) : 1000;
const ONLY_NEW = !!args['only-new'];
const AUTO_HIDE = !!args['auto-hide-junk'];
const CHECK_GPS = !!args['check-gps'];
const AUTO_HIDE_WRONG_GPS = !!args['auto-hide-wrong-gps'];

interface Row {
    firestoreId: string;
    url: string;
    title: string;
    locationName: string | null;
    extractedAddress: string | null;
    description: string | null;
    hostName: string | null;
    lat: number | null;
    lng: number | null;
}

async function main() {
    if (!db) throw new Error('Firebase ej init');
    if (!await ollamaIsAvailable()) {
        console.error('❌ Ollama är inte tillgängligt på localhost:11434');
        console.error('   Starta med: ollama serve');
        process.exit(1);
    }
    const sqliteDb = new Database('events.db', { readonly: true });
    console.log(APPLY ? '🔧 APPLY' : '🔍 DRY-RUN');
    console.log(`AUTO_HIDE: ${AUTO_HIDE}, ONLY_NEW: ${ONLY_NEW}, LIMIT: ${LIMIT}, CHECK_GPS: ${CHECK_GPS}, AUTO_HIDE_WRONG_GPS: ${AUTO_HIDE_WRONG_GPS}`);

    const rows = sqliteDb.prepare(`
        SELECT firestoreId, url, title, locationName, extractedAddress, description, hostName, lat, lng
        FROM link_events
        WHERE hidden = 0 AND time >= datetime('now') AND firestoreId IS NOT NULL
        ORDER BY createdAt DESC
        LIMIT ?
    `).all(LIMIT) as Row[];

    console.log(`\nKandidater: ${rows.length}\n`);

    // Plocka redan-auditerade om ONLY_NEW — ur SQLite-spegeln (aiVerdict), inte
    // ett fullt Firestore-svep (~tiotusentals reads/natt). Spegeln är dessutom
    // den fullständiga auditloggen: audit-pending-daemon skriver bara aiVerdict
    // till SQLite — Firestore-dokumentens aiAudit.verdict sätts inte av daemonen,
    // så ett Firestore-svep missade daemon-auditerade events och re-auditerade dem.
    let alreadyAudited = new Set<string>();
    if (ONLY_NEW) {
        // Rader som skrevs av FALLBACK_RESULT när Ollama var nere (2026-09-04:
        // llama-server dödades mitt i K8) — suspect/low + ✨ — räknas INTE som
        // auditerade, så de får en riktig audit nästa körning.
        const audited = sqliteDb.prepare(`
            SELECT firestoreId FROM link_events
            WHERE aiVerdict IN ('ok', 'suspect', 'junk') AND firestoreId IS NOT NULL
              AND NOT (aiVerdict = 'suspect' AND aiConfidence = 'low' AND emoji = '✨')
        `).all() as Array<{ firestoreId: string }>;
        alreadyAudited = new Set(audited.map(r => r.firestoreId));
        console.log(`Hoppar över ${alreadyAudited.size} redan auditerade.\n`);
    }

    let stats = { ok: 0, suspect: 0, junk: 0, error: 0, hidden: 0, gone: 0, priced: 0, llmFail: 0 };
    // Transienta LLM-fel (Ollama nere/omstart) skrivs ALDRIG — samma regel som
    // audit-pending-daemon. Förr skrevs FALLBACK_RESULT (suspect/low/✨) till
    // SQLite + Firestore och eventet räknades sedan som auditerat för alltid.
    const TRANSIENT_REASONS = new Set(['LLM-anrop misslyckades', 'Kunde inte parsa LLM-svar']);
    const MAX_CONSECUTIVE_LLM_FAILS = 6;
    let consecutiveLlmFails = 0;
    let aborted = false;
    const gpsStats = { ok: 0, suspect: 0, wrong: 0, 'no-coords': 0, unknown: 0, hidden: 0, llmCalls: 0 };
    const startedAt = Date.now();

    const todo = rows.filter(r => !(ONLY_NEW && alreadyAudited.has(r.firestoreId)));
    console.log(`Att auditera: ${todo.length} (${OLLAMA_CONCURRENCY} parallella Ollama-anrop)\n`);

    // LLM-audit i batchar om OLLAMA_CONCURRENCY; GPS-check (Nominatim 1 req/s)
    // och Firestore-skrivning förblir sekventiella per batch.
    let i = -1;
    for (const batch of chunk(todo, OLLAMA_CONCURRENCY)) {
      const results = await Promise.all(batch.map(r => auditEvent({
            title: r.title,
            locationName: r.locationName || undefined,
            extractedAddress: r.extractedAddress || undefined,
            description: r.description || undefined,
            hostName: r.hostName || undefined,
            url: r.url,
      })));
      if (aborted) break;
      for (let b = 0; b < batch.length; b++) {
        const r = batch[b];
        const result = results[b];
        i++;
        if (TRANSIENT_REASONS.has(result.reason)) {
            stats.llmFail++;
            consecutiveLlmFails++;
            console.log(`  [${i + 1}/${todo.length}] ⏳ skippar (${result.reason}) | ${(r.title || '').slice(0, 50)}`);
            if (consecutiveLlmFails >= MAX_CONSECUTIVE_LLM_FAILS) {
                console.error(`❌ ${MAX_CONSECUTIVE_LLM_FAILS} LLM-fel i rad — Ollama svarar inte. Avbryter auditen; ${todo.length - i - 1} event lämnas till nästa körning.`);
                aborted = true;
                break;
            }
            continue;
        }
        consecutiveLlmFails = 0;

        // Biovisning: kategori scen med hög konfidens oavsett LLM:ens gissning
        // (taxonomin film → stage; utils/cinema). Emojin sätts vid skrivningen.
        if (looksLikeCinema(r.title, r.locationName)) { result.category = 'stage'; result.categoryConfidence = 'high'; }

        stats[result.verdict]++;
        if (result.price) stats.priced++;

        const prefix = result.verdict === 'junk' ? '🗑️ '
            : result.verdict === 'suspect' ? '❓'
            : '✅';
        const swMark = result.inSweden ? '' : ' [🌍 EJ SVERIGE]';
        const progress = `[${i + 1}/${todo.length}]`;
        const catTag = `${result.category}/${result.categoryConfidence}`;
        console.log(`  ${progress} ${prefix} ${result.verdict}/${result.confidence} 🏷️ ${catTag}${swMark} | ${(r.title || '').slice(0, 50)} → ${result.reason}`);

        // GPS-check körs sekventiellt efter event-audit (Nominatim 1 req/s).
        // Hoppa om vi redan vet att eventet är junk — det ska bort ändå.
        let gpsResult: Awaited<ReturnType<typeof auditGps>> | null = null;
        if (CHECK_GPS && result.verdict !== 'junk') {
            gpsResult = await auditGps({
                title: r.title,
                locationName: r.locationName || undefined,
                extractedAddress: r.extractedAddress || undefined,
                hostName: r.hostName || undefined,
                lat: r.lat || 0,
                lng: r.lng || 0,
            });
            gpsStats[gpsResult.verdict]++;
            if (gpsResult.usedLlm) gpsStats.llmCalls++;
            const gIcon = gpsResult.verdict === 'wrong' ? '🚩'
                : gpsResult.verdict === 'suspect' ? '⚠️'
                : gpsResult.verdict === 'ok' ? '🗺️'
                : '·';
            console.log(`     ${gIcon} gps/${gpsResult.verdict} ${gpsResult.usedLlm ? '[LLM]' : '   '} → ${gpsResult.reason}`);
        }

        if (!APPLY) continue;

        const updates: any = {
            aiAudit: {
                verdict: result.verdict,
                confidence: result.confidence,
                reason: result.reason,
                inSweden: result.inSweden,
                category: result.category,
                categoryConfidence: result.categoryConfidence,
                at: new Date(),
                model: AUDIT_MODEL,
            },
        };

        // Top-level category skrivs över när audit ger high-confidence —
        // scraperns gissning är ofta 'other' så LLM-klassningen är bättre signal.
        // Vid medium/low behåller vi befintlig category för att inte degradera bra rader.
        if (result.categoryConfidence === 'high') {
            updates.category = result.category;
        }

        if (gpsResult) {
            updates.aiAudit.gpsCheck = {
                verdict: gpsResult.verdict,
                reason: gpsResult.reason,
                reverseCity: gpsResult.reverseCity,
                reverseDisplay: gpsResult.reverseDisplay?.slice(0, 200) ?? null,
                usedLlm: gpsResult.usedLlm,
                at: new Date(),
            };
        }

        // Auto-hide om junk med hög konfidens, eller junk + utanför Sverige
        if (AUTO_HIDE && result.verdict === 'junk' && (result.confidence === 'high' || !result.inSweden)) {
            updates.hidden = true;
            stats.hidden++;
        }

        // Auto-hide om GPS landar i fel land (snäv: bara 'wrong', inte 'suspect')
        if (AUTO_HIDE_WRONG_GPS && gpsResult && gpsResult.verdict === 'wrong') {
            updates.hidden = true;
            gpsStats.hidden++;
        }

        try {
            await db.collection('linkEvents').doc(r.firestoreId).update(stamped(updates));
            setEventAuditWithCategory(r.url, {
                verdict: result.verdict,
                confidence: result.confidence,
                category: result.category,
                categoryConfidence: result.categoryConfidence,
                // Regel-emoji (🎬 bio, 🥏 discgolf …) går före LLM:ens val (utils/emojiRules).
                emoji: ruleEmojiFor(r.title, r.locationName) ?? result.emoji,
                price: result.price,
            });
            // Spegla hidden till SQLite — den publika feeden aggregeras från SQLite
            // (aggregate-events.ts), inte Firestore. Utan detta når auto-hide aldrig
            // användarna och junk återpubliceras vid varje körning.
            if (updates.hidden === true) setHidden(r.url, true);
        } catch (e) {
            const err = e as Error & { code?: number };
            // Firestore NOT_FOUND (gRPC code 5): doc har raderats av cleanup-old
            // tidigare i samma run. Ingen att uppdatera — tyst skip, inte fel.
            if (err.code === 5) {
                stats.gone++;
            } else {
                stats.error++;
                console.error(`     ❌ DB write fail: ${err.message}`);
            }
        }
      }
      if (aborted) break;
    }

    const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
    sqliteDb.close();
    console.log('\n=== Sammanfattning ===');
    console.log(`  Total tid:     ${elapsed}s`);
    console.log(`  ✅ ok:         ${stats.ok}`);
    console.log(`  ❓ suspect:    ${stats.suspect}`);
    console.log(`  🗑️ junk:       ${stats.junk}`);
    console.log(`  🌍 hidden:     ${stats.hidden}  (auto-hide om aktiverat)`);
    console.log(`  💰 priced:     ${stats.priced}  (LLM extraherade pris från description)`);
    console.log(`  👻 gone:       ${stats.gone}  (Firestore-doc raderat av cleanup-old — skippat)`);
    console.log(`  ❌ errors:     ${stats.error}`);
    console.log(`  ⏳ LLM-fel:    ${stats.llmFail}  (skippade, inget skrivet — auditeras nästa körning${aborted ? '; körningen avbröts' : ''})`);
    if (CHECK_GPS) {
        console.log('\n=== GPS-check ===');
        console.log(`  🗺️ ok:         ${gpsStats.ok}`);
        console.log(`  ⚠️ suspect:    ${gpsStats.suspect}`);
        console.log(`  🚩 wrong:      ${gpsStats.wrong}`);
        console.log(`  ○ no-coords:   ${gpsStats['no-coords']}`);
        console.log(`  ? unknown:     ${gpsStats.unknown}`);
        console.log(`  🤖 LLM-anrop:  ${gpsStats.llmCalls}`);
        console.log(`  🙈 hidden:     ${gpsStats.hidden}  (auto-hide-wrong-gps om aktiverat)`);
    }
    process.exit(0);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
