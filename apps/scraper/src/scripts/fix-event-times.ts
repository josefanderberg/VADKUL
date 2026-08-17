/**
 * fix-event-times.ts — Backfill tid för events där scrapern bara fick datumet.
 *
 * Symptom: events utan klockslag lagras med midnatt som platshållare —
 * antingen UTC-midnatt (T00:00:00Z, visas "02:00 på natten" i sommar-DST)
 * eller lokal midnatt (visas som "00:00"/datum-bara). Båda är fake-tider.
 *
 * Kandidatfilter: hasSpecificTime = 0 (sätts av runnern/migrationen) och
 * timeFixAttempts < 3 — efter tre resultatlösa detaljsido-besök ger vi upp
 * (sidan publicerar inget klockslag) och slutar slösa fetchar.
 *
 * Fix per event:
 *   1. Hämta detail-sidan, leta "klockan HH.MM" / "kl HH:MM" / "Tid: HH.MM" /
 *      "HH:MM–HH:MM"-intervall.
 *   2. Träff → sätt riktig tid + hasSpecificTime=1 (SQLite + Firestore).
 *   3. Ingen träff → bumpa timeFixAttempts. Om tiden var UTC-midnatt:
 *      normalisera till LOKAL midnatt samma kalenderdag, så webben visar
 *      "datum utan tid" istället för ett påhittat "02:00".
 *
 * Användning:
 *   npm run fix-times                  # dry-run
 *   npm run fix-times -- --apply       # skriver
 *   npm run fix-times -- --limit=20    # max 20 events (för smoke-test)
 */

import { db } from '../config/firebase';
// Delad anslutning via sqliteHelper — importen kör även schema-migrationerna
// (hasSpecificTime/timeFixAttempts-kolumnerna) innan vi frågar på dem.
import { sqlite } from '../utils/sqliteHelper';
import { stamped } from '../utils/firestoreStamp';

const APPLY = process.argv.includes('--apply');
const LIMIT_ARG = process.argv.find(a => a.startsWith('--limit='));
const LIMIT = LIMIT_ARG ? parseInt(LIMIT_ARG.split('=')[1], 10) : 999_999;
const MAX_ATTEMPTS = 3;

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

interface Row {
    url: string;
    firestoreId: string | null;
    title: string;
    time: string;
    hostName: string | null;
    timeFixAttempts: number | null;
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
        // "Tid: 18.30" (vanlig kommun-/föreningslayout)
        /\btid:?\s+(\d{1,2})[.:](\d{2})/i,
        // "18.30 – 21.00" eller "18:30 - 21:00" (intervall, ta första)
        /(\d{1,2})[.:](\d{2})\s*[–\-—]\s*\d{1,2}[.:]\d{2}/,
        // Sista utvägen: HTML time-element som är ren tid (om sitevision sparat tid också)
        /<time[^>]*datetime="(\d{1,2}):(\d{2})"/,
    ];

    for (const re of patterns) {
        const m = (re.source.startsWith('<time') ? html : text).match(re);
        if (m) {
            const hh = parseInt(m[1], 10);
            const mm = parseInt(m[2], 10);
            // 00:00 i text är nästan alltid layout-brus, inte ett klockslag.
            if (hh === 0 && mm === 0) continue;
            if (hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59) {
                return { hh, mm };
            }
        }
    }
    return null;
}

/** Bygg en UTC-Date för givet datum + Stockholm-tid. Hanterar DST automatiskt. */
function svenskTimeToUtc(dateOnlyIso: string, hh: number, mm: number): Date {
    // dateOnlyIso = "2026-06-08T00:00:00.000Z" → vi vill ha 2026-06-08 HH:MM Stockholm-tid.
    // En faux-ISO utan Z tolkas i processens lokala tidszon (Europe/Stockholm
    // på Mac minin) — toISOString() ger sedan korrekt UTC oavsett DST.
    const dateStr = localDayOf(dateOnlyIso);
    return new Date(`${dateStr}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00`);
}

