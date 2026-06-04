/**
 * Migration: rätta `hasSpecificTime` för events som felaktigt sparats med
 * `00:00:00` lokal tid.
 *
 * Bakgrund: Tidigare runner satte `hasSpecificTime: true` alltid. För källor
 * som bara ger datum (utan klockslag) blev tiden default JS lokal midnatt,
 * vilket UI:n visade som "00:00". Korrekt vore att visa bara datumet.
 *
 * Fix: hitta alla events från våra nya Sources där tiden är midnatt lokal
 * (= '22:00:00.000Z' UTC i CEST eller '23:00:00.000Z' UTC i CET) och
 * uppdatera `hasSpecificTime=false`.
 *
 * Användning:
 *   npx ts-node src/scripts/fix-midnight-times.ts            # dry-run
 *   npx ts-node src/scripts/fix-midnight-times.ts --apply    # skriver
 */

import { db } from '../config/firebase';
import { SOURCES } from '../sources/registry';

const AFFECTED_HOSTNAMES = SOURCES.map((s) => s.hostName);

async function main() {
    const apply = process.argv.includes('--apply');
    console.log(apply ? '🔧 APPLY mode — writes to Firestore' : '🔍 DRY-RUN — no writes');
    console.log(`Source hostNames att kontrollera: ${AFFECTED_HOSTNAMES.length}`);

    if (!db) {
        console.error('Firebase ej initialiserad.');
        process.exit(1);
    }

    let totalChecked = 0;
    let totalToFix = 0;
    let totalApplied = 0;
    const perHost: Record<string, { checked: number; toFix: number }> = {};

    for (const hostName of AFFECTED_HOSTNAMES) {
        const snap = await db.collection('linkEvents').where('hostName', '==', hostName).get();
        perHost[hostName] = { checked: snap.size, toFix: 0 };
        totalChecked += snap.size;

        // Batchar i grupper om 400 (Firestore-limit: 500/batch)
        let batch = db.batch();
        let inBatch = 0;
        for (const doc of snap.docs) {
            const data = doc.data();
            const t = data.time;
            // time är ofta en Firestore Timestamp; konvertera
            const date: Date = t?.toDate ? t.toDate() : new Date(t);
            if (isNaN(date.getTime())) continue;
            const isMidnightLocal = date.getHours() === 0 && date.getMinutes() === 0;
            const isMidnightUtc = date.getUTCHours() === 0 && date.getUTCMinutes() === 0;
            const isFake = isMidnightLocal || isMidnightUtc;
            const currentFlag = data.hasSpecificTime;
            if (isFake && currentFlag !== false) {
                perHost[hostName].toFix++;
                totalToFix++;
                if (apply) {
                    batch.update(doc.ref, { hasSpecificTime: false });
                    inBatch++;
                    if (inBatch >= 400) {
                        await batch.commit();
                        totalApplied += inBatch;
                        batch = db.batch();
                        inBatch = 0;
                    }
                }
            }
        }
        if (apply && inBatch > 0) {
            await batch.commit();
            totalApplied += inBatch;
        }
        const r = perHost[hostName];
        console.log(`  ${hostName.padEnd(28)} checked=${String(r.checked).padStart(4)}  toFix=${String(r.toFix).padStart(4)}`);
    }

    console.log('─'.repeat(60));
    console.log(`TOTAL: checked=${totalChecked}  to-fix=${totalToFix}  ${apply ? `applied=${totalApplied}` : '(dry-run)'}`);
    process.exit(0);
}

main().catch((err) => { console.error('Fatal:', err); process.exit(1); });
