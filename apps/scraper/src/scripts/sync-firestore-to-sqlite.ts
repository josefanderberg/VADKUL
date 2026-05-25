/**
 * Engångs-backfill: kopiera alla `linkEvents` från Firestore till lokal SQLite.
 *
 * Användning:
 *   npm run sync-to-sqlite              # mot prod (DB_TARGET=1)
 *   DB_TARGET=2 npm run sync-to-sqlite  # mot lokal emulator
 */
import { db } from '../config/firebase';
import { upsertEvent, countSqliteEvents, getSqlitePath } from '../utils/sqliteHelper';

async function main() {
    if (!db) {
        console.error('❌ Firestore ej initialiserat. Kontrollera service-account.json eller emulatorn.');
        process.exit(1);
    }

    console.log(`📥 Hämtar alla linkEvents från Firestore...`);
    const snap = await db.collection('linkEvents').get();
    console.log(`   Hittade ${snap.size} dokument.`);

    let written = 0;
    let failed = 0;
    snap.forEach(doc => {
        const data = doc.data() as any;
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
            });
            written++;
        } catch (err) {
            failed++;
            console.error(`   ⚠️  Fel vid ${doc.id}:`, err);
        }
    });

    console.log(`\n✅ Klar. ${written} skrivna, ${failed} misslyckade.`);
    console.log(`📦 SQLite-fil: ${getSqlitePath()}`);
    console.log(`📊 Totalt i SQLite nu: ${countSqliteEvents()}`);
}

main().catch(err => {
    console.error('❌ Backfill misslyckades:', err);
    process.exit(1);
});
