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

const KEEP_DAYS = 2;   // markörer är meningslösa efter eventstart (1h-dedupfönster); 7 gav en vecka falska kostnadsvakt-larm
const PAGE_SIZE = 1000;

interface Rule { collection: string; field: string }
const RULES: Rule[] = [
    { collection: 'eventReminders', field: 'eventTime' },
    { collection: 'eventReminderSends', field: 'sentAt' },
    { collection: 'eventReminderPrefs', field: 'eventStart' },
];

/**
 * Städar en kollektion och returnerar antalet dokument (raderade, eller vid
 * --dry hur många som SKULLE raderas).
 *
 * MARKÖR-PAGINERING, och det är inte kosmetik: kör man i stället om SAMMA
 * query varje varv och litar på att "query:n krymper när raderingarna landar"
 * får man tillbaka de redan raderade dokumenten tills query-INDEXET hunnit
 * ikapp — Firestore uppdaterar indexet asynkront. Det var buggen 2026-08-19:
 * 1 709 frågor à ~1000 dokument = 1,7 MILJONER reads för att radera 37 800
 * dokument (~38 000 reads är rätt siffra). orderBy + startAfter går alltid
 * framåt och kan aldrig snurra på samma sida.
 */
export async function cleanCollection(
    fdb: admin.firestore.Firestore,
    rule: Rule,
    cutoff: admin.firestore.Timestamp,
    dry: boolean,
): Promise<number> {
    const query = fdb.collection(rule.collection).where(rule.field, '<', cutoff);

    // Count-aggregat: ~1 read per 1000 indexposter. Ger både dry-svaret och
    // varvtaket nedan för en spottstyver.
    const total = (await query.count().get()).data().count;
    if (dry || total === 0) return total;

    const writer = fdb.bulkWriter();
    let deleted = 0;
    let cursor: admin.firestore.QueryDocumentSnapshot | null = null;
    // Skyddsnät: även om markören mot förmodan skulle stå still kan loopen
    // aldrig kosta mer än en dryg genomläsning av träffmängden.
    const maxRounds = Math.ceil(total / PAGE_SIZE) + 2;

    let round = 0;
    for (; round < maxRounds; round++) {
        // select(rule.field): minsta möjliga payload som ändå bär värdet
        // startAfter() behöver för att bygga markören (tom select() ger ett
        // snapshot utan fält → Firestore kan inte läsa ut sorteringsvärdet).
        let page = query.orderBy(rule.field).select(rule.field).limit(PAGE_SIZE);
        if (cursor) page = page.startAfter(cursor);
        const snap = await page.get();
        if (snap.empty) break;

        snap.docs.forEach((d) => { void writer.delete(d.ref); });
        // Flush per sida håller bufferten liten och ger backpressure. Den är
        // INTE längre lastbärande för korrektheten — markören är det.
        await writer.flush();

        cursor = snap.docs[snap.docs.length - 1];
        deleted += snap.size;
        if (snap.size < PAGE_SIZE) break;
    }
    await writer.close();

    if (round >= maxRounds) {
        console.warn(`🧹 JANITOR: ${rule.collection} — varvtaket (${maxRounds}) nåddes vid ${deleted}/${total}; resten tas nästa natt.`);
    }
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

if (require.main === module) {
    main().then(() => process.exit(0)).catch((e) => { console.error('🧹 JANITOR-FEL:', e); process.exit(1); });
}
