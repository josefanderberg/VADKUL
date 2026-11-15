/**
 * Engångsreparation 15/11 2026 (#236): AI-granskningen skrev `price = ?` med
 * LLM:ens förslag, och nollade därmed källans pris i SQLite-spegeln när
 * beskrivningen inte nämnde något pris (fixat i 81feabfb). Firestore har kvar
 * källans pris — demonen skrev bara dit LLM-priser som fanns, och de andra
 * granskningsskripten rör inte priset i Firestore. Syncen läker inte raderna,
 * eftersom Firestore-dokumenten aldrig ändrades.
 *
 * Skriptet läser BARA prisfältet (fieldMask) för de kommande, prislösa raderna
 * i spegeln, dokument för dokument via getAll — ingen kollektionsläsning — och
 * skriver tillbaka priset i SQLite där Firestore har ett. Inga Firestore-skrivningar.
 *
 *   npx ts-node src/scripts/oneoff-restore-audit-wiped-prices.ts --sample=300   # uppskatta
 *   npx ts-node src/scripts/oneoff-restore-audit-wiped-prices.ts                # torrkör allt
 *   npx ts-node src/scripts/oneoff-restore-audit-wiped-prices.ts --apply
 */

import { db } from '../config/firebase';
import { sqlite } from '../utils/sqliteHelper';

const APPLY = process.argv.includes('--apply');
const SAMPLE = Number(process.argv.find((a) => a.startsWith('--sample='))?.split('=')[1] ?? 0);
const CHUNK = 300;

interface Row { url: string; firestoreId: string; host: string }

async function main(): Promise<void> {
    if (!db) throw new Error('Firestore ej initialiserat');
    const firestore = db;

    const rows = sqlite.prepare(`
        SELECT url, firestoreId,
               REPLACE(SUBSTR(url, INSTR(url, '://') + 3, INSTR(SUBSTR(url, INSTR(url, '://') + 3), '/') - 1), 'www.', '') AS host
        FROM link_events
        WHERE time >= datetime('now') AND hidden = 0
          AND (price IS NULL OR TRIM(price) = '')
          AND firestoreId IS NOT NULL
        ${SAMPLE > 0 ? 'ORDER BY RANDOM() LIMIT ' + Math.floor(SAMPLE) : ''}
    `).all() as Row[];
    console.log(`Prislösa kommande rader att kolla: ${rows.length}${SAMPLE ? ' (stickprov)' : ''}`);

    const restore = sqlite.prepare(
        `UPDATE link_events SET price = ? WHERE url = ? AND (price IS NULL OR TRIM(price) = '')`,
    );
    const byHost = new Map<string, number>();
    let found = 0;
    let restored = 0;

    for (let i = 0; i < rows.length; i += CHUNK) {
        const chunk = rows.slice(i, i + CHUNK);
        const refs = chunk.map((r) => firestore.collection('linkEvents').doc(r.firestoreId));
        const snaps = await firestore.getAll(...refs, { fieldMask: ['price'] });
        const write = sqlite.transaction(() => {
            snaps.forEach((snap, j) => {
                const price = snap.exists ? snap.get('price') : undefined;
                if (typeof price !== 'string' || !price.trim()) return;
                found++;
                byHost.set(chunk[j].host, (byHost.get(chunk[j].host) ?? 0) + 1);
                if (APPLY) restored += restore.run(price.trim(), chunk[j].url).changes;
            });
        });
        write();
        if ((i / CHUNK) % 10 === 0) console.log(`  ${Math.min(i + CHUNK, rows.length)}/${rows.length} — pris i Firestore: ${found}`);
    }

    console.log(`\nPris i Firestore men inte i spegeln: ${found} av ${rows.length}`);
    for (const [host, n] of [...byHost].sort((a, b) => b[1] - a[1]).slice(0, 25)) {
        console.log(`  ${String(n).padStart(6)}  ${host}`);
    }
    console.log(APPLY ? `Återställda i spegeln: ${restored}` : 'Torrkörning — kör med --apply för att skriva i spegeln.');
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
