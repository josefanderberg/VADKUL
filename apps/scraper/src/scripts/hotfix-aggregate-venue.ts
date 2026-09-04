/**
 * hotfix-aggregate-venue.ts — flytta venue-fixade event i det REDAN
 * PUBLICERADE aggregatet (Firestore aggregatedEvents), utan omaggregering.
 *
 * Bakgrund (Piteå 4/9): venue-fixes rättar SQLite/Firestore och nästa natts
 * aggregat, men webbens API-route serverar dagens aggregat ur
 * aggregatedEvents-sharderna — fel punkt ligger alltså kvar på kartan tills
 * nattkedjan hunnit köra. Det här skriptet patchar sharderna direkt: läser
 * destinations-lagret, flyttar event vars locationName matchar VENUE_FIXES
 * (exakt matchning) och laddar upp igen med NY updatedAt, så routens
 * memo/diskcache/ETag invalideras. Cards/descriptions bär inga koordinater.
 *
 * Körs från GitHub Actions (data-hotfix.yml, workflow_dispatch) där
 * FIREBASE_SERVICE_ACCOUNT finns — eller på minin. Idempotent: redan rätt
 * koordinater ger "0 flyttade" och ingen omuppladdning.
 *
 *   npm run hotfix-aggregate               # dry-run
 *   npm run hotfix-aggregate -- --apply
 */

import { db } from '../config/firebase';
import { VENUE_FIXES, matchVenueFix } from '../data/venueFixes';
import { uploadShardedLayer } from './aggregate-events';

const APPLY = process.argv.includes('--apply');

async function main() {
    if (!db) throw new Error('Firestore ej initierad (service-account.json saknas).');
    console.log(APPLY ? '🔧 APPLY' : '🔍 DRY-RUN');

    const indexSnap = await db.collection('aggregatedEvents').doc('destinations').get();
    const index = indexSnap.data();
    if (!index) throw new Error('aggregatedEvents/destinations saknas.');

    // Osharda(t) läge: events ligger direkt i index-dokumentet.
    const sharded = typeof index.shardCount === 'number' && !Array.isArray(index.events);
    const shards: { events: any[] }[] = [];
    if (sharded) {
        for (let i = 0; i < index.shardCount; i++) {
            const s = (await db.collection('aggregatedEvents').doc(`destinations_${i}`).get()).data();
            if (!s || !Array.isArray(s.events)) throw new Error(`Shard destinations_${i} saknas/trasig.`);
            shards.push({ events: s.events });
        }
    } else {
        shards.push({ events: index.events as any[] });
    }

    let moved = 0;
    for (const shard of shards) {
        for (const evt of shard.events) {
            const fix = matchVenueFix(evt?.locationName, VENUE_FIXES);
            if (!fix) continue;
            const off = Math.abs((evt.lat ?? 0) - fix.lat) > 1e-4 || Math.abs((evt.lng ?? 0) - fix.lng) > 1e-4;
            if (!off) continue;
            console.log(`   📍 ${evt.locationName} | ${String(evt.title).slice(0, 40)} | ${evt.lat},${evt.lng} → ${fix.lat},${fix.lng}`);
            if (APPLY) { evt.lat = fix.lat; evt.lng = fix.lng; }
            moved++;
        }
    }
    console.log(`${APPLY ? 'Flyttade' : 'Skulle flytta'}: ${moved} event (updatedAt i lagret: ${index.updatedAt})`);
    if (!APPLY || moved === 0) return;

    // Ny updatedAt så routens memo/diskcache/ETag släpper den gamla datan.
    // uploadShardedLayer skriver shards först, index sist (lässäker ordning).
    const updatedAt = new Date().toISOString();
    const totalEvents = shards.reduce((n, s) => n + s.events.length, 0);
    if (sharded) {
        await uploadShardedLayer(db, 'destinations',
            { updatedAt, shardCount: shards.length, totalEvents },
            shards.map((s, i) => ({ updatedAt, shardIndex: i, events: s.events })));
    } else {
        await db.collection('aggregatedEvents').doc('destinations').set({ updatedAt, events: shards[0].events });
    }
    console.log(`✅ Uppladdad med ny updatedAt=${updatedAt} (${shards.length} shard(s), ${totalEvents} event). CDN-cachen töms av nästa hosting-deploy (annars ≤1 h).`);
}

main().catch(e => { console.error('❌', e); process.exit(1); });
