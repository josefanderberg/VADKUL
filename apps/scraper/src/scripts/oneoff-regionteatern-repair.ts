/**
 * oneoff-regionteatern-repair.ts — reparera Regionteatern Blekinge Kronobergs
 * befintliga event (2026-08-20): allt låg på Växjö centrum med platshållartid,
 * fast föreställningarna spelas bl.a. på Lokstallarna i Karlshamn kl 20:00.
 *
 * Rotorsaken (sitemap-motorn läste inte schema-raderna
 * "<h3>Fredag 28 augusti</h3><p>Lokstallarna, Karlshamn | 20:00 | …</p>")
 * är fixad i backfillPlaceFromHtml — detta reparerar de redan sparade.
 *
 *   npm run ts-node src/scripts/oneoff-regionteatern-repair.ts        # dry
 *   npx ts-node src/scripts/oneoff-regionteatern-repair.ts --apply
 *
 * Per event: hämta detaljsidan → backfillPlaceFromHtml (venue/stad/klockslag)
 * → prosa-fallback "på <Venue> i <Stad>" (festivalsidor utan schema-rader)
 * → geokoda venue+stad → uppdatera SQLite + Firestore (stamped, så
 * inkrementella syncen speglar ändringen).
 */

import { db } from '../config/firebase';
import { sqlite, setEventCoords, setEventTime } from '../utils/sqliteHelper';
import { backfillPlaceFromHtml } from '../sources/engines/sitemap';
import { geocodeVenueSweden } from '../utils/venueCoordinates';
import { stamped } from '../utils/firestoreStamp';
import { RawEvent } from '../sources/types';

const APPLY = process.argv.includes('--apply');

interface Row { url: string; firestoreId: string | null; title: string; time: string; locationName: string }

async function main() {
    console.log(APPLY ? '🔧 APPLY' : '🔍 DRY-RUN');
    const rows = sqlite.prepare(`
        SELECT url, firestoreId, title, time, locationName
        FROM link_events
        WHERE hidden = 0 AND time > datetime('now') AND url LIKE '%regionteatern.se%'
        ORDER BY time
    `).all() as Row[];
    console.log(`${rows.length} framtida Regionteatern-event`);

    const updLoc = sqlite.prepare('UPDATE link_events SET locationName = ?, updatedAt = ? WHERE url = ?');
    let fixed = 0;

    for (const r of rows) {
        const res = await fetch(r.url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        if (!res.ok) { console.log(`  ⚠️ ${r.url.slice(-40)} → HTTP ${res.status}`); continue; }
        const html = await res.text();

        const ev: RawEvent = { title: r.title, startDate: new Date(r.time), url: r.url };
        backfillPlaceFromHtml(html, ev);

        // Prosa-fallback för sidor utan schema-rader (festivalöversikter):
        // "äger rum den 27–30 augusti på Lokstallarna i Karlshamn"
        if (!ev.venueName || !ev.city) {
            const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
            const m = text.match(/\bpå ([A-ZÅÄÖ][A-Za-zåäöÅÄÖé -]{2,40}?) i ([A-ZÅÄÖ][a-zåäö-]{2,25})\b/);
            if (m) {
                if (!ev.venueName) ev.venueName = m[1].trim();
                if (!ev.city) ev.city = m[2].trim();
            }
        }
        if (!ev.venueName && !ev.city) { console.log(`  ○ ${r.title.slice(0, 40)} — inget att hämta`); continue; }

        const coords = ev.coords
            ?? await geocodeVenueSweden(`${ev.venueName ?? ''}, ${ev.city ?? ''}`.replace(/^, |, $/g, ''), ev.city ? { nearCity: ev.city } : undefined);

        const newLoc = [ev.venueName, ev.city].filter(Boolean).join(', ');
        const newTime = ev.hasSpecificTime ? ev.startDate.toISOString() : null;
        console.log(`  📍 ${r.title.slice(0, 38).padEnd(38)} → ${newLoc.padEnd(28)} ${newTime ? newTime.slice(11, 16) + 'Z' : '(tid oförändrad)'} ${coords ? coords.map(c => c.toFixed(4)).join(',') : 'INGEN GEOKOD'}`);

        if (!APPLY) continue;
        const now = new Date().toISOString();
        updLoc.run(newLoc, now, r.url);
        if (coords) setEventCoords(r.url, coords[0], coords[1], `${ev.venueName}, ${ev.city}`);
        if (newTime) setEventTime(r.url, newTime, true);
        if (db && r.firestoreId) {
            const patch: Record<string, unknown> = { locationName: newLoc };
            if (coords) { patch.lat = coords[0]; patch.lng = coords[1]; patch.isLocationVerified = true; }
            if (newTime) { patch.time = newTime; patch.hasSpecificTime = true; }
            try { await db.collection('linkEvents').doc(r.firestoreId).update(stamped(patch)); }
            catch (e: any) { if (e?.code !== 5) console.error(`  ❌ Firestore: ${e?.message}`); }
        }
        fixed++;
    }
    console.log(`\nKlart: ${fixed} reparerade${APPLY ? '' : ' (dry-run — inget skrivet)'}`);
    process.exit(0);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
