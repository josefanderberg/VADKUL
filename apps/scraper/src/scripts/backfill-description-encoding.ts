/**
 * backfill-description-encoding.ts — reparera trasig teckenkodning i
 * beskrivningar/titlar (rapporterat 2026-07-09).
 *
 * TVÅ skador med olika bot:
 *
 *   FEL A — råa HTML-entiteter i texten ("h&auml;r f&ouml;r p&aring;"):
 *   engines strippade taggar utan att avkoda. Boten är förlustfri: texten
 *   finns kvar kodad → avkoda på plats med decodeHtmlEntities. (~600 rader)
 *
 *   FEL B — å/ä/ö BORTA, ersatta med mellanslag ("K RLEK", "Sk rg rdsvallen"):
 *   gamla cleanDescription ersatte ALLA entiteter med mellanslag. Tecknen är
 *   förlorade i DB:n och kan inte återskapas lokalt → --refetch hämtar om
 *   beskrivningen från källsidans og:description/meta-description och skriver
 *   bara över när den nya texten faktiskt innehåller å/ä/ö. (~1000 rader)
 *
 * Båda felen är fixade i pipelinen (utils/text.ts decodeHtmlEntities) så NYA
 * event blir rätt; det här skriptet lagar de befintliga. Rör bara SQLite —
 * webben läser beskrivningar ur aggregat-lagren, så kör aggregate-events
 * efteråt. (Firestore linkEvents bär inte description för skrapade event.)
 *
 * Användning:
 *   npx ts-node src/scripts/backfill-description-encoding.ts               # dry-run
 *   npx ts-node src/scripts/backfill-description-encoding.ts --apply       # FEL A
 *   npx ts-node src/scripts/backfill-description-encoding.ts --apply --refetch  # + FEL B
 */

import { sqlite } from '../utils/sqliteHelper';
import { cleanDescription, decodeHtmlEntities } from '../utils/text';

const APPLY = process.argv.includes('--apply');
const REFETCH = process.argv.includes('--refetch');

const UA = 'Mozilla/5.0 (Macintosh) Chrome/124.0.0.0 Safari/537.36';
const REFETCH_CONCURRENCY = 8;

interface Row { url: string; title: string | null; description: string | null }

// FEL A: en riktig entitet i texten (namngiven eller numerisk).
const ENTITY_RE = /&(?:[a-zA-Z]{2,10}|#\d{2,7}|#x[0-9a-fA-F]{2,6});/;

// FEL B-heuristik: vanliga svenska ord där å/ä/ö blivit mellanslag. Medvetet
// snäv — hellre missa några än att omhämta i onödan. Kombineras med kravet
// att texten HELT saknar å/ä/ö (en strippad text har aldrig några kvar).
const STRIPPED_RE = /\b(?:f r|h r|d r|n r|ocks|g r|st r|b rjar|v lkom|k rlek|gl dje|s song|tr ff|bes k|f rs |m nad|kv ll|l rdag|s ndag|h ll)\b/i;
const HAS_SWEDISH = /[åäöÅÄÖ]/;

function isStripped(text: string): boolean {
    return !HAS_SWEDISH.test(text) && STRIPPED_RE.test(text);
}

/** og:description / twitter:description / meta description ur en HTML-sida. */
function extractMetaDescription(html: string): string | undefined {
    for (const key of ['og:description', 'twitter:description', 'description']) {
        const esc = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const m = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${esc}["'][^>]+content=["']([^"']*)["']`, 'i'))
            || html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${esc}["']`, 'i'));
        if (m && m[1].trim().length >= 30) {
            return decodeHtmlEntities(m[1]).replace(/\s+/g, ' ').trim().slice(0, 500);
        }
    }
    return undefined;
}

async function refetchDescription(url: string): Promise<string | undefined> {
    try {
        const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15_000), redirect: 'follow' });
        if (!res.ok) return undefined;
        const html = await res.text();
        return extractMetaDescription(html);
    } catch {
        return undefined;
    }
}

