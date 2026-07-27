/**
 * repair-stripped-descriptions.ts — laga FEL B-beskrivningar (å/ä/ö blev
 * mellanslag av gamla cleanDescription, före fixen 2026-07-09) genom att
 * hämta om texten via KÄLLORNAS EGNA API:er.
 *
 * Bakgrund: backfill-description-encoding --refetch lagar via og:description,
 * men clubrunner/nortic/hembygd/rodakorset saknar användbar meta-desc
 * (9/294 lagade 2026-07-25). De här källorna är rena API-källor — deras
 * engines levererar färsk, numera korrekt avkodad, beskrivning per URL.
 *
 * Skriver ENDAST över rader som ser strippade ut (saknar å/ä/ö helt + träffar
 * ord-heuristiken) och där den färska texten bevisligen innehåller å/ä/ö.
 * Rör bara SQLite — kör aggregate-events efteråt så webben ser lagningen.
 *
 * Användning:
 *   npx ts-node src/scripts/repair-stripped-descriptions.ts           # dry-run
 *   npx ts-node src/scripts/repair-stripped-descriptions.ts --apply
 */

import { sqlite } from '../utils/sqliteHelper';
import { SOURCES, ENGINES } from '../sources';
import { EngineContext } from '../sources/types';

const APPLY = process.argv.includes('--apply');

// Bredare än backfill-description-encoding.ts (FEL B): kravet "HELT utan
// å/ä/ö" missar rader med BLANDAD skada (hembygd/nortic hade delvis literala
// åäö, delvis blankade entiteter). Unicode-lookarounds i stället för \b —
// ASCII-\b matchar annars "ocks" inuti "också". Ofarligt att vara bred här:
// vi skriver ändå bara över när källans färska text innehåller å/ä/ö.
const SPACE_HOLE_RE = new RegExp(
    '(?<!\\p{L})(?:' +
    'v lkom(?:men|na)?|sj lv|f rest llning|f rel sning|b rjar|l rdag|s ndag' +
    '|m nga|g rna|kv ll|tr dg rd|ppettider|anm l(?:an)?|f rs ljning|h lsningar' +
    '|h ller|fr n|ber ttar|m nniska|f redrag|bes k|k rlek|s song|gl dje|tr ff|m nad' +
    ')(?!\\p{L})', 'iu');
const HAS_SWEDISH = /[åäöÅÄÖ]/;
const isStripped = (t: string) => SPACE_HOLE_RE.test(t);

// Domän → engine för källfamiljerna som drabbades av 2026-07-09-buggen och
// vars sidor saknar og:description att refetcha ifrån.
const DOMAIN_ENGINES: Array<{ match: (host: string) => boolean; engineId: string }> = [
    { match: (h) => h.endsWith('clubrunner.ca'), engineId: 'rotary' },
    { match: (h) => h.endsWith('nortic.se'), engineId: 'nortic' },
    { match: (h) => h.endsWith('hembygd.se'), engineId: 'hembygd' },
    { match: (h) => h.endsWith('rodakorset.se'), engineId: 'rodakorset' },
];

interface Row { url: string; description: string | null }

async function main() {
    const rows = sqlite.prepare(
        `SELECT url, description FROM link_events
         WHERE time >= datetime('now') AND hidden = 0`,
    ).all() as Row[];
    const broken = rows.filter((r) => r.description && isStripped(r.description));

    const perEngine = new Map<string, Set<string>>();
    let uncovered = 0;
    for (const r of broken) {
        let host = '';
        try { host = new URL(r.url).hostname; } catch { uncovered++; continue; }
        const m = DOMAIN_ENGINES.find((d) => d.match(host));
        if (m) {
            if (!perEngine.has(m.engineId)) perEngine.set(m.engineId, new Set());
            perEngine.get(m.engineId)!.add(r.url);
        } else {
            uncovered++;
        }
    }
    console.log(`${broken.length} strippade beskrivningar i DB:n`);
    console.log(`Täcks av API-omhämtning: ${[...perEngine.entries()].map(([k, v]) => `${k}=${v.size}`).join(', ') || 'inga'}`);
    console.log(`Utanför de fyra källfamiljerna: ${uncovered} (åldras ut med eventen)`);

    const updDesc = sqlite.prepare('UPDATE link_events SET description = ?, updatedAt = ? WHERE url = ?');
    const now = new Date().toISOString();
    let totalFixed = 0;

    for (const [engineId, urls] of perEngine) {
        const engine = ENGINES[engineId];
        const engineSources = SOURCES.filter((s) => s.engine === engineId);
        if (!engine || !engineSources.length) {
            console.log(`⚠️ ${engineId}: ingen engine/källa i registret — hoppar över`);
            continue;
        }
        for (const source of engineSources) {
            const ctx: EngineContext = {
                windowStart: new Date(),
                windowEnd: new Date(Date.now() + 365 * 24 * 3600 * 1000),
                log: (m) => console.log(`  [${source.id}] ${m}`),
                // Kostnadsoptimering åt andra hållet: dyra per-event-hämtningar
                // (rodakorset content-API) görs BARA för de trasiga URL:erna.
                isKnownUrl: async (url) => !urls.has(url),
                refreshKnown: false,
            };
            let events;
            try {
                events = await engine(source.config, ctx);
            } catch (e) {
                console.log(`⚠️ [${source.id}] engine kastade: ${(e as Error).message}`);
                continue;
            }
            let fixed = 0, still = 0;
            for (const ev of events) {
                if (!urls.has(ev.url)) continue;
                const fresh = (ev.description || '').trim();
                if (fresh && HAS_SWEDISH.test(fresh)) {
                    fixed++;
                    if (fixed <= 2) console.log(`  ✔ "${fresh.slice(0, 60)}" ← ${ev.url}`);
                    if (APPLY) updDesc.run(fresh, now, ev.url);
                } else {
                    still++;
                }
            }
            totalFixed += fixed;
            console.log(`  [${source.id}] ${fixed} ${APPLY ? 'uppdaterade' : 'skulle uppdateras (dry-run)'}${still ? `, ${still} fortfarande utan å/ä/ö i källan` : ''}`);
        }
    }

    console.log(`\nTotalt: ${totalFixed} beskrivningar ${APPLY ? 'lagade' : 'skulle lagas'} av ${broken.length} strippade.`);
    if (!APPLY) console.log('Dry-run — inget skrivet. Kör med --apply.');
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
