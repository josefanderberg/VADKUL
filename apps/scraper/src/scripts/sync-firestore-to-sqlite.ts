/**
 * Firestore→SQLite-sync av `linkEvents`.
 *
 * Default är INKREMENTELL: hämtar bara dokument med `updatedAt > cursor`
 * (cursor = förra körningens starttid, sparad i sync_meta). Hel läsning av
 * kollektionen (~29k dokument = ~29k reads) körs bara:
 *   - första gången (ingen cursor),
 *   - med flaggan --full,
 *   - automatiskt var 7:e dag (självläkning mot ostämplade skrivningar,
 *     t.ex. web-sidans attendees — se utils/firestoreStamp.ts).
 *
 * Mot emulatorn (DB_TARGET≠1) körs alltid hel sync och cursorn lämnas orörd —
 * spegeln + cursorn hör till prod-datat.
 *
 * Användning:
 *   npm run sync-to-sqlite              # inkrementell mot prod
 *   npm run sync-to-sqlite -- --full    # tvinga hel läsning
 *   DB_TARGET=2 npm run sync-to-sqlite  # mot lokal emulator (alltid hel)
 */
import { db } from '../config/firebase';
import {
    upsertEvent, countSqliteEvents, getSqlitePath, getSyncMeta, setSyncMeta,
} from '../utils/sqliteHelper';
import { planSync } from '../utils/syncPlan';

const CURSOR_KEY      = 'linkEvents.lastSyncAt';
const FULL_CURSOR_KEY = 'linkEvents.lastFullSyncAt';

async function main() {
    if (!db) {
        console.error('❌ Firestore ej initialiserat. Kontrollera service-account.json eller emulatorn.');
        process.exit(1);
    }

    const isProd    = (process.env.DB_TARGET || '1').trim() === '1';
    const forceFull = process.argv.includes('--full');
    const runStart  = new Date();

    const plan = isProd
        ? planSync({
            now: runStart,
            lastSyncAt: getSyncMeta(CURSOR_KEY),
            lastFullSyncAt: getSyncMeta(FULL_CURSOR_KEY),
            forceFull,
        })
        : { mode: 'full' as const, reason: 'emulator-läge (cursor gäller bara prod)' };

    console.log(`📥 Sync linkEvents → SQLite [${plan.mode}]: ${plan.reason}`);

    const query = plan.mode === 'incremental'
        ? db.collection('linkEvents').where('updatedAt', '>', plan.since!)
        : db.collection('linkEvents');
    const snap = await query.get();
    console.log(`   Hämtade ${snap.size} dokument (${snap.size} Firestore-reads).`);

    let written = 0;
    let failed = 0;
    let skippedNoUrl = 0;
    snap.forEach(doc => {
        const data = doc.data() as any;
        // SQLite (och aggregatet) nycklar på url. Event UTAN url — VADKUL-värdade
        // användarevent — skulle därför skriva över varandra på den tomma nyckeln
        // och bara den sist synkade skulle överleva. De hör hemma i live-spåret
        // (fetchUserCreatedEvents läser dem direkt ur Firestore vid varje poll)
        // och ska aldrig in i den skrapade pipelinen.
        if (!data.url) { skippedNoUrl++; return; }
        try {
            upsertEvent({
                url:                data.url,
                title:              data.title,
                time:               data.time,
                locationName:       data.locationName,
                extractedAddress:   data.extractedAddress,
                geocodedQuery:      data.geocodedQuery,
                lat:                data.lat,
                lng:                data.lng,
                hostName:           data.hostName,
                category:           data.category,
                coverImage:         data.coverImage,
                description:        data.description,
                attendees:          data.attendees,
                createdAt:          data.createdAt,
                isLocationVerified: !!data.isLocationVerified,
                isHostVerified:     !!data.isHostVerified,
                hidden:             !!data.hidden,
                firestoreId:        doc.id,
                // Bär med fälten som annars bara finns i SQLite: utan dem får
                // varje NY rad hasSpecificTime=NULL (webben tappar klockslaget)
                // och status='published' (default) oavsett vad Firestore säger.
                hasSpecificTime:    data.hasSpecificTime,
                price:              data.price ?? undefined,
                status:             data.status,
                // null → COALESCE i upserten bevarar lokal märkning (backfillen
                // 24/8 satte geoPrecision på rader vars Firestore-doc saknar fältet).
                geoPrecision:       data.geoPrecision ?? null,
                // Slutdatum (Timestamp → ISO via upsertens toIso). null →
                // COALESCE bevarar lokalt värde när dokumentet saknar fältet.
                endDate:            data.endDate ?? null,
            });
            written++;
        } catch (err) {
            failed++;
            console.error(`   ⚠️  Fel vid ${doc.id}:`, err);
        }
    });

    // Cursor sätts till KÖRSTART (inte sluttid) så dokument som skrevs medan
    // synken pågick fångas nästa gång. Bara vid lyckad körning, bara mot prod.
    if (isProd && failed === 0) {
        setSyncMeta(CURSOR_KEY, runStart.toISOString());
        if (plan.mode === 'full') setSyncMeta(FULL_CURSOR_KEY, runStart.toISOString());
    } else if (failed > 0) {
        console.warn(`   ⚠️  ${failed} fel — cursorn flyttas INTE fram (nästa körning tar om samma fönster).`);
    }

    const mirrorCount = countSqliteEvents();
    console.log(`\n✅ Klar. ${written} skrivna, ${failed} misslyckade.`);
    if (skippedNoUrl > 0) {
        console.log(`   ⏭  ${skippedNoUrl} event utan url hoppades över (live-spåret, inte aggregatet).`);
    }
    if (plan.mode === 'incremental') {
        console.log(`   ♻️  Inkrementell sync: ${snap.size} reads i stället för ~${mirrorCount} (hel läsning).`);
    }
    console.log(`📦 SQLite-fil: ${getSqlitePath()}`);
    console.log(`📊 Totalt i SQLite nu: ${mirrorCount}`);
}

main().catch(err => {
    console.error('❌ Sync misslyckades:', err);
    process.exit(1);
});
