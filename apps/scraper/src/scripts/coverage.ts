/**
 * Kommun-täckningsrapport.
 *
 * Visar:
 *   - Vilka av 290 svenska kommuner vi täcker (per län)
 *   - Vilken engine som driver varje täckt kommun
 *   - Senaste lyckade körning (från scrape_runs)
 *   - Antal aktiva events per kommun
 *   - Identifierar kommuner vi INTE har källa för
 *
 * Användning:
 *   npm run coverage                   # tabell
 *   npm run coverage -- --uncovered    # bara icke-täckta
 *   npm run coverage -- --broken       # bara trasiga (har source men 0 events)
 *   npm run coverage -- --json         # för dashboards
 */

import path from 'path';
import Database from 'better-sqlite3';
import { SOURCES } from '../sources/registry';
import { KOMMUNER } from '../sources/data/kommuner';
import '../utils/sqliteHelper'; // skapar scrape_runs

const args = (() => {
    const out: any = {};
    for (const a of process.argv.slice(2)) {
        if (a === '--uncovered') out.uncovered = true;
        if (a === '--broken') out.broken = true;
        if (a === '--json') out.json = true;
    }
    return out;
})();

interface KommunStatus {
    name: string;
    domain: string;
    region: string;
    covered: boolean;
    sourceId?: string;
    engine?: string;
    disabled?: boolean;
    lastRun?: string;
    lastSaved?: number;
    activeEvents: number;
    status: '🟢' | '🟡' | '🔴' | '⚪';
}

function slugify(s: string): string {
    return s.toLowerCase().replace(/å/g, 'a').replace(/ä/g, 'a').replace(/ö/g, 'o')
        .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function main() {
    const db = new Database(path.resolve(__dirname, '../../events.db'), { readonly: true });

    // Bygg index: kommun-namn → source
    const sourcesByKommun = new Map<string, typeof SOURCES[number]>();
    for (const s of SOURCES) {
        const key = slugify(s.region || s.hostName);
        sourcesByKommun.set(key, s);
        // Också matcha kommun-namnet i hostName
        const hostKey = slugify(s.hostName.replace(/s? Kommun$|s? Stad$|^Visit |^Destination /i, ''));
        sourcesByKommun.set(hostKey, s);
    }

    const results: KommunStatus[] = [];

    for (const k of KOMMUNER) {
        const key = slugify(k.name);
        const src = sourcesByKommun.get(key);

        // Räkna aktiva events från denna kommun (via hostName eller locationName)
        const possibleHosts = [
            `${k.name} Kommun`,
            `${k.name}s Kommun`,
            `${k.name} Stad`,
            `${k.name}s Stad`,
            `Visit ${k.name}`,
            `Destination ${k.name}`,
            k.name,
        ];
        const eventCount = (db.prepare(`
            SELECT COUNT(*) AS n FROM link_events
            WHERE hidden = 0
              AND datetime(time) >= datetime('now')
              AND (hostName IN (${possibleHosts.map(() => '?').join(',')})
                   OR locationName LIKE '%' || ? || '%')
        `).get(...possibleHosts, k.name) as any).n;

        // Senaste körning
        let lastRun: string | undefined;
        let lastSaved: number | undefined;
        if (src) {
            const r = db.prepare(`
                SELECT started_at, saved FROM scrape_runs
                WHERE source_id = ?
                ORDER BY started_at DESC LIMIT 1
            `).get(src.id) as any;
            if (r) {
                lastRun = r.started_at;
                lastSaved = r.saved;
            }
        }

        // Status-emoji
        let status: KommunStatus['status'] = '⚪';
        if (!src) status = '⚪'; // Ej täckt
        else if (src.disabled) status = '🔴';
        else if (eventCount === 0) status = '🟡';
        else if (eventCount > 0) status = '🟢';

        results.push({
            name: k.name,
            domain: k.domain,
            region: k.region || '?',
            covered: !!src,
            sourceId: src?.id,
            engine: src?.engine,
            disabled: src?.disabled,
            lastRun,
            lastSaved,
            activeEvents: eventCount,
            status,
        });
    }

    db.close();

    if (args.json) {
        console.log(JSON.stringify(results, null, 2));
        process.exit(0);
    }

    // Filtrera
    let filtered = results;
    if (args.uncovered) filtered = results.filter(r => !r.covered);
    if (args.broken) filtered = results.filter(r => r.covered && r.activeEvents === 0);

    // Gruppera per län
    const byRegion: Record<string, KommunStatus[]> = {};
    for (const r of filtered) {
        const reg = r.region;
        if (!byRegion[reg]) byRegion[reg] = [];
        byRegion[reg].push(r);
    }

    // Totals
    const total = results.length;
    const covered = results.filter(r => r.covered && !r.disabled).length;
    const broken  = results.filter(r => r.covered && r.activeEvents === 0).length;
    const stable  = results.filter(r => r.activeEvents > 0).length;
    const uncovered = results.filter(r => !r.covered).length;

    console.log(`\nKommun-täckning (${total} kommuner totalt)\n`);
    console.log(`  🟢 STABLE (har events)         ${stable}`);
    console.log(`  🟡 INACTIVE (källa, 0 events)  ${broken}`);
    console.log(`  🔴 DISABLED                    ${results.filter(r => r.disabled).length}`);
    console.log(`  ⚪ INGEN KÄLLA                  ${uncovered}`);
    console.log(`\nTäckning: ${covered}/${total} = ${Math.round(100 * covered / total)}%\n`);

    // Skriv ut per län
    const regionNames: Record<string, string> = {
        stockholm: 'Stockholms län', uppsala: 'Uppsala län', sodermanland: 'Södermanlands län',
        ostergotland: 'Östergötlands län', jonkoping: 'Jönköpings län', kronoberg: 'Kronobergs län',
        kalmar: 'Kalmar län', gotland: 'Gotlands län', blekinge: 'Blekinge län',
        skane: 'Skåne län', halland: 'Hallands län', vastragotaland: 'Västra Götalands län',
        varmland: 'Värmlands län', orebro: 'Örebro län', vastmanland: 'Västmanlands län',
        dalarna: 'Dalarnas län', gavleborg: 'Gävleborgs län', vasternorrland: 'Västernorrlands län',
        jamtland: 'Jämtlands län', vasterbotten: 'Västerbottens län', norrbotten: 'Norrbottens län',
    };

    for (const reg of Object.keys(byRegion).sort()) {
        const items = byRegion[reg];
        const regName = regionNames[reg] || reg;
        const coveredHere = items.filter(r => r.covered).length;
        console.log(`── ${regName} (${coveredHere}/${items.length})`);
        for (const r of items) {
            const events = r.activeEvents > 0 ? String(r.activeEvents).padStart(4) : '   -';
            const engine = (r.engine || '').padEnd(13);
            const lastRun = r.lastRun ? r.lastRun.slice(5, 16).replace('T', ' ') : '           -';
            console.log(`  ${r.status}  ${r.name.padEnd(20)} ${events}  ${engine}  last ${lastRun}`);
        }
        console.log('');
    }

    if (uncovered > 0 && !args.uncovered) {
        console.log(`Använd "--uncovered" för att se de ${uncovered} kommuner vi inte har källa för.`);
        console.log(`Använd "npm run probe-sitevision" eller "npm run probe-wp" för att leta efter nya källor.\n`);
    }

    process.exit(0);
}

main();
