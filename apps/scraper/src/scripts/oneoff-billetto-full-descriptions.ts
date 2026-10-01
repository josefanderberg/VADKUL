/**
 * oneoff-billetto-full-descriptions.ts — hela beskrivningen för KÄNDA kommande
 * Billetto-event som sparades med JSON-LD:ns kapade utdrag (1/10, Rydaholm:
 * "…massor av skra..."). Källan har numera detailDescSelector, men dess
 * refresh når bara sitemapens 400 senast ändrade URL:er (maxUrls) - 274 av
 * 443 kommande låg kvar kapade efter SCRAPE_FORCE_REFRESH-körningen.
 *
 * Samma regler som runnerns refresh: sidans .event-description →
 * normalizeDescription → pickBetterDescription (byter bara när den nya texten
 * bevisligen är bättre) → refreshEventContent (SQLite + Firestore via stamped).
 *
 *   npx ts-node src/scripts/oneoff-billetto-full-descriptions.ts            # dry, 10 st
 *   npx ts-node src/scripts/oneoff-billetto-full-descriptions.ts --commit   # alla
 */
import { sqlite } from '../utils/sqliteHelper';
import { refreshEventContent } from '../utils/dbHelper';
import { descFromDetailSelector } from '../sources/engines/sitemap';
import { normalizeDescription } from '../utils/normalizeEvent';
import { pickBetterDescription } from '../utils/contentRefresh';
import { mapPool } from '../utils/mapPool';

const COMMIT = process.argv.includes('--commit');
const SAMPLE = 10;
const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
    'Accept-Language': 'sv-SE,sv;q=0.9',
};

interface Row { url: string; title: string; description: string | null }

async function main(): Promise<void> {
    let rows = sqlite.prepare(`
        SELECT url, title, description FROM link_events
        WHERE url LIKE 'https://billetto.se/e/%' AND datetime(time) >= datetime('now')
          AND (hidden IS NULL OR hidden = 0)
          AND (rtrim(description) LIKE '%...' OR rtrim(description) LIKE '%…')
    `).all() as Row[];
    if (!COMMIT) rows = rows.slice(0, SAMPLE);
    console.log(`${COMMIT ? '🔧 COMMIT' : `🔍 DRY-RUN (${SAMPLE} första)`} — ${rows.length} kapade Billetto-beskrivningar`);

    let updated = 0, unchanged = 0, failed = 0;
    await mapPool(rows, 3, async (r) => {
        try {
            const res = await fetch(r.url, { headers: HEADERS });
            if (!res.ok) { failed++; return; }
            const raw = descFromDetailSelector(await res.text(), '.event-description');
            const fresh = raw ? normalizeDescription(raw) : '';
            const better = pickBetterDescription(r.description, fresh);
            if (!better) { unchanged++; return; }
            if (!COMMIT) {
                console.log(`  ${r.title.slice(0, 50)}: ${r.description?.length} → ${better.length} tecken`);
                updated++;
                return;
            }
            if (await refreshEventContent(r.url, { description: better })) updated++;
            else unchanged++;
        } catch {
            failed++;
        }
        await new Promise(res => setTimeout(res, 300));
    });
    console.log(`\nKlart: ${updated} ${COMMIT ? 'uppdaterade' : 'skulle uppdateras'}, ${unchanged} oförändrade, ${failed} misslyckade.`);
    process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
