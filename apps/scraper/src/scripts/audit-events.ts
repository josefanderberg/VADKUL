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
import { setHidden } from '../utils/sqliteHelper';

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

    // Plocka redan-auditerade om ONLY_NEW
    let alreadyAudited = new Set<string>();
    if (ONLY_NEW) {
        const snap = await db.collection('linkEvents').where('aiAudit.verdict', 'in', ['ok', 'suspect', 'junk']).get();
        alreadyAudited = new Set(snap.docs.map(d => d.id));
        console.log(`Hoppar över ${alreadyAudited.size} redan auditerade.\n`);
    }

    let stats = { ok: 0, suspect: 0, junk: 0, error: 0, hidden: 0 };
    const gpsStats = { ok: 0, suspect: 0, wrong: 0, 'no-coords': 0, unknown: 0, hidden: 0, llmCalls: 0 };
    const startedAt = Date.now();

    for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        if (ONLY_NEW && alreadyAudited.has(r.firestoreId)) continue;

        const result = await auditEvent({
            title: r.title,
            locationName: r.locationName || undefined,
            extractedAddress: r.extractedAddress || undefined,
            description: r.description || undefined,
            hostName: r.hostName || undefined,
            url: r.url,
        });

        stats[result.verdict]++;

        const prefix = result.verdict === 'junk' ? '🗑️ '
            : result.verdict === 'suspect' ? '❓'
            : '✅';
        const swMark = result.inSweden ? '' : ' [🌍 EJ SVERIGE]';
        const progress = `[${i + 1}/${rows.length}]`;
        console.log(`  ${progress} ${prefix} ${result.verdict}/${result.confidence}${swMark} | ${(r.title || '').slice(0, 50)} → ${result.reason}`);

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
                at: new Date(),
                model: process.env.OLLAMA_AUDIT_MODEL ?? 'qwen3:8b',
            },
        };

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
            await db.collection('linkEvents').doc(r.firestoreId).update(updates);
            // Spegla hidden till SQLite — den publika feeden aggregeras från SQLite
            // (aggregate-events.ts), inte Firestore. Utan detta når auto-hide aldrig
            // användarna och junk återpubliceras vid varje körning.
            if (updates.hidden === true) setHidden(r.url, true);
        } catch (e) {
            stats.error++;
            console.error(`     ❌ DB write fail: ${(e as Error).message}`);
        }
    }

    const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
    sqliteDb.close();
    console.log('\n=== Sammanfattning ===');
    console.log(`  Total tid:     ${elapsed}s`);
    console.log(`  ✅ ok:         ${stats.ok}`);
    console.log(`  ❓ suspect:    ${stats.suspect}`);
    console.log(`  🗑️ junk:       ${stats.junk}`);
    console.log(`  🌍 hidden:     ${stats.hidden}  (auto-hide om aktiverat)`);
    console.log(`  ❌ errors:     ${stats.error}`);
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
