/**
 * Läker titlar som sparats AVKAPADE: läser källan på nytt, normaliserar som
 * runnern gör, och skriver om titeln bara där den sparade titeln är början
 * av den nya ("Föreläsning" → "Föreläsning - Digital säkerhet och risker med
 * AI"). Andra titelskillnader rörs inte — en arrangör som bytt titel är inte
 * en kapning, och refresh-körningarna uppdaterar avsiktligt aldrig titeln.
 *
 * Bakgrund 15/11 2026: normalizeTitle klippte " - X" när X innehöll venue-
 * namnet, och Vuxenskolan sätter venue = ort ("…, Kalmar"). Fixat i
 * normalizeEvent.ts; det här skriptet tar ikapp de rader som redan sparats.
 *
 * Skrivningar: SQLite + Firestore (via stamped()), bara för träffarna.
 *
 *   npx ts-node src/scripts/refresh-truncated-titles.ts --ids=sv            # torrkör
 *   npx ts-node src/scripts/refresh-truncated-titles.ts --ids=sv --apply
 */

import { SOURCES, ENGINES } from '../sources';
import { normalizeRawEvent, isTruncationOf } from '../utils/normalizeEvent';
import { getSqliteEvent, sqlite } from '../utils/sqliteHelper';
import { db } from '../config/firebase';
import { stamped } from '../utils/firestoreStamp';

const APPLY = process.argv.includes('--apply');
const IDS = (process.argv.find((a) => a.startsWith('--ids='))?.split('=')[1] ?? '').split(',').filter(Boolean);
const WINDOW_DAYS = parseInt(process.env.SCRAPE_WINDOW_DAYS || '30', 10);

async function main(): Promise<void> {
    if (IDS.length === 0) throw new Error('Ange --ids=<källa>[,<källa>]');
    const setTitle = sqlite.prepare('UPDATE link_events SET title = ?, updatedAt = ? WHERE url = ?');

    for (const id of IDS) {
        const source = SOURCES.find((s) => s.id === id);
        const engine = source ? ENGINES[source.engine] : undefined;
        if (!source || !engine) { console.log(`${id}: okänd källa eller motor`); continue; }

        const windowStart = new Date(); windowStart.setHours(0, 0, 0, 0);
        const days = source.windowDays ?? WINDOW_DAYS;
        const windowEnd = new Date(windowStart.getTime() + days * 86_400_000);
        const raw = await engine(source.config, {
            windowStart, windowEnd, refreshKnown: true,
            log: (m) => console.log(`  ${m}`),
        });

        let fixed = 0;
        for (const e of raw) {
            normalizeRawEvent(e, source.hostName);
            const row = getSqliteEvent(e.url);
            if (!row?.title || !isTruncationOf(row.title, e.title)) continue;
            console.log(`  "${row.title}" → "${e.title}"`);
            if (!APPLY) { fixed++; continue; }
            setTitle.run(e.title, new Date().toISOString(), e.url);
            if (db && row.firestoreId) {
                try {
                    await db.collection('linkEvents').doc(row.firestoreId).update(stamped({ title: e.title }));
                } catch (err: any) {
                    if (err?.code !== 5) console.error(`  Firestore-uppdatering misslyckades: ${err?.message}`);
                }
            }
            fixed++;
        }
        console.log(`${id}: ${raw.length} event lästa, ${fixed} avkapade titlar ${APPLY ? 'rättade' : 'att rätta (torrkörning)'}`);
    }
}

if (require.main === module) {
    main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
}
