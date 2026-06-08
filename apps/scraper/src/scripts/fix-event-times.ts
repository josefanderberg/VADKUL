/**
 * fix-event-times.ts — Backfill tid för events där scrapern bara fick datumet.
 *
 * Symptom: events visas på "kl 02:00 på natten" — det är midnatt UTC (sitevision
 * och liknande list-engines extraherar bara `<time datetime="YYYY-MM-DD">`,
 * vilket blir 00:00:00 UTC = 02:00 svensk tid i sommar-DST).
 *
 * Fix: hämta detail-sidan med riktig User-Agent, leta efter:
 *   "klockan HH.MM" / "klockan HH:MM"
 *   "kl HH.MM" / "kl. HH:MM"
 *   "HH.MM – HH.MM" / "HH:MM - HH:MM"  (i kontext av "klockan"/"tid"/"datum")
 *
 * Skriver till SQLite + Firestore. NOT_FOUND-säker (samma mönster som audit-fixen).
 *
 * Användning:
 *   npm run fix-times                  # dry-run
 *   npm run fix-times -- --apply       # skriver
 *   npm run fix-times -- --limit=20    # max 20 events (för smoke-test)
 *
 * Default-filter:
 *   - hidden=0
 *   - time >= now
 *   - time matchar T00:00:00 (midnatt UTC)
 *   - firestoreId IS NOT NULL
 */

import Database from 'better-sqlite3';
import path from 'path';
import { db } from '../config/firebase';

const APPLY = process.argv.includes('--apply');
const LIMIT_ARG = process.argv.find(a => a.startsWith('--limit='));
const LIMIT = LIMIT_ARG ? parseInt(LIMIT_ARG.split('=')[1], 10) : 999_999;

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

interface Row {
    url: string;
    firestoreId: string | null;
    title: string;
    time: string;
    hostName: string | null;
}

/** Plocka första start-tid (HH:MM) från detail-sidans text. Returnerar null om inget hittas. */
function extractTime(html: string): { hh: number; mm: number } | null {
    // Strippa taggar + normalisera whitespace
    const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

    const patterns = [
        // "klockan 18.30" eller "klockan 18:30"
        /klockan\s+(\d{1,2})[.:](\d{2})/i,
        // "kl 18.30" eller "kl. 18:30"
        /\bkl\.?\s+(\d{1,2})[.:](\d{2})/i,
        // "18.30 – 21.00" eller "18:30 - 21:00" (intervall, ta första)
        /(\d{1,2})[.:](\d{2})\s*[–\-—]\s*\d{1,2}[.:]\d{2}/,
        // Sista utvägen: HTML time-element som är ren tid (om sitevision sparat tid också)
        /<time[^>]*datetime="(\d{1,2}):(\d{2})"/,
    ];

    for (const re of patterns) {
        const m = text.match(re);
        if (m) {
            const hh = parseInt(m[1], 10);
            const mm = parseInt(m[2], 10);
            if (hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59) {
                return { hh, mm };
            }
        }
    }
    return null;
}

/** Bygg en UTC-Date för givet datum + Stockholm-tid. Hanterar DST automatiskt. */
function svenskTimeToUtc(dateOnlyIso: string, hh: number, mm: number): Date {
    // dateOnlyIso = "2026-06-08T00:00:00.000Z" → vi vill ha 2026-06-08 HH:MM Stockholm-tid
    const dateStr = dateOnlyIso.slice(0, 10); // "2026-06-08"
    // Skapa Date i Stockholm-tid via Intl/locale-trick:
    // En lokal tid "2026-06-08T18:30:00" tolkad av V8 är i lokala tidszonen som
    // process kör — vilket på Mac mini är Europe/Stockholm. Så detta är "rätt".
    // Vi använder en faux-ISO utan Z för att tvinga lokal-tolkning.
    const local = new Date(`${dateStr}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00`);
    return local; // toISOString() ger korrekt UTC oavsett DST
}

async function fetchHtml(url: string): Promise<string | null> {
    try {
        const ac = new AbortController();
        const t = setTimeout(() => ac.abort(), 15_000);
        const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: ac.signal });
        clearTimeout(t);
        if (!res.ok) return null;
        const ctype = res.headers.get('content-type') || '';
        if (!ctype.includes('html') && !ctype.includes('text')) return null;
        return await res.text();
    } catch {
        return null;
    }
}

async function main() {
    if (!db) throw new Error('Firebase ej init');

    const DB_PATH = path.resolve(__dirname, '../../events.db');
    const sqliteDb = new Database(DB_PATH);

    console.log(APPLY ? '🔧 APPLY' : '🔍 DRY-RUN');
    const rows = sqliteDb.prepare<[], Row>(`
        SELECT url, firestoreId, title, time, hostName
        FROM link_events
        WHERE hidden = 0
          AND time >= datetime('now')
          AND time LIKE '%T00:00:00%'
          AND firestoreId IS NOT NULL
        ORDER BY time ASC
        LIMIT ${LIMIT}
    `).all();
    console.log(`Kandidater (time=midnatt UTC): ${rows.length}\n`);

    const upd = sqliteDb.prepare('UPDATE link_events SET time = ?, updatedAt = ? WHERE url = ?');

    let fixed = 0, noTime = 0, fetchFail = 0, gone = 0, errors = 0;
    for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const tag = `[${String(i + 1).padStart(3)}/${rows.length}]`;
        const html = await fetchHtml(r.url);
        if (!html) {
            fetchFail++;
            if (fetchFail <= 5) console.log(`  ${tag} 🚫 fetch fail: ${r.title.slice(0, 50)}`);
            continue;
        }
        const time = extractTime(html);
        if (!time) {
            noTime++;
            if (noTime <= 8) console.log(`  ${tag} ⏰ ingen tid: ${r.title.slice(0, 50)}`);
            continue;
        }
        const newDate = svenskTimeToUtc(r.time, time.hh, time.mm);
        const newIso = newDate.toISOString();
        console.log(`  ${tag} ✅ ${String(time.hh).padStart(2, '0')}:${String(time.mm).padStart(2, '0')} | ${r.title.slice(0, 55)}`);

        if (!APPLY) { fixed++; continue; }

        // SQLite först
        try {
            upd.run(newIso, new Date().toISOString(), r.url);
        } catch (e) {
            errors++;
            console.error(`     ❌ SQLite fail: ${(e as Error).message}`);
            continue;
        }

        // Firestore
        try {
            await db.collection('linkEvents').doc(r.firestoreId!).update({ time: newDate });
            fixed++;
        } catch (e) {
            const err = e as Error & { code?: number };
            if (err.code === 5) { gone++; fixed++; } // SQLite redan uppdaterat
            else {
                errors++;
                console.error(`     ❌ Firestore fail: ${err.message}`);
            }
        }
    }

    sqliteDb.close();
    console.log('\n=== Klart ===');
    console.log(`  ✅ Fixade:        ${fixed}`);
    console.log(`  ⏰ Ingen tid:      ${noTime}`);
    console.log(`  🚫 Fetch fail:     ${fetchFail}`);
    console.log(`  👻 Gone Firestore: ${gone}  (SQLite uppdaterad ändå)`);
    console.log(`  ❌ Fel:            ${errors}`);
    if (!APPLY) console.log('\n(dry-run — kör med --apply för att skriva)');
    process.exit(errors > 0 ? 1 : 0);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
