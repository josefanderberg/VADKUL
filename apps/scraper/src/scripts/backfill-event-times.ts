/**
 * backfill-event-times.ts — Återvinner saknad klockslag för befintliga
 * framtida events som ligger på 00:00.
 *
 * Per event:
 *   1. ?startTime=HH:MM i URL:en (Mölndal m.fl.) → ingen sidhämtning behövs.
 *   2. Annars: rendera sidan via Puppeteer och leta ett fristående HH:MM
 *      (<time>-element eller "kl HH:MM" i event-info) — samma logik som
 *      sitemap-enginens fix.
 *
 * Datumet bevaras alltid; bara klockan uppdateras. Hittas ingen tid → lämnas
 * 00:00 och loggas som "ingen tid" (genuint tidlösa events ska förbli midnatt).
 *
 * Körning:
 *   npm run backfill-times -- --dry-run     # visa gammal→ny, skriv inte
 *   npm run backfill-times                  # skarpt
 *   npm run backfill-times -- --limit=20
 */

import Database from 'better-sqlite3';
import path from 'path';
import puppeteer, { Browser } from 'puppeteer';

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const LIMIT = (() => { const a = args.find(x => x.startsWith('--limit=')); return a ? parseInt(a.split('=')[1], 10) : 100000; })();

const DB_PATH = process.env.SCRAPER_SQLITE_PATH
    ? path.resolve(process.env.SCRAPER_SQLITE_PATH)
    : path.resolve(__dirname, '../../events.db');

interface Row { url: string; hostName: string | null; time: string; title: string; }

/** HH:MM ur ?startTime=-query. */
function timeFromUrl(url: string): { h: number; m: number } | null {
    const m = url.match(/[?&]startTime=(\d{1,2})[:.](\d{2})/);
    if (!m) return null;
    const h = parseInt(m[1], 10), min = parseInt(m[2], 10);
    return (h <= 23 && min <= 59) ? { h, m: min } : null;
}

/** Renderar sidan och letar fristående HH:MM (samma som sitemap-fixen). */
async function timeFromPage(browser: Browser, url: string): Promise<{ h: number; m: number } | null> {
    const page = await browser.newPage();
    try {
        await page.setUserAgent('Mozilla/5.0 (Macintosh) Chrome/124.0.0.0 Safari/537.36');
        await page.setRequestInterception(true);
        page.on('request', r => (['image', 'font', 'media'].includes(r.resourceType()) ? r.abort() : r.continue()));
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 25000 });
        await new Promise(r => setTimeout(r, 1500));
        return await page.evaluate(() => {
            const cands: string[] = [];
            document.querySelectorAll('time[datetime]').forEach(t => { const v = t.getAttribute('datetime'); if (v) cands.push(v); });
            document.querySelectorAll('time').forEach(t => { const v = (t.textContent || '').trim(); if (v) cands.push(v); });
            const info = (document.querySelector('.event-info, .event-date-time, .event-time, .datum, .tid, .klockslag') as HTMLElement)?.innerText || '';
            const km = info.match(/kl[.\s]*(\d{1,2})[:.](\d{2})/i);
            if (km) cands.push(`${km[1]}:${km[2]}`);
            for (const c of cands) {
                const m = c.match(/^(\d{1,2})[:.](\d{2})$/);
                if (m) { const h = +m[1], mm = +m[2]; if (h <= 23 && mm <= 59) return { h, m: mm }; }
            }
            return null;
        });
    } catch {
        return null;
    } finally {
        await page.close();
    }
}

/** Behåller datumet, sätter lokal tid → ISO (matchar scraperns format). */
function withTime(oldIso: string, h: number, m: number): string {
    const o = new Date(oldIso);
    // LOKALA datum-komponenter: en date-only "11 juni" parsad som lokal midnatt
    // lagras som 22:00Z DAGEN INNAN — getUTCDate() ger då fel dag. getDate()
    // (lokal) ger rätt avsedd dag för både 00:00- och 22:00/23:00-fallen.
    return new Date(o.getFullYear(), o.getMonth(), o.getDate(), h, m, 0, 0).toISOString();
}

async function main() {
    const db = new Database(DB_PATH);
    db.pragma('busy_timeout = 8000');
    const rows = db.prepare<[], Row>(`
        SELECT url, hostName, time, title FROM link_events
        WHERE time >= datetime('now')
          AND strftime('%H:%M', time) IN ('00:00', '22:00', '23:00')
        ORDER BY hostName, time
        LIMIT ${LIMIT}
    `).all();

    console.log(`\n🔧 ${DRY_RUN ? '[DRY-RUN] ' : ''}Backfill av ${rows.length} events på 00:00/22:00/23:00 (lokal midnatt)\n`);
    const updateStmt = db.prepare('UPDATE link_events SET time = ?, updatedAt = ? WHERE url = ?');

    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
    const stats = { fromUrl: 0, fromPage: 0, noTime: 0, done: 0 };
    const perHostNoTime: Record<string, number> = {};
    const CONCURRENCY = 6;
    let next = 0;

    // Säkerhet: vi sätter ALDRIG en påhittad tid — bara om URL/sida bekräftar
    // ett konkret HH:MM. Events utan bekräftad tid lämnas orörda (genuint tidlösa).
    async function worker() {
        while (true) {
            const i = next++;
            if (i >= rows.length) break;
            const r = rows[i];
            const tag = (r.hostName || '?').slice(0, 16).padEnd(16);
            let t = timeFromUrl(r.url);
            let via = 'url';
            if (!t) { t = await timeFromPage(browser, r.url); via = 'sida'; }
            stats.done++;
            const prog = `[${String(stats.done).padStart(4)}/${rows.length}]`;

            if (!t) {
                stats.noTime++;
                perHostNoTime[r.hostName || '?'] = (perHostNoTime[r.hostName || '?'] ?? 0) + 1;
                if (stats.done % 25 === 0) console.log(`${prog} … ${stats.fromUrl + stats.fromPage} fixade hittills`);
                continue;
            }
            const newIso = withTime(r.time, t.h, t.m);
            const newHM = `${String(t.h).padStart(2, '0')}:${String(t.m).padStart(2, '0')}`;
            if (via === 'url') stats.fromUrl++; else stats.fromPage++;
            console.log(`${prog} ${tag} ✅ ${via.padEnd(4)} → ${newHM} | ${(r.title || '').slice(0, 36)}`);
            if (!DRY_RUN) updateStmt.run(newIso, new Date().toISOString(), r.url);
        }
    }

    try {
        await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
    } finally {
        await browser.close();
        db.close();
    }

    console.log('\n══════════════════════════════════════════');
    console.log(`  ✅ tid ur URL:   ${stats.fromUrl}`);
    console.log(`  ✅ tid ur sida:  ${stats.fromPage}`);
    console.log(`  ⏳ ingen tid:    ${stats.noTime}  (orörda — genuint tidlösa)`);
    const totalFixed = stats.fromUrl + stats.fromPage;
    console.log(`  ── totalt fixade: ${totalFixed} / ${rows.length}`);
    if (Object.keys(perHostNoTime).length) {
        console.log('\n  Källor utan återvinningsbar tid:');
        for (const [h, n] of Object.entries(perHostNoTime).sort((a, b) => b[1] - a[1])) {
            console.log(`    ${h.padEnd(22)} ${n}`);
        }
    }
    console.log('══════════════════════════════════════════\n');
    if (DRY_RUN) console.log('ℹ️  DRY-RUN: inga ändringar skrevs.\n');
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
