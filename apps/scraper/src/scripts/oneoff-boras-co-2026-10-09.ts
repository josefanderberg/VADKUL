#!/usr/bin/env ts-node
/**
 * ENGÅNGS: Borås TME heter Borås & Co sedan 20 augusti 2025 (pressmeddelande
 * via TT). Källan boras-com bytte hostName 2026-10-09, men kända URL:er skrapas
 * inte om - de sparade eventen behåller annars "Borås TME", och arrangörssidan
 * skulle delas i två (boras-tme + boras-och-co).
 *
 * Läser spegeln (aldrig hela Firestore-kollektionen), skriver hostName per
 * dokument via stamped() så att den inkrementella syncen ser ändringen, och
 * speglar SQLite direkt så att aggregatet samma natt får det nya namnet.
 *
 * Kör:
 *   npx ts-node src/scripts/oneoff-boras-co-2026-10-09.ts --dry
 *   npx ts-node src/scripts/oneoff-boras-co-2026-10-09.ts
 */

import Database from 'better-sqlite3';
import path from 'path';
import { db } from '../config/firebase';
import { stamped } from '../utils/firestoreStamp';
import { setEventHost } from '../utils/sqliteHelper';

const DRY = process.argv.includes('--dry');
const GAMMALT = 'Borås TME';
const NYTT = 'Borås & Co';

async function main() {
    if (!db) { console.error('❌ Firestore ej initialiserat.'); process.exit(1); }
    const sqlite = new Database(path.resolve(__dirname, '../../events.db'), { readonly: true });
    const rader = sqlite.prepare(
        'SELECT firestoreId, url FROM link_events WHERE hostName = ? AND firestoreId IS NOT NULL',
    ).all(GAMMALT) as { firestoreId: string; url: string }[];
    sqlite.close();

    console.log(`${DRY ? '🔍 DRY' : '🔧 APPLY'}: ${rader.length} event med hostName "${GAMMALT}" → "${NYTT}"`);
    if (DRY) process.exit(0);

    let klara = 0, borta = 0, fel = 0;
    for (const r of rader) {
        try {
            await db.collection('linkEvents').doc(r.firestoreId).update(stamped({ hostName: NYTT }));
            setEventHost(r.url, NYTT);
            klara++;
        } catch (e) {
            const err = e as Error & { code?: number };
            if (err.code === 5) borta++;          // NOT_FOUND: redan städat i Firestore
            else { fel++; console.error(`  ❌ ${r.firestoreId}: ${err.message}`); }
        }
    }
    console.log(`✅ ${klara} omdöpta (borta=${borta}, fel=${fel}).`);
    process.exit(fel ? 1 : 0);
}

main();
