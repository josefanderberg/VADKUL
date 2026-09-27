/**
 * ENGÅNGS-BACKFILL av gilla-räknaren (2026-09-28, Josefs beställning).
 *
 * Gilla-siffran (eventStats.likes) började ticka först när reglerna
 * deployades 27/9 kväll - men gillningarna som gjorts sedan 22/8 ligger i
 * users.savedEventIds. Skriptet räknar ihop dem och SÄTTER likes till det
 * faktiska antalet konton som har eventet sparat. set (inte increment) gör
 * körningen idempotent och dubbelräknar inte tryck som redan bokförts av
 * webben - savedEventIds innehåller ju även de gillningarna.
 *
 * BARA event som inte varit fylls i (Josef: "många event som har likes har
 * troligtvis varit"): passerade event ska inte dyka upp med siffror i
 * morgonens bakade aggregat. "Har varit" avgörs dagsvis:
 *  - skrapade event (id = URL): time/endDate ur events-destinations.json -
 *    saknas id:t där är eventet borta ur pipelinen → hoppa över
 *  - serietillfällen (id = "docId__YYYY-MM-DD"): datumsuffixet
 *  - användarskapade (övriga id:n): linkEvents-dokumentets time/endDate
 *
 * Läser HELA users-kollektionen (fältmaskad till savedEventIds) - normalt
 * förbjudet i skript, uttryckligen godkänt av Josef för den här körningen.
 *
 * Körs lokalt med admin-SDK:t: npx ts-node -T src/scripts/backfill-event-likes.ts
 * (--dry-run skriver ingenting, loggar bara vad som skulle skrivas)
 */
import { db } from '../config/firebase';
import { eventShareSlug } from '@vadkul/kontrakt';
import * as path from 'path';
import * as fs from 'fs';

const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
    if (!db) throw new Error('Firestore är inte initierad (service-account.json saknas?)');

    // Dagsgränsen: allt vars (slut)datum är före idag räknas som "har varit".
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayMs = today.getTime();
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    // 1. Räkna gillningar per event-id ur users.savedEventIds (fältmaskad).
    const usersSnap = await db.collection('users').select('savedEventIds').get();
    const countById = new Map<string, number>();
    for (const u of usersSnap.docs) {
        const ids = u.get('savedEventIds');
        if (!Array.isArray(ids)) continue;
        // Set:a per användare - ett konto ska aldrig kunna räknas dubbelt
        // även om listan skulle innehålla samma id två gånger.
        for (const id of new Set(ids)) {
            if (typeof id === 'string' && id) countById.set(id, (countById.get(id) ?? 0) + 1);
        }
    }
    console.log(`👥 ${usersSnap.size} användare lästa, ${countById.size} unika gillade event-id:n`);

    // 2. Tidsuppslag för skrapade event ur destinations-aggregatet.
    const destPath = path.resolve(__dirname, '../../../web/public/events-destinations.json');
    const dests = JSON.parse(fs.readFileSync(destPath, 'utf-8')) as {
        events: { id: string; time: string; endDate?: string }[];
    };
    const destTime = new Map(dests.events.map(e => [e.id, e] as const));

    const upcoming: { id: string; likes: number }[] = [];
    let skippedPast = 0;
    let skippedGone = 0;

    const rowUpcoming = (row: { time: string; endDate?: string }) => {
        const endMs = Date.parse(row.endDate || row.time);
        return Number.isFinite(endMs) && endMs >= todayMs;
    };

    for (const [id, likes] of countById) {
        const seriesDate = id.includes('__') ? id.split('__')[1] : null;
        if (seriesDate && /^\d{4}-\d{2}-\d{2}$/.test(seriesDate)) {
            // Serietillfälle: datumsuffixet avgör.
            if (seriesDate >= todayKey) upcoming.push({ id, likes });
            else skippedPast++;
            continue;
        }
        if (/^https?:\/\//.test(id)) {
            // Skrapat event: tiden ur aggregatet; borta ur aggregatet = passerat/utrensat.
            const row = destTime.get(id);
            if (!row) { skippedGone++; continue; }
            if (rowUpcoming(row)) upcoming.push({ id, likes });
            else skippedPast++;
            continue;
        }
        // Användarskapat: läs dokumentet (få stycken - ingen kollektionsläsning).
        const snap = await db.collection('linkEvents').doc(id).get();
        if (!snap.exists) { skippedGone++; continue; }
        const time = snap.get('time')?.toDate?.() as Date | undefined;
        const endDate = snap.get('endDate')?.toDate?.() as Date | undefined;
        const endMs = (endDate ?? time)?.getTime();
        if (endMs !== undefined && endMs >= todayMs) upcoming.push({ id, likes });
        else skippedPast++;
    }

    console.log(`✅ ${upcoming.length} kommande event får siffror · ⏭ ${skippedPast} har varit · 🗑 ${skippedGone} finns inte längre`);
    upcoming.sort((a, b) => b.likes - a.likes);
    for (const { id, likes } of upcoming.slice(0, 15)) {
        console.log(`   ${String(likes).padStart(3)} ❤️  ${id.slice(0, 90)}`);
    }

    if (DRY_RUN) { console.log('\n--dry-run: ingenting skrevs.'); return; }

    // 3. Skriv: SET till kontoräknat antal (idempotent, se filhuvudet).
    const writer = db.bulkWriter();
    for (const { id, likes } of upcoming) {
        writer.set(db.collection('eventStats').doc(eventShareSlug(id)), { likes, eventId: id }, { merge: true });
    }
    await writer.close();
    console.log(`✍️  ${upcoming.length} eventStats-dokument skrivna.`);
}

main().then(() => process.exit(0)).catch(e => { console.error('BACKFILL FÖLL:', e); process.exit(1); });
