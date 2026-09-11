#!/usr/bin/env ts-node
/**
 * ENGÅNGS: beskrivnings-svepet 2026-09-11 ("bara förståelig svenska").
 *
 * Två deterministiska kategorier i befintlig data (scraperna är lagade i
 * samma commit — det här städar det som redan ligger):
 *
 *  1. SPORT-KODER: sportality/sportomedia skrev serie-koden som hela
 *     beskrivningen ("HA", "CHL", "Allsvenskan · Omgång 21"). Byggs om till
 *     samma hela mening som swehockey: "Liga: Hem möter Borta i Arena
 *     (omgång N)." — lag ur titeln, arena ur locationName.
 *  2. HTML-/ESCAPE-RESTER: beskrivningar med synliga taggar ("<p>…"),
 *     bokstavliga \n-sekvenser eller kvarvarande entiteter körs genom
 *     dagens cleanDescription (som nu strippar även escapad HTML).
 *
 * Skriver SQLite + Firestore via stamped(). Dry-run är default; --apply för
 * att skriva. Bara framtida event röres — passerade städas ändå bort.
 *
 * Kör:  npx ts-node src/scripts/oneoff-cleanup-descriptions-2026-09-11.ts [--apply]
 */

import path from 'path';
import Database from 'better-sqlite3';
import { db } from '../config/firebase';
import { stamped } from '../utils/firestoreStamp';
import { cleanDescription } from '../utils/text';

const APPLY = process.argv.includes('--apply');

// "HA" = versalerna i "HockeyAllsvenskan" → skriv hela liganamnet; en kod
// som INTE är ligans (CHL i SHL-flödet) är en annan turnering och behålls.
function competitionName(code: string, hostName: string): string {
    const initials = hostName.replace(/[^A-ZÅÄÖ]/g, '');
    return code === hostName || code === initials ? hostName : code;
}

const SPORT_DESC_RE = /^([A-ZÅÄÖa-zåäö .]{2,30})(?: · Omgång (\d+))?$/;

function rebuildSportDesc(title: string, oldDesc: string, hostName: string, locationName: string | null): string | null {
    const teams = title.split(' – ');
    if (teams.length !== 2) return null;
    const m = oldDesc.match(SPORT_DESC_RE);
    if (!m) return null;
    const comp = competitionName(m[1].trim(), hostName);
    return `${comp}: ${teams[0].trim()} möter ${teams[1].trim()}`
        + (locationName?.trim() ? ` i ${locationName.trim()}` : '')
        + (m[2] != null ? ` (omgång ${m[2]})` : '')
        + '.';
}

const HTML_JUNK_RE = /<\/?[a-z][^>]*>|\\n|\\r|\\t|&(?:lt|gt|amp|nbsp|auml|ouml|aring|hellip|ndash);/i;

async function main() {
    if (!db) { console.error('❌ Firestore ej initialiserat.'); process.exit(1); }
    const sqlite = new Database(path.join(__dirname, '..', '..', 'events.db'));
    const rows = sqlite.prepare(
        `SELECT url, title, description, locationName, hostName, category, firestoreId
         FROM link_events
         WHERE time >= datetime('now') AND description IS NOT NULL AND description != ''`,
    ).all() as Array<{ url: string; title: string; description: string; locationName: string | null; hostName: string; category: string | null; firestoreId: string | null }>;

    const changes: Array<{ url: string; firestoreId: string | null; from: string; to: string; kind: string }> = [];
    for (const r of rows) {
        // 1. Sportkoder — bara rader vars HELA beskrivning är kod/kod·omgång
        //    och vars titel är "Hem – Borta".
        if (r.category === 'sport' && SPORT_DESC_RE.test(r.description) && r.title.includes(' – ')) {
            const rebuilt = rebuildSportDesc(r.title, r.description, r.hostName, r.locationName);
            if (rebuilt && rebuilt !== r.description) {
                changes.push({ url: r.url, firestoreId: r.firestoreId, from: r.description, to: rebuilt, kind: 'sportkod' });
                continue;
            }
        }
        // 2. HTML-/escape-rester — kör om genom dagens cleanDescription.
        if (HTML_JUNK_RE.test(r.description)) {
            const cleaned = cleanDescription(r.description);
            if (cleaned && cleaned !== r.description) {
                changes.push({ url: r.url, firestoreId: r.firestoreId, from: r.description, to: cleaned, kind: 'html-rester' });
            }
        }
    }

    const byKind = new Map<string, number>();
    for (const c of changes) byKind.set(c.kind, (byKind.get(c.kind) ?? 0) + 1);
    console.log(`Hittade ${changes.length} beskrivningar att laga:`, Object.fromEntries(byKind));
    for (const c of changes.slice(0, 12)) {
        console.log(`  [${c.kind}] ${c.from.slice(0, 45).replace(/\n/g, '⏎')}  →  ${c.to.slice(0, 70).replace(/\n/g, '⏎')}`);
    }

    if (!APPLY) { console.log('\n(dry-run — kör med --apply för att skriva)'); process.exit(0); }

    const upd = sqlite.prepare('UPDATE link_events SET description = ? WHERE url = ?');
    let fs = 0;
    for (const c of changes) {
        upd.run(c.to, c.url);
        if (c.firestoreId) {
            try {
                await db.collection('linkEvents').doc(c.firestoreId).update(stamped({ description: c.to }));
                fs++;
            } catch (err: any) {
                if (err?.code !== 5) console.error(`  ⚠️ Firestore-fel ${c.firestoreId}:`, err?.message);
            }
        }
    }
    console.log(`✅ Klart: ${changes.length} SQLite-rader, ${fs} Firestore-dokument.`);
    process.exit(0);
}

main().catch((err) => { console.error('❌', err); process.exit(1); });
