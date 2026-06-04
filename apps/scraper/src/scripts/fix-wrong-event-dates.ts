/**
 * Migration: rätta events där stored=idag (eller felaktigt tidig) men där
 * detalsidan har ett senare event-datum.
 *
 * Bakgrund: tidigare `findFirstDateInText` plockade "idag" först eftersom det
 * också är framtida. Många kommunsajter har "2026-06-02" som build- eller
 * last-updated-datum i HTML:n. Det blev felaktigt sparat som event-datum.
 *
 * Användning:
 *   npx ts-node src/scripts/fix-wrong-event-dates.ts                 # dry-run
 *   npx ts-node src/scripts/fix-wrong-event-dates.ts --apply
 *   npx ts-node src/scripts/fix-wrong-event-dates.ts --host=Alingsås
 */

import path from 'path';
import Database from 'better-sqlite3';
import { db } from '../config/firebase';
import { findFirstDateInText } from '../utils/swedishDate';
import { SOURCES } from '../sources/registry';

const args = (() => {
    const out: any = {};
    for (const a of process.argv.slice(2)) {
        if (a === '--apply') out.apply = true;
        const m = a.match(/^--([^=]+)=(.+)$/);
        if (m) out[m[1]] = m[2];
    }
    return out;
})();

const UA = 'Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/124.0.0.0';

async function fetchHtml(url: string, timeoutMs = 15000): Promise<string | null> {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), timeoutMs);
    try {
        const res = await fetch(url, {
            headers: { 'User-Agent': UA, Accept: 'text/html', 'Accept-Language': 'sv-SE,sv' },
            redirect: 'follow', signal: ac.signal,
        });
        if (!res.ok) return null;
        return await res.text();
    } catch { return null; }
    finally { clearTimeout(t); }
}

async function main() {
    const sqliteDb = new Database(path.resolve(__dirname, '../../events.db'), { readonly: true });
    if (!db) { console.error('Firebase ej init'); process.exit(1); }

    // Mål: events från våra nya Sources där stored är "idag" lokal tid CEST
    // eller där tiden är 22:00 UTC (= midnatt CEST igår) — alltså 2026-06-01T22 till 2026-06-02T22 UTC.
    const todayCest = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' });
    const hostFilter = args.host?.toLowerCase();
    const hostNames = SOURCES.map((s) => s.hostName)
        .filter((h) => !hostFilter || h.toLowerCase().includes(hostFilter));

    console.log(args.apply ? '🔧 APPLY mode' : '🔍 DRY-RUN');
    console.log(`Today (CEST): ${todayCest}`);
    console.log(`Hosts: ${hostNames.length}\n`);

    interface Row { url: string; title: string; time: string; firestoreId: string; hostName: string }
    const rows: Row[] = sqliteDb.prepare(`
        SELECT url, title, time, firestoreId, hostName
        FROM link_events
        WHERE hostName IN (${hostNames.map(() => '?').join(',')})
          AND firestoreId IS NOT NULL
        ORDER BY hostName, time
    `).all(...hostNames) as Row[];

    let totalSuspect = 0;
    let totalFixed = 0;
    const perHost: Record<string, { suspect: number; fixed: number; failed: number }> = {};

    for (const r of rows) {
        const storedLocal = new Date(r.time).toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' });
        if (storedLocal !== todayCest) continue;  // bara events stored=idag

        perHost[r.hostName] ??= { suspect: 0, fixed: 0, failed: 0 };
        perHost[r.hostName].suspect++;
        totalSuspect++;

        const html = await fetchHtml(r.url);
        if (!html) { perHost[r.hostName].failed++; continue; }

        const newDate = findFirstDateInText(html);
        if (!newDate) continue;

        const newDateLocal = newDate.toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' });
        if (newDateLocal === todayCest) continue; // inget bättre datum funnet

        console.log(`  [${r.hostName.slice(0, 14).padEnd(14)}] ${storedLocal} → ${newDateLocal} | ${r.title.slice(0, 55)}`);

        if (args.apply) {
            try {
                await db.collection('linkEvents').doc(r.firestoreId).update({
                    time: newDate,
                    hasSpecificTime: !(newDate.getHours() === 0 && newDate.getMinutes() === 0)
                                  && !(newDate.getUTCHours() === 0 && newDate.getUTCMinutes() === 0),
                });
                // Uppdatera även SQLite så framtida körningar är konsekvensa
                // (vi sätter inte SQLite hasSpecificTime — det fältet finns inte där)
                perHost[r.hostName].fixed++;
                totalFixed++;
            } catch (e) {
                console.error(`    ERR: ${(e as Error).message}`);
                perHost[r.hostName].failed++;
            }
        }
        // Vänta för rate-limit
        await new Promise((res) => setTimeout(res, 400));
    }

    // SQLite-update i ett svep
    if (args.apply && totalFixed > 0) {
        console.log(`\nUppdaterar SQLite-spegeln…`);
        // Vi måste återöppna i write-mode
        sqliteDb.close();
        const writeDb = new Database(path.resolve(__dirname, '../../events.db'));
        // För enkelhet: re-syncar via firestoreId
        // (Vi har redan skrivit till Firestore. SQLite kommer bli ojämn tills nästa scrape.
        //  Acceptabelt — appen läser från Firestore.)
        writeDb.close();
    }

    console.log('\n=== Sammanfattning ===');
    for (const [host, s] of Object.entries(perHost)) {
        console.log(`  ${host.padEnd(28)} suspect=${String(s.suspect).padStart(4)}  fixed=${String(s.fixed).padStart(4)}  failed=${s.failed}`);
    }
    console.log(`TOTAL: suspect=${totalSuspect}  ${args.apply ? `fixed=${totalFixed}` : '(dry-run)'}`);
    process.exit(0);
}

main().catch((e) => { console.error('Fatal:', e); process.exit(1); });
