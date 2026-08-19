/**
 * db-janitor.ts — nattlig städning av bevisat döda dokument, så databasen
 * hålls ren och inte spårar iväg (kostnads- och hygienbeslut 2026-08-19).
 *
 *   npm run db-janitor            # städa
 *   npm run db-janitor -- --dry   # visa vad som skulle raderas
 *
 * Vad som städas (allt är interna markörer/preferenser — ALDRIG eventdata):
 *   - eventReminders       markör per skickad påminnelse; död när eventet
 *                          passerat (dedup-fönstret är 1 h). Städas 7d efter
 *                          eventTime. Incidenten: 46 920 st varav 2 med
 *                          mottagare hade samlats utan städning.
 *   - eventReminderSends   per-(användare,event,fönster)-markörer; döda när
 *                          eventet passerat. sentAt < 7d bort.
 *   - eventReminderPrefs   klock-knappens val; meningslösa när eventet
 *                          passerat (webben visar inte klockan då). eventStart
 *                          < 7d bort.
 *
 * Raderingar är billigaste Firestore-operationen; BulkWriter batchar.
 * Loggmarkör för Teams-kortet: "🧹 JANITOR:"-rader + "Janitor-summering: …".
 */

import { db } from '../config/firebase';
import * as admin from 'firebase-admin';

const KEEP_DAYS = 7;

interface Rule { collection: string; field: string }
const RULES: Rule[] = [
    { collection: 'eventReminders', field: 'eventTime' },
    { collection: 'eventReminderSends', field: 'sentAt' },
    { collection: 'eventReminderPrefs', field: 'eventStart' },
];

async function cleanCollection(fdb: admin.firestore.Firestore, rule: Rule, cutoff: admin.firestore.Timestamp, dry: boolean): Promise<number> {
    const query = fdb.collection(rule.collection).where(rule.field, '<', cutoff);

    // Dry-run: räkna bara (count-aggregat, ingen pagination behövs).
    if (dry) {
        const agg = await query.count().get();
        return agg.data().count;
    }

    let deleted = 0;
    const writer = fdb.bulkWriter();
    // Paginera i 1000-block tills inget kvar — query:n krymper allteftersom
    // raderingarna landar, så samma query kan köras om tills den är tom.
    for (;;) {
        const snap = await query
            .select()                      // bara dokument-id:n — ingen payload
            .limit(1000)
            .get();
        if (snap.empty) break;
        snap.docs.forEach((d) => { void writer.delete(d.ref); });
        await writer.flush();
        deleted += snap.size;
        if (snap.size < 1000) break;
    }
    await writer.close();
    return deleted;
}

async function main() {
    const dry = process.argv.includes('--dry');
    const fdb = db!;
    const cutoff = admin.firestore.Timestamp.fromMillis(Date.now() - KEEP_DAYS * 24 * 60 * 60 * 1000);

    let total = 0;
    const parts: string[] = [];
    for (const rule of RULES) {
        const n = await cleanCollection(fdb, rule, cutoff, dry);
        total += n;
        parts.push(`${rule.collection} ${n}`);
        if (n > 0) console.log(`🧹 JANITOR: ${rule.collection} — ${n} döda dokument${dry ? ' (dry)' : ' raderade'} (${rule.field} < ${KEEP_DAYS}d sedan)`);
    }
    console.log(`Janitor-summering: ${total}${dry ? ' skulle raderas' : ' raderade'} (${parts.join(', ')})`);
}

main().then(() => process.exit(0)).catch((e) => { console.error('🧹 JANITOR-FEL:', e); process.exit(1); });
