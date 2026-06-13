/**
 * Cross-source-deduplication.
 *
 * Hittar events som scrapats från flera källor (FB + Eventim + kommunsajter)
 * och behåller bara den bästa kandidaten per (titel, datum, stad).
 *
 * Dedup-nyckel: normalized title + lokal-datum + stad
 *   → "Nationaldagsfirande" i Hörby vs Tranemo dedupas EJ (olika städer)
 *   → "Albert Lee i Umeå" på FB + Eventim dedupas (samma stad)
 *
 * Score per event (högt = behåll):
 *   +10  har bild (icke-tomt)
 *   +5   bild är i vår egen Storage (permanent)
 *   +5   description längre än 50 tecken
 *   +3   geokodad
 *   +2   isLocationVerified
 *   +1   hostName är ej Facebook (FB-events har ofta sämre titel/datum)
 *
 * Användning:
 *   npx ts-node src/scripts/dedupe-cross-source.ts            # dry-run
 *   npx ts-node src/scripts/dedupe-cross-source.ts --apply
 */

import path from 'path';
import Database from 'better-sqlite3';
import { db } from '../config/firebase';

const apply = process.argv.includes('--apply');

interface Row {
    url: string;
    title: string;
    time: string;
    locationName: string;
    coverImage: string | null;
    description: string | null;
    lat: number; lng: number;
    isLocationVerified: number;
    hostName: string;
    firestoreId: string;
}

export function normalizeTitle(s: string): string {
    return s.toLowerCase()
        .normalize('NFD')                          // splittra åäö → a + diacritic
        .replace(/[̀-ͯ]/g, '')           // ta bort diacritics (åäö → aao)
        .replace(/[^a-z0-9 ]/g, ' ')               // bara alphanumeric + space
        .replace(/\s+/g, ' ')
        .trim();
}

export function localDay(iso: string): string {
    return new Date(iso).toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' });
}

/**
 * Plats-nyckel som tål bullriga adresser. Föredrar koordinater (rundas till
 * ~5 km), faller tillbaka på normaliserad locationName-substring.
 * Tom sträng = platsen okänd → eventet ska INTE dedupas (två olika
 * "Sommarfest" samma dag i olika byar får inte slås ihop).
 */
export function locationKey(r: Pick<Row, 'lat' | 'lng' | 'locationName'>): string {
    if (r.lat !== 0 && r.lng !== 0) {
        // Runda till 0.05° (~5km i Sverige) — fångar samma venue trots att
        // geocoder gav olika koords för olika query-varianter. Eftersom dedup
        // även kräver exakt match på title + datum, är ~5km tolerant nog utan
        // att blanda riktigt olika events.
        const r5 = (n: number) => (Math.round(n * 20) / 20).toFixed(2);
        return `${r5(r.lat)},${r5(r.lng)}`;
    }
    if (!r.locationName) return '';
    return normalizeTitle(r.locationName).slice(0, 20);
}

export function dedupKey(r: Pick<Row, 'title' | 'time' | 'lat' | 'lng' | 'locationName'>): string {
    return `${normalizeTitle(r.title)}|${localDay(r.time)}|${locationKey(r)}`;
}

/** Ord (>2 tecken) ur normaliserad locationName — för tvilling-matchning. */
function locationTokens(name: string): Set<string> {
    return new Set(normalizeTitle(name).split(' ').filter((t) => t.length > 2));
}

function tokensOverlap(a: string, b: string): boolean {
    const ta = locationTokens(a);
    for (const t of locationTokens(b)) if (ta.has(t)) return true;
    return false;
}

export interface GroupingResult {
    /** Slutgiltiga dedup-grupper (alla med ≥1 medlem). */
    groups: Row[][];
    /** Rader utan plats-nyckel som INTE kunde fästas vid något kluster. */
    skippedNoLocation: number;
    /** Plats-lösa/namn-bara rader som fästes vid ett entydigt geokodat kluster. */
    attached: number;
}

/**
 * Bygg dedup-grupper med tvilling-fästning.
 *
 * Grundnyckeln är titel+dag+plats — men när ena tvillingen är geokodad och
 * den andra "naken" (inga koordinater) skiljer plats-nyckeln och dubbletten
 * läcker. Fix: inom varje titel+dag, om de geokodade raderna bildar EXAKT
 * ETT koordinat-kluster fäster vi
 *   a) rader helt utan plats vid klustret, och
 *   b) rader med enbart locationName vid klustret OM namnet delar ord med
 *      någon geokodad medlems platsnamn ("Babel" ↔ "Babel, Malmö").
 * Vid flera kluster (generiska titlar: "Midsommarfirande" på 60 orter) görs
 * INGEN fästning — då kan vi inte veta vilken plats den nakna raden avser.
 */