/** Lokala kalenderdagen (YYYY-MM-DD) för en lagrad ISO-tid. */
function localDayOf(iso: string): string {
    const d = new Date(iso);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
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

async function updateFirestoreTime(firestoreId: string | null, newDate: Date): Promise<'ok' | 'gone' | 'fail'> {
    if (!firestoreId || !db) return 'ok';
    try {
        await db.collection('linkEvents').doc(firestoreId).update(stamped({ time: newDate }));
        return 'ok';
    } catch (e) {
        const err = e as Error & { code?: number };
        return err.code === 5 ? 'gone' : 'fail';
    }
}

async function main() {
    const sqliteDb = sqlite;

    console.log(APPLY ? '🔧 APPLY' : '🔍 DRY-RUN');
    const rows = sqliteDb.prepare(`
        SELECT url, firestoreId, title, time, hostName, timeFixAttempts
        FROM link_events
        WHERE hidden = 0
          AND time >= datetime('now')
          AND hasSpecificTime = 0
          AND COALESCE(timeFixAttempts, 0) < ${MAX_ATTEMPTS}
        ORDER BY time ASC
        LIMIT ${LIMIT}
    `).all() as Row[];
    console.log(`Kandidater (hasSpecificTime=0, försök < ${MAX_ATTEMPTS}): ${rows.length}\n`);

    const updTime = sqliteDb.prepare(
        'UPDATE link_events SET time = ?, hasSpecificTime = 1, updatedAt = ? WHERE url = ?',
    );
    const normalizeTime = sqliteDb.prepare(
        'UPDATE link_events SET time = ?, updatedAt = ? WHERE url = ?',
    );
    const bumpAttempts = sqliteDb.prepare(
        'UPDATE link_events SET timeFixAttempts = COALESCE(timeFixAttempts, 0) + 1 WHERE url = ?',
    );

    let fixed = 0, noTime = 0, fetchFail = 0, gone = 0, errors = 0, normalized = 0;
    for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const tag = `[${String(i + 1).padStart(3)}/${rows.length}]`;
        const html = await fetchHtml(r.url);

        let time: { hh: number; mm: number } | null = null;
        if (!html) {
            fetchFail++;
            if (fetchFail <= 5) console.log(`  ${tag} 🚫 fetch fail: ${r.title.slice(0, 50)}`);
        } else {
            time = extractTime(html);
        }

        if (!time) {
            if (html) {
                noTime++;
                if (noTime <= 8) console.log(`  ${tag} ⏰ ingen tid: ${r.title.slice(0, 50)}`);
            }
            if (!APPLY) continue;
            bumpAttempts.run(r.url);

            // UTC-midnatt → lokal midnatt samma kalenderdag, så inga "02:00"-
            // spöktider visas medan vi väntar på (eller gett upp om) klockslag.
            const stored = new Date(r.time);
            const isUtcMidnight = stored.getUTCHours() === 0 && stored.getUTCMinutes() === 0;
            const isLocalMidnight = stored.getHours() === 0 && stored.getMinutes() === 0;
            if (isUtcMidnight && !isLocalMidnight) {
                const localMidnight = new Date(`${localDayOf(r.time)}T00:00:00`);
                normalizeTime.run(localMidnight.toISOString(), new Date().toISOString(), r.url);
                await updateFirestoreTime(r.firestoreId, localMidnight);
                normalized++;
            }
            continue;
        }

        const newDate = svenskTimeToUtc(r.time, time.hh, time.mm);
        const newIso = newDate.toISOString();
        console.log(`  ${tag} ✅ ${String(time.hh).padStart(2, '0')}:${String(time.mm).padStart(2, '0')} | ${r.title.slice(0, 55)}`);

        if (!APPLY) { fixed++; continue; }

        // SQLite först
        try {
            updTime.run(newIso, new Date().toISOString(), r.url);
        } catch (e) {
            errors++;
            console.error(`     ❌ SQLite fail: ${(e as Error).message}`);
            continue;
        }

        // Firestore
        const fsResult = await updateFirestoreTime(r.firestoreId, newDate);
        if (fsResult === 'ok') fixed++;
        else if (fsResult === 'gone') { gone++; fixed++; }
        else {
            errors++;
            console.error(`     ❌ Firestore fail för ${r.url.slice(0, 60)}`);
        }
    }

    console.log('\n=== Klart ===');
    console.log(`  ✅ Fixade:           ${fixed}`);
    console.log(`  🕛 Normaliserade:     ${normalized}  (UTC-midnatt → lokal midnatt, ingen tid hittad)`);
    console.log(`  ⏰ Ingen tid:         ${noTime}`);
    console.log(`  🚫 Fetch fail:        ${fetchFail}`);
    console.log(`  👻 Gone Firestore:    ${gone}  (SQLite uppdaterad ändå)`);
    console.log(`  ❌ Fel:               ${errors}`);
    if (!APPLY) console.log('\n(dry-run — kör med --apply för att skriva)');
    process.exit(errors > 0 ? 1 : 0);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
