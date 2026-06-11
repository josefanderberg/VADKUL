/**
 * Audit: re-fetcha event-permalinks och jämför datum med stored time.
 *
 * För källor där description är tom kan vår parser inte verifiera datumet
 * lokalt. Det här skriptet hämtar varje events permalink och söker efter
 * svenska datum i HTML:n. Om hittat datum skiljer sig markant från stored
 * → flagga.
 *
 * Användning:
 *   npx ts-node src/scripts/audit-detail-pages.ts                  # alla källor, max 5 per
 *   npx ts-node src/scripts/audit-detail-pages.ts --sample=10
 *   npx ts-node src/scripts/audit-detail-pages.ts --host=Eslöv
 */

import path from 'path';
import Database from 'better-sqlite3';
import { findFirstDateInText } from '../utils/swedishDate';
import { SOURCES } from '../sources/registry';

const args = (() => {
    const out: any = { sample: 5 };
    for (const a of process.argv.slice(2)) {
        const m = a.match(/^--([^=]+)=(.+)$/);
        if (!m) continue;
        if (m[1] === 'sample') out.sample = parseInt(m[2], 10);
        else out[m[1]] = m[2];
    }
    return out;
})();

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124.0.0.0';

interface Row { url: string; title: string; time: string; description: string|null; hostName: string }

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
    const db = new Database(path.resolve(__dirname, '../../events.db'), { readonly: true });
    const hostFilter = args.host?.toLowerCase();
    const sampleSize = args.sample;
    const targetHosts = SOURCES.map((s) => s.hostName)
        .filter((h) => !hostFilter || h.toLowerCase().includes(hostFilter));

    console.log(`Auditing ${targetHosts.length} hostnames, sample=${sampleSize} per host\n`);

    type Result = { host: string; title: string; stored: string; found: string|null; diffDays: number|null; url: string };
    const results: Result[] = [];

    for (const host of targetHosts) {
        const rows = db.prepare(`
            SELECT url, title, time, description, hostName FROM link_events
            WHERE hostName = ? AND time > datetime('now', '-1 days')
            ORDER BY RANDOM() LIMIT ?
        `).all(host, sampleSize) as Row[];
        if (rows.length === 0) { console.log(`○  ${host} — 0 rader`); continue; }

        console.log(`\n=== ${host} (${rows.length} samples) ===`);
        for (const r of rows) {
            const html = await fetchHtml(r.url);
            if (!html) {
                console.log(`  ⚠️  ${r.title.slice(0, 50)}  | fetch failed`);
                continue;
            }
            const found = findFirstDateInText(html);
            const stored = new Date(r.time);
            // Jämför lokal-datum (svenska eventsidor är i CEST/CET)
            const fmt = (d: Date) => d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' });
            const storedStr = fmt(stored);
            if (!found) {
                console.log(`  ?   ${r.title.slice(0, 50)}  | stored=${storedStr} found=NONE`);
                results.push({ host, title: r.title, stored: storedStr, found: null, diffDays: null, url: r.url });
                continue;
            }
            const foundStr = fmt(found);
            // Räkna dag-diff baserat på lokal-datum, inte UTC-millis
            const storedDay = new Date(storedStr + 'T00:00:00');
            const foundDay = new Date(foundStr + 'T00:00:00');
            const diffDays = Math.round((foundDay.getTime() - storedDay.getTime()) / 86400000);
            const flag = Math.abs(diffDays) >= 1 ? '⚠️ ' : '✅ ';
            console.log(`  ${flag}stored=${storedStr} found=${foundStr} Δ${diffDays}d | ${r.title.slice(0, 60)}`);
            results.push({ host, title: r.title, stored: storedStr, found: foundStr, diffDays, url: r.url });
            // Vänta lite för att inte hamra sajter
            await new Promise((r) => setTimeout(r, 500));
        }
    }

    const wrong = results.filter((r) => r.diffDays !== null && Math.abs(r.diffDays) >= 1);
    const unknown = results.filter((r) => r.found === null);
    console.log(`\n=== Sammanfattning ===`);
    console.log(`Sampled: ${results.length}`);
    console.log(`Mismatches (≥1 dag): ${wrong.length}`);
    console.log(`Inget datum funnet i HTML: ${unknown.length}`);

    if (wrong.length > 0) {
        console.log(`\n=== Mismatch-detaljer ===`);
        for (const m of wrong.sort((a, b) => Math.abs(b.diffDays!) - Math.abs(a.diffDays!))) {
            console.log(`  [${m.host}] stored=${m.stored} found=${m.found} Δ${m.diffDays}d | ${m.title.slice(0, 60)}`);
            console.log(`    ${m.url}`);
        }
    }
    process.exit(0);
}

main().catch((e) => { console.error('Fatal:', e); process.exit(1); });
