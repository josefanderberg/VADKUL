/**
 * Backfill bilder för befintliga events vars källa nu (efter children-attr-
 * fixet i json-ld.ts) kan extrahera bild men gamla rader saknar coverImage.
 *
 * Re-hämtar varje events detalj-sida, kör motorns JSON-LD-extraktion och
 * uppdaterar coverImage (+ ev. saknad description) i Firestore + SQLite.
 * Re-kör EJ hela scrapern (dedup hoppar kända URL:er) — detta är riktad fix.
 *
 *   npx ts-node src/scripts/backfill-goteborg-images.ts --host='Göteborg Kommun' --limit=5         # dry-run
 *   npx ts-node src/scripts/backfill-goteborg-images.ts --host='Göteborg Kommun' --apply
 */
import path from 'path';
import Database from 'better-sqlite3';
import { db } from '../config/firebase';
import { fetchWithRetry } from '../utils/fetchWithRetry';
import { domainLimiter } from '../sources/rateLimiter';
import { extractJsonLdBlocks, collectEvents, jsonLdToRawEvent, DEFAULT_EVENT_TYPES } from '../sources/engines/json-ld';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36';
const arg = (k: string, d?: string) => { const m = process.argv.find(a => a.startsWith(`--${k}=`)); return m ? m.split('=').slice(1).join('=') : d; };
const apply = process.argv.includes('--apply');
const host = arg('host', 'Göteborg Kommun')!;
const limit = parseInt(arg('limit', apply ? '1000' : '5')!, 10);

async function imageFor(url: string): Promise<string | null> {
    await domainLimiter.wait(url);
    try {
        const res = await fetchWithRetry(url, { headers: { 'User-Agent': UA } });
        if (!res.ok) return null;
        const html = await res.text();
        const nodes: any[] = [];
        for (const b of extractJsonLdBlocks(html)) collectEvents(b, DEFAULT_EVENT_TYPES, nodes);
        for (const n of nodes) {
            const raw = jsonLdToRawEvent(n, url);
            if (raw?.imageUrl) return raw.imageUrl;
        }
    } catch { /* hoppa */ }
    return null;
}

async function main() {
    const sqlite = new Database(path.resolve(__dirname, '../../events.db'));
    const rows = sqlite.prepare(`
        SELECT url, firestoreId FROM link_events
        WHERE hostName = ? AND hidden = 0 AND (coverImage IS NULL OR length(coverImage) < 10)
        LIMIT ?
    `).all(host, limit) as { url: string; firestoreId: string | null }[];

    console.log(`${apply ? '🔧 APPLY' : '🔍 DRY-RUN'} — ${host}: ${rows.length} events utan bild (limit ${limit})`);

    let found = 0, updated = 0;
    const stmt = sqlite.prepare(`UPDATE link_events SET coverImage = ? WHERE url = ?`);
    for (const r of rows) {
        const img = await imageFor(r.url);
        if (!img) { console.log(`   ✗ ingen bild: ${r.url.slice(-50)}`); continue; }
        found++;
        console.log(`   ✓ ${img.slice(0, 70)}  ← ${r.url.slice(-45)}`);
        if (apply) {
            stmt.run(img, r.url);
            if (db && r.firestoreId) {
                try { await db.collection('linkEvents').doc(r.firestoreId).update({ coverImage: img }); updated++; }
                catch (e: any) { if (!(e.code === 5 || /NOT_FOUND/.test(e.message ?? ''))) throw e; }
            }
        }
    }
    sqlite.close();
    console.log(`\n${found}/${rows.length} fick bild${apply ? ` — ${updated} uppdaterade i Firestore + SQLite` : ' (dry-run, inget sparat)'}`);
    process.exit(0);
}
main().catch((e) => { console.error('Fatal:', e); process.exit(1); });