async function main() {
    // Bara framtida event — passerade rader syns aldrig mer på webben.
    const rows = sqlite.prepare(
        `SELECT url, title, description FROM link_events
         WHERE time >= datetime('now') AND hidden = 0`,
    ).all() as Row[];
    console.log(`${rows.length} framtida synliga event i DB:n`);

    const updTitle = sqlite.prepare('UPDATE link_events SET title = ?, updatedAt = ? WHERE url = ?');
    const updDesc = sqlite.prepare('UPDATE link_events SET description = ?, updatedAt = ? WHERE url = ?');
    const now = new Date().toISOString();

    // ── FEL A: avkoda entiteter på plats (förlustfritt) ──────────────────────
    let aDesc = 0, aTitle = 0;
    for (const r of rows) {
        if (r.description && ENTITY_RE.test(r.description)) {
            const fixed = decodeHtmlEntities(r.description).replace(/\s+/g, ' ').trim();
            if (fixed !== r.description) {
                aDesc++;
                if (aDesc <= 3) console.log(`  A desc: "${r.description.slice(0, 60)}" → "${fixed.slice(0, 60)}"`);
                if (APPLY) updDesc.run(fixed, now, r.url);
            }
        }
        if (r.title && ENTITY_RE.test(r.title)) {
            const fixed = decodeHtmlEntities(r.title).replace(/\s+/g, ' ').trim();
            if (fixed !== r.title) {
                aTitle++;
                if (aTitle <= 3) console.log(`  A title: "${r.title}" → "${fixed}"`);
                if (APPLY) updTitle.run(fixed, now, r.url);
            }
        }
    }
    console.log(`FEL A: ${aDesc} beskrivningar + ${aTitle} titlar ${APPLY ? 'avkodade' : 'skulle avkodas (dry-run)'}`);

    // ── FEL C: råa HTML-taggar i texten ("<p>Core med boll...") ──────────────
    // korpen/zoezi m.fl. sparade rå HTML före scraper-fixen 2026-07-25.
    // Förlustfritt: cleanDescription strippar taggar + avkodar entiteter.
    const TAG_RE = /<\/?(?:p|br|div|span|b|i|strong|em|li|ul|ol|h[1-6]|a)\b[^>]*>/i;
    let cDesc = 0;
    for (const r of rows) {
        if (r.description && TAG_RE.test(r.description)) {
            const fixed = cleanDescription(r.description);
            if (fixed && fixed !== r.description) {
                cDesc++;
                if (cDesc <= 3) console.log(`  C desc: "${r.description.slice(0, 60)}" → "${fixed.slice(0, 60)}"`);
                if (APPLY) updDesc.run(fixed, now, r.url);
            }
        }
    }
    console.log(`FEL C: ${cDesc} beskrivningar med rå HTML ${APPLY ? 'rensade' : 'skulle rensas (dry-run)'}`);

    // ── FEL B: omhämta strippade beskrivningar från källan ───────────────────
    const stripped = rows.filter(r => r.description && isStripped(r.description) && /^https?:\/\//.test(r.url));
    console.log(`FEL B: ${stripped.length} beskrivningar ser strippade ut (å/ä/ö saknas helt)`);
    if (REFETCH && stripped.length) {
        let fixed = 0, failed = 0, inflight = 0, i = 0;
        await new Promise<void>((resolve) => {
            const next = () => {
                if (i >= stripped.length && inflight === 0) return resolve();
                while (inflight < REFETCH_CONCURRENCY && i < stripped.length) {
                    const r = stripped[i++];
                    inflight++;
                    refetchDescription(r.url).then((fresh) => {
                        // Skriv bara över när den nya texten BEVISLIGEN är bättre:
                        // innehåller svenska tecken som den gamla saknade.
                        if (fresh && HAS_SWEDISH.test(fresh)) {
                            fixed++;
                            if (fixed <= 3) console.log(`  B: "${r.description!.slice(0, 50)}" → "${fresh.slice(0, 50)}"`);
                            if (APPLY) updDesc.run(fresh, now, r.url);
                        } else {
                            failed++;
                        }
                    }).finally(() => { inflight--; next(); });
                }
            };
            next();
        });
        console.log(`FEL B: ${fixed} omhämtade och ${APPLY ? 'uppdaterade' : 'skulle uppdateras (dry-run)'}, ${failed} gick inte att förbättra`);
    } else if (stripped.length) {
        console.log('  (kör med --refetch för att omhämta dem från källsidorna)');
    }

    if (!APPLY) console.log('\nDry-run — inget skrivet. Kör med --apply för att applicera.');
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
