/**
 * hide-junk-keywords.ts — Dölj events vars title/description matchar
 * "junk-keywords" som vi vet inte hör hemma i en kultur/events-app.
 *
 * Idag: vaccinations-events (Vaccin.nu, Fästingambulansen mfl). De är legitima
 * men inte vad användarna kommer till VADKUL för.
 *
 * Designval:
 *   - DETERMINISTISK (regex), inte LLM. Vi vet exakt vad vi vill bort.
 *   - Skriver hidden=1 i BÅDE SQLite OCH Firestore. Annars syns det på webben
 *     trots att SQLite säger gömt (eller tvärtom).
 *   - Tar hand om NOT_FOUND (cleanup-old kan ha raderat doc tidigare).
 *   - Idempotent: skippar redan-hidden events.
 *   - --apply krävs för att faktiskt skriva, annars dry-run.
 *
 * Användning:
 *   npm run hide-junk             # dry-run, visar vad som skulle göras
 *   npm run hide-junk -- --apply  # faktisk hide
 */

import Database from 'better-sqlite3';
import path from 'path';
import { db } from '../config/firebase';
import { setHidden } from '../utils/sqliteHelper';

const APPLY = process.argv.includes('--apply');

/**
 * Patterns som matchar i title ELLER description.
 * Lägg till nya genom att pusha en regel hit — inga andra ändringar.
 * `description` är substring-känslig så håll dem specifika.
 */
const JUNK_PATTERNS: { name: string; re: RegExp }[] = [
    // Vaccinations-events från Vaccin.nu, Fästingambulansen, Glömstapoolen mfl.
    // "vaccin" matchar både vaccin, vaccination, vaccinering, vaccinatör m.fl.
    { name: 'vaccin', re: /\bvaccin/i },

    // Falun Dafa / Falun Gong — sektrekrytering förklädd som "gratis qigong workshops"
    // i kommun-kalendrar. LLM:n auto-hider redan det men deterministisk filter
    // är snabbare och billigare än LLM-anrop per event.
    { name: 'falun-dafa', re: /\bfalun\s*(dafa|gong)\b/i },

    // Pyramidspel / MLM-rekrytering förklädd som "föreläsning" eller "workshop".
    // Konservativt — bara explicita branschord.
    { name: 'mlm', re: /\b(pyramidspel|multi[- ]?level[- ]?marketing|nätverksmarknadsföring)\b/i },
];

interface Row {
    firestoreId: string | null;
    url: string;
    title: string | null;
    description: string | null;
}

async function main() {
    if (!db) throw new Error('Firebase ej init');

    const DB_PATH = path.resolve(__dirname, '../../events.db');
    const sqliteDb = new Database(DB_PATH, { readonly: true });

    console.log(APPLY ? '🔧 APPLY' : '🔍 DRY-RUN (kör med --apply för att faktiskt gömma)');
    console.log(`Patterns: ${JUNK_PATTERNS.map(p => p.name).join(', ')}`);

    const rows = sqliteDb.prepare<[], Row>(`
        SELECT firestoreId, url, title, description
        FROM link_events
        WHERE hidden = 0 AND time >= datetime('now')
    `).all();
    sqliteDb.close();

    interface Match { row: Row; matched: string }
    const matches: Match[] = [];
    for (const r of rows) {
        const haystack = `${r.title ?? ''}\n${r.description ?? ''}`;
        const hit = JUNK_PATTERNS.find(p => p.re.test(haystack));
        if (hit) matches.push({ row: r, matched: hit.name });
    }

    console.log(`\nMatchade junk-events: ${matches.length} / ${rows.length} aktiva`);
    if (matches.length === 0) { process.exit(0); }

    // Översikt per pattern
    const byPattern = new Map<string, number>();
    for (const m of matches) byPattern.set(m.matched, (byPattern.get(m.matched) ?? 0) + 1);
    console.log('\nFördelning:');
    for (const [k, n] of byPattern) console.log(`  ${String(n).padStart(3)}x  ${k}`);

    console.log('\nSamples:');
    for (const m of matches.slice(0, 8)) {
        console.log(`  [${m.matched}] ${(m.row.title ?? '').slice(0, 70)}`);
    }

    if (!APPLY) {
        console.log('\nKör med --apply för att gömma.');
        process.exit(0);
    }

    // ── Skriv ───────────────────────────────────────────────────────────────
    let sqliteOk = 0, firestoreOk = 0, gone = 0, errors = 0;
    for (const m of matches) {
        // SQLite först — vi äger den, ingen race.
        try {
            setHidden(m.row.url, true);
            sqliteOk++;
        } catch (e) {
            errors++;
            console.error(`  ❌ SQLite-write fail: ${m.row.url} — ${(e as Error).message}`);
        }

        // Firestore — kan vara raderat av cleanup-old (gRPC code 5 = NOT_FOUND).
        if (m.row.firestoreId) {
            try {
                await db.collection('linkEvents').doc(m.row.firestoreId).update({ hidden: true });
                firestoreOk++;
            } catch (e) {
                const err = e as Error & { code?: number };
                if (err.code === 5) {
                    gone++;
                } else {
                    errors++;
                    console.error(`  ❌ Firestore-write fail: ${m.row.firestoreId} — ${err.message}`);
                }
            }
        }
    }

    console.log('\n=== Klart ===');
    console.log(`  SQLite hidden:     ${sqliteOk}`);
    console.log(`  Firestore hidden:  ${firestoreOk}`);
    console.log(`  Firestore gone:    ${gone}  (doc raderat av cleanup-old)`);
    console.log(`  Fel:               ${errors}`);
    process.exit(errors > 0 ? 1 : 0);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