export function buildDedupGroups(rows: Row[]): GroupingResult {
    const byTitleDay = new Map<string, Row[]>();
    for (const r of rows) {
        const k = `${normalizeTitle(r.title)}|${localDay(r.time)}`;
        if (!byTitleDay.has(k)) byTitleDay.set(k, []);
        byTitleDay.get(k)!.push(r);
    }

    const groups: Row[][] = [];
    let skippedNoLocation = 0;
    let attached = 0;

    for (const members of byTitleDay.values()) {
        const hasCoords = (r: Row) => r.lat !== 0 && r.lng !== 0;
        const coordRows = members.filter(hasCoords);
        const nameRows  = members.filter((r) => !hasCoords(r) && locationKey(r) !== '');
        const nakedRows = members.filter((r) => !hasCoords(r) && locationKey(r) === '');

        const within = new Map<string, Row[]>();
        const push = (key: string, r: Row) => {
            if (!within.has(key)) within.set(key, []);
            within.get(key)!.push(r);
        };
        for (const r of coordRows) push(locationKey(r), r);
        for (const r of nameRows) push(locationKey(r), r);

        const coordKeys = new Set(coordRows.map(locationKey));
        if (coordKeys.size === 1) {
            const clusterKey = [...coordKeys][0];
            for (const r of nakedRows) {
                push(clusterKey, r);
                attached++;
            }
            for (const r of nameRows) {
                if (coordRows.some((c) => tokensOverlap(r.locationName, c.locationName))) {
                    // Flytta från namn-gruppen till koordinat-klustret
                    const nameGroup = within.get(locationKey(r))!;
                    nameGroup.splice(nameGroup.indexOf(r), 1);
                    if (nameGroup.length === 0) within.delete(locationKey(r));
                    push(clusterKey, r);
                    attached++;
                }
            }
        } else {
            skippedNoLocation += nakedRows.length;
        }

        groups.push(...within.values());
    }

    return { groups, skippedNoLocation, attached };
}

export function scoreOf(r: Row): number {
    let s = 0;
    const hasImage = r.coverImage && r.coverImage.length > 10;
    if (hasImage) s += 10;
    if (hasImage && r.coverImage!.includes('storage.googleapis')) s += 5;
    if (r.description && r.description.length > 50) s += 5;
    if (r.lat !== 0 || r.lng !== 0) s += 3;
    if (r.isLocationVerified) s += 2;
    if (r.hostName !== 'Facebook') s += 1;
    return s;
}

async function main() {
    const sqliteDb = new Database(path.resolve(__dirname, '../../events.db'), { readonly: true });
    if (!db) { console.error('Firebase ej init'); process.exit(1); }

    console.log(apply ? '🔧 APPLY mode' : '🔍 DRY-RUN');

    const rows: Row[] = sqliteDb.prepare(`
        SELECT url, title, time, locationName, coverImage, description, lat, lng,
               isLocationVerified, hostName, firestoreId
        FROM link_events
        WHERE hidden = 0 AND firestoreId IS NOT NULL AND title IS NOT NULL AND time IS NOT NULL
    `).all() as Row[];

    // Gruppera med tvilling-fästning (se buildDedupGroups). Events utan
    // plats-nyckel som inte kan fästas hoppas över — utan plats kan vi inte
    // skilja "Sommarfest" i Hörby från "Sommarfest" i Tranemo samma dag.
    const { groups, skippedNoLocation, attached } = buildDedupGroups(rows);
    if (skippedNoLocation) console.log(`(${skippedNoLocation} events utan plats-nyckel hoppade — dedupas ej)`);
    if (attached) console.log(`(${attached} plats-lösa tvillingar fästa vid sitt geokodade kluster)`);

    // Filtrera fram bara grupper med dublett
    const dupGroups = groups.filter((arr) => arr.length > 1);
    console.log(`Hittade ${dupGroups.length} dubblett-grupper (${dupGroups.reduce((s, a) => s + a.length, 0)} events totalt, varav ${dupGroups.reduce((s, a) => s + a.length - 1, 0)} ska gömmas)\n`);

    const toHide: Row[] = [];
    for (const arr of dupGroups) {
        const scored = arr.map((r) => ({ r, s: scoreOf(r) })).sort((a, b) => b.s - a.s);
        const keeper = scored[0].r;
        const losers = scored.slice(1).map((x) => x.r);
        console.log(`  [behåll s=${scored[0].s}] ${keeper.hostName.padEnd(18)} ${keeper.title.slice(0, 50)}`);
        for (let i = 0; i < scored.slice(1).length; i++) {
            const loser = scored[i + 1];
            console.log(`     [göm s=${loser.s}] ${loser.r.hostName.padEnd(18)} ${loser.r.title.slice(0, 50)}  ${loser.r.url.slice(0, 60)}`);
        }
        toHide.push(...losers);
    }

    if (!apply) {
        console.log(`\n${toHide.length} events skulle gömmas (dry-run). Kör med --apply för att aktivera.`);
        process.exit(0);
    }

    // Applya — individuella updates eftersom Firestore-batch failar all-or-nothing
    // om en stale firestoreId pekar på dokument som inte längre finns.
    let updated = 0;
    let notFound = 0;
    let failed = 0;
    for (const r of toHide) {
        try {
            await db.collection('linkEvents').doc(r.firestoreId).update({ hidden: 1 });
            updated++;
        } catch (e: any) {
            // Firestore "5 NOT_FOUND" → dokumentet är borta, hoppar tyst
            if (e.code === 5 || /NOT_FOUND/.test(e.message ?? '')) {
                notFound++;
            } else {
                failed++;
                console.error(`  ❌ ${r.title.slice(0, 40)}: ${e.message}`);
            }
        }
    }
    console.log(`\nFirestore: ${updated} uppdaterade, ${notFound} not-found (skippade), ${failed} fel`);

    // Uppdatera SQLite så vi är konsekventa
    sqliteDb.close();
    const writeDb = new Database(path.resolve(__dirname, '../../events.db'));
    const stmt = writeDb.prepare(`UPDATE link_events SET hidden = 1 WHERE firestoreId = ?`);
    for (const r of toHide) stmt.run(r.firestoreId);
    writeDb.close();

    console.log(`\n✅ ${updated} events gömda i Firestore + SQLite`);
    process.exit(0);
}

// Kör bara vid direkt exekvering — testerna importerar funktionerna ovan.
if (require.main === module) {
    main().catch((e) => { console.error('Fatal:', e); process.exit(1); });
}
