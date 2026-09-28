/**
 * Arrangörsregistret till studions Marknad-flik (2026-09-28).
 *
 *   npm run organizer-stats                  (nattkedjan, efter re-aggregate)
 *   npm run organizer-stats -- --utan-firestore   (bara grupperingen, 0 reads)
 *   npm run organizer-stats -- --bara=ABF      (skriver ut, rör inte filen)
 *
 * Läser spegeln (SQLite) och grupperar publicerade event per arrangör, se
 * utils/organizerStats.ts. Statistiken (views/clicks/likes i eventStats)
 * räknas med SUMMERINGSFRÅGOR - aldrig genom att läsa dokumenten:
 * `where eventId in [30 st]` + count()/sum(), en read per fråga (och per
 * påbörjade 1000 indexrader). Hela registret kostar därmed några tusen reads
 * per natt i stället för hela eventStats-kollektionen.
 *
 * Fönstret är spegelns: event från 30 dagar bak (prune-old) och framåt.
 * Studion sparar varje natts siffror, så trender och "sedan förra mejlet"
 * räknas där.
 *
 * Skriver apps/scraper/arrangorer-statistik.json (gitignorerad). Studion på
 * minin läser filen - samma maskin, inget går via git.
 */
import { AggregateField } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';
import { db } from '../config/firebase';
import { cityPoints } from '../utils/cityLookup';
import { mapPool } from '../utils/mapPool';
import { chunk, groupOrganizers, nearestPlace, Organizer, OrganizerEventRow } from '../utils/organizerStats';
import { sqlite } from '../utils/sqliteHelper';

const OUT = path.resolve(__dirname, '../../arrangorer-statistik.json');
const UTAN_FIRESTORE = process.argv.includes('--utan-firestore');
const BARA = process.argv.find(a => a.startsWith('--bara='))?.slice('--bara='.length).toLowerCase();

interface Stats { visningar: number; klick: number; gillningar: number }

let queries = 0;

// Ett sammansatt index per fält (eventId + views, eventId + clicks, eventId +
// likes; infra/firebase/firestore.indexes.json). Ett gemensamt index över
// alla tre går INTE: glesa index hoppar över dokument som saknar något av
// fälten, och ett event med visningar men inga klick skulle då försvinna ur
// summan. count() behöver inget index och sållar bort bitar utan statistik.
const FALT: [keyof Stats, string][] = [['visningar', 'views'], ['klick', 'clicks'], ['gillningar', 'likes']];

async function sumFor(urls: string[]): Promise<Stats> {
    const total: Stats = { visningar: 0, klick: 0, gillningar: 0 };
    for (const part of chunk(urls, 30)) {
        const q = db!.collection('eventStats').where('eventId', 'in', part);
        queries++;
        if ((await q.count().get()).data().count === 0) continue;
        for (const [nyckel, falt] of FALT) {
            queries++;
            const snap = await q.aggregate({ s: AggregateField.sum(falt) }).get();
            total[nyckel] += Math.max(0, Number(snap.data().s) || 0);
        }
    }
    return total;
}

/** En provfråga per fält: saknas ett index svarar Firestore FAILED_PRECONDITION (kod 9). */
async function indexenFinns(): Promise<boolean> {
    try {
        for (const [, falt] of FALT) {
            await db!.collection('eventStats').where('eventId', 'in', ['index-prov'])
                .aggregate({ s: AggregateField.sum(falt) }).get();
        }
        return true;
    } catch (e) {
        if ((e as { code?: number }).code === 9) return false;
        throw e;
    }
}

async function main() {
    const nowIso = new Date().toISOString();
    const rows = sqlite.prepare(`
        SELECT url, title, time, hostName, category, lat, lng
        FROM link_events
        WHERE hidden = 0 AND status = 'published' AND hostName IS NOT NULL AND hostName <> ''
    `).all() as OrganizerEventRow[];

    const places = cityPoints();
    const placeCache = new Map<string, string | null>();
    const placeOf = (lat: number | null, lng: number | null) => {
        if (lat == null || lng == null) return null;
        const k = `${lat.toFixed(2)},${lng.toFixed(2)}`;
        if (!placeCache.has(k)) placeCache.set(k, nearestPlace(places, lat, lng));
        return placeCache.get(k)!;
    };

    const orgs = groupOrganizers(rows, { nowIso, placeOf })
        .filter(o => !BARA || o.namn.toLowerCase().includes(BARA));
    console.log(`🏷️  ${orgs.length} arrangörer med minst 3 kommande event (av ${rows.length} event i spegeln)`);

    let utanStatistik = UTAN_FIRESTORE || !db;
    if (!UTAN_FIRESTORE && !db) console.warn('⚠️  Firestore är inte initierad - registret skrivs utan statistik.');
    if (!utanStatistik && !(await indexenFinns())) {
        console.warn('⚠️  Summeringsindexen för eventStats saknas - registret skrivs utan statistik.');
        console.warn('    Lägg ut dem: firebase deploy --only firestore:indexes (infra/firebase/firestore.indexes.json)');
        utanStatistik = true;
    }

    let withStats: (Omit<Organizer, 'urls'> & Stats)[];
    if (utanStatistik) {
        withStats = orgs.map(({ urls: _urls, ...o }) => ({ ...o, visningar: 0, klick: 0, gillningar: 0 }));
    } else {
        withStats = await mapPool(orgs, 8, async ({ urls, ...o }) => {
            try {
                return { ...o, ...(await sumFor(urls)) };
            } catch (e) {
                console.warn(`   ⚠️  ${o.namn}: statistiken gick inte att räkna (${(e as Error).message})`);
                return { ...o, visningar: 0, klick: 0, gillningar: 0 };
            }
        });
        console.log(`📈 ${queries} räkne-/summeringsfrågor mot eventStats (≈ ${queries} reads)`);
    }

    if (BARA) {
        for (const o of withStats) console.log(JSON.stringify(o, null, 2));
        return;
    }

    const payload = {
        genererad: nowIso,
        fonster: 'Event från de senaste 30 dagarna och alla kommande',
        medStatistik: !utanStatistik,
        arrangorer: withStats,
    };
    const tmp = `${OUT}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(payload));
    fs.renameSync(tmp, OUT); // atomiskt: studion läser aldrig en halvskriven fil
    const top = [...withStats].sort((a, b) => b.visningar - a.visningar).slice(0, 5);
    for (const o of top) console.log(`   ${o.namn} (${o.doman}): ${o.visningar} visningar, ${o.klick} klick, ${o.gillningar} gillningar`);
    console.log(`✅ ${path.relative(process.cwd(), OUT)} skriven`);
}

main().then(() => process.exit(0)).catch(e => {
    console.error('❌ organizer-stats misslyckades:', e);
    process.exit(1);
});
