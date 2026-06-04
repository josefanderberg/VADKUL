/**
 * Audit: jämför stored `time` mot datum funna i `title` + `description`.
 *
 * Om svensk datumtolkare hittar ett datum i fritext som skiljer sig från
 * stored time med >24h flaggar vi raden. Hjälper hitta events där vår
 * extraktion gissade fel datum från första-datumet-i-HTML.
 *
 * Användning:
 *   npx ts-node src/scripts/audit-event-dates.ts
 *   npx ts-node src/scripts/audit-event-dates.ts --host=Helsingborg
 */

import path from 'path';
import Database from 'better-sqlite3';
import { findFirstDateInText } from '../utils/swedishDate';
import { SOURCES } from '../sources/registry';

const HOST_FILTER = (() => {
    const a = process.argv.find((x) => x.startsWith('--host='));
    return a ? a.slice(7).toLowerCase() : null;
})();

const SOURCE_HOSTS = SOURCES.map((s) => s.hostName);

const db = new Database(path.resolve(__dirname, '../../events.db'), { readonly: true });

interface Row {
    url: string;
    title: string;
    time: string;
    description: string | null;
    hostName: string;
}

const rows: Row[] = db.prepare(`
    SELECT url, title, time, description, hostName
    FROM link_events
    WHERE hostName IN (${SOURCE_HOSTS.map(() => '?').join(',')})
    ORDER BY hostName, time
`).all(...SOURCE_HOSTS) as Row[];

console.log(`Auditing ${rows.length} events från ${SOURCE_HOSTS.length} hostnames\n`);

type Mismatch = {
    host: string;
    title: string;
    stored: string;
    found: string;
    diffDays: number;
    url: string;
};
const mismatches: Mismatch[] = [];
const perHost: Record<string, { checked: number; mismatched: number; noDateInText: number }> = {};

for (const r of rows) {
    if (HOST_FILTER && !r.hostName.toLowerCase().includes(HOST_FILTER)) continue;

    perHost[r.hostName] ??= { checked: 0, mismatched: 0, noDateInText: 0 };
    perHost[r.hostName].checked++;

    const haystack = `${r.title || ''} ${r.description || ''}`;
    const foundDate = findFirstDateInText(haystack);
    if (!foundDate) {
        perHost[r.hostName].noDateInText++;
        continue;
    }
    const storedDate = new Date(r.time);
    const diffMs = Math.abs(foundDate.getTime() - storedDate.getTime());
    const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000));

    if (diffDays >= 1) {
        perHost[r.hostName].mismatched++;
        mismatches.push({
            host: r.hostName,
            title: r.title,
            stored: r.time.slice(0, 10),
            found: foundDate.toISOString().slice(0, 10),
            diffDays,
            url: r.url,
        });
    }
}

console.log('=== Per host ===');
for (const [host, s] of Object.entries(perHost)) {
    const flag = s.mismatched > 0 ? '⚠️ ' : '   ';
    console.log(`${flag}${host.padEnd(28)} checked=${String(s.checked).padStart(4)}  mismatch=${String(s.mismatched).padStart(3)}  noDateInText=${String(s.noDateInText).padStart(3)}`);
}

if (mismatches.length > 0) {
    console.log(`\n=== Mismatch-detaljer (${mismatches.length} st) ===`);
    // Sortera efter störst avstånd först — de mest uppenbara felen
    mismatches.sort((a, b) => b.diffDays - a.diffDays);
    for (const m of mismatches.slice(0, 60)) {
        console.log(
            `  [${m.host.slice(0, 14).padEnd(14)}] stored=${m.stored} found=${m.found} Δ${m.diffDays}d ` +
            `| ${m.title.slice(0, 65)}`
        );
    }
    if (mismatches.length > 60) console.log(`  ... +${mismatches.length - 60} fler`);
}

console.log(`\nTOTAL: ${mismatches.length} potentiella fel av ${rows.length} events`);
process.exit(0);
