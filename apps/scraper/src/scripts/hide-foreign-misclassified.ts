/**
 * Hide-foreign-misclassified: hitta och dölj events vars venue-text
 * indikerar utländsk plats (Arlington, Słupecka, Berlin etc.) men där
 * geocoder felaktigt mappat koordinater till svensk stad.
 *
 * Vi VET att problemet finns när:
 *   - extractedAddress eller locationName matchar utländsk indikator
 *   - title innehåller utländsk stad/region (utan svensk motpart)
 *   - description innehåller utländsk plats
 *
 * Strategi:
 *   - För varje misstänkt event: hide=1 (raderar inte, kan revert)
 *   - Logga reason så vi kan revidera regler
 *
 * Användning:
 *   npx ts-node src/scripts/hide-foreign-misclassified.ts
 *   npx ts-node src/scripts/hide-foreign-misclassified.ts --apply
 */

import Database from 'better-sqlite3';
import { db } from '../config/firebase';
import { setHidden } from '../utils/sqliteHelper';

const APPLY = process.argv.includes('--apply');

/**
 * Utländska markörer i adress/locationName/title som starkt tyder på att
 * eventet INTE är i Sverige. Lista är konservativ — inkludera bara entydigt
 * utländska orter/regioner. Svenska orter med dubbelnamn (t.ex. "Lund" finns
 * även i USA) hanterar vi via koordinatkontroll, inte text.
 */
const FOREIGN_MARKERS = [
    // USA — Vanliga namn
    /\barlington\b/i, /\bbrooklyn\b/i, /\bmanhattan\b/i, /\bqueens\b/i,
    /\bvirginia\b/i, /\btexas\b/i, /\bcalifornia\b/i, /\bflorida\b/i,
    /\bnew\s*york\b/i, /\blos\s*angeles\b/i, /\bsan\s*francisco\b/i,
    /\bchicago\b/i, /\bboston\b/i, /\bseattle\b/i, /\bportland\b/i,
    /\battanta\b/i, /\batlanta\b/i, /\bdallas\b/i, /\bhouston\b/i,
    // UK
    /\blondon\b/i, /\bmanchester\b/i, /\bliverpool\b/i, /\bbirmingham\b/i,
    /\bglasgow\b/i, /\bedinburgh\b/i, /\bberkshire\b/i,
    // Polen
    /\bsłupecka\b/i, /\bwarszaw/i, /\bkraków\b/i, /\bgdańsk\b/i, /\bwroclaw\b/i,
    /\bpoznan\b/i, /\bpolska\b/i,
    // Tyskland (orter ej i SE-domän)
    /\bberlin\b/i, /\bhamburg\b/i, /\bmünchen\b/i, /\bmunich\b/i, /\bköln\b/i,
    /\bcologne\b/i, /\bfrankfurt\b/i, /\bdüsseldorf\b/i,
    // Frankrike, Italien, Spanien (orter)
    /\bparis\b/i, /\bmarseille\b/i, /\blyon\b/i, /\bnice\b/i,
    /\broma\b/i, /\brome\b/i, /\bmilano\b/i, /\bmilan\b/i, /\bvenezia\b/i,
    /\bbarcelona\b/i, /\bmadrid\b/i, /\bvalencia\b/i, /\bsevilla\b/i,
    /\blisboa\b/i, /\blisbon\b/i,
    // Övriga
    /\bcopenhagen\b/i, /\bhelsinki\b/i, /\boslo\b/i,
    /\bamsterdam\b/i, /\brotterdam\b/i, /\bantwerp/i,
    /\bsydney\b/i, /\bmelbourne\b/i, /\bdubai\b/i, /\bbangkok\b/i,
    /\bsingapore\b/i, /\btokyo\b/i, /\bbeijing\b/i,
    /\bgoa\b/i, /\bmumbai\b/i, /\bdelhi\b/i,
    // Currency hint (event i annan valuta nämnt)
    /\$\d+\s*USD\b/i, /\$\d+\s*GBP\b/i, /€\d+\s*EUR\b/i,
];

function isForeignText(text: string | null | undefined): RegExp | null {
    if (!text) return null;
    for (const re of FOREIGN_MARKERS) {
        if (re.test(text)) return re;
    }
    return null;
}

async function main() {
    if (!db) throw new Error('Firebase ej init');
    const sqliteDb = new Database('events.db', { readonly: true });
    console.log(APPLY ? '🔧 APPLY' : '🔍 DRY-RUN');

    const rows = sqliteDb.prepare(`
        SELECT firestoreId, url, title, locationName, extractedAddress, description, lat, lng
        FROM link_events
        WHERE hidden = 0 AND time >= datetime('now')
        AND firestoreId IS NOT NULL
    `).all() as any[];

    const matches: { id: string; title: string; reason: string; url: string }[] = [];

    for (const r of rows) {
        // Bara geografi-fält — title/description är för osäkert (band-namn,
        // VM-prat etc. ger false positives).
        const checks: [string, string | null | undefined][] = [
            ['locationName', r.locationName],
            ['extractedAddress', r.extractedAddress],
        ];
        for (const [field, value] of checks) {
            const hit = isForeignText(value);
            if (hit) {
                matches.push({
                    id: r.firestoreId,
                    title: (r.title || '').slice(0, 50),
                    reason: `${field}: ${hit.source}`,
                    url: r.url,
                });
                break;
            }
        }
    }

    console.log(`\nMatchade utländska events: ${matches.length}`);
    // Gruppera per reason för översikt
    const byReason = new Map<string, number>();
    for (const m of matches) byReason.set(m.reason, (byReason.get(m.reason) || 0) + 1);
    const sorted = [...byReason.entries()].sort((a, b) => b[1] - a[1]);
    console.log('\nTopp reasons:');
    for (const [r, n] of sorted.slice(0, 15)) console.log(`  ${String(n).padStart(3)}x  ${r}`);

    console.log('\nSamples:');
    for (const m of matches.slice(0, 15)) {
        console.log(`  ${m.title.padEnd(50)} | ${m.reason}`);
    }

    if (!APPLY) {
        sqliteDb.close();
        console.log('\nKör med --apply för att hide.');
        process.exit(0);
    }

    // Per-doc update (inte batch) så ett enda redan-raderat doc inte tar med
    // hela jobbet. gRPC code 5 (NOT_FOUND) räknas som 'gone' — cleanup-old
    // kan ha raderat doc tidigare i samma run-daily-pipeline.
    // SQLite speglas oavsett (även för 'gone'-docs) — den publika feeden
    // aggregeras från SQLite, inte från Firestore.
    let hidden = 0, gone = 0, errors = 0;
    for (const m of matches) {
        try {
            await db.collection('linkEvents').doc(m.id).update({ hidden: true });
            hidden++;
            setHidden(m.url, true);
            if (hidden % 50 === 0) console.log(`  ...hidden ${hidden}/${matches.length}`);
        } catch (e) {
            const err = e as Error & { code?: number };
            if (err.code === 5) {
                gone++;
                setHidden(m.url, true);
            } else {
                errors++;
                console.error(`  ❌ Firestore-write fail ${m.id}: ${err.message}`);
            }
        }
    }
    sqliteDb.close();
    console.log(`\n✅ Hidden ${hidden} utländska events i prod (gone=${gone}, fel=${errors}).`);
    process.exit(0);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
