/**
 * Engångsfix 2026-07-28: landskrona.se låg 2 timmar fel.
 *
 * Sajten skriver UTC i time-attributet men LOKAL tid i den synliga texten:
 *     <time datetime="2026-07-29T17:00">29 juli 2026 19:00</time>
 * new Date() tolkade den zonlösa strängen som lokal tid → varenda Landskrona-
 * event hamnade två timmar för tidigt ("Film i parken: Grease" kl 17 istället
 * för 19, "Sommarbio" kl 13 istället för 15). Grundorsaken är fixad i
 * sitemap-enginens 1b-block; det här skriptet rättar raderna som redan ligger
 * i Firestore + SQLite utan att vänta på nästa skrap.
 *
 * Per event: hämta sidan, jämför attributet med textens klockslag. Bara när
 * texten är EXAKT vad attributet ger läst som UTC skrivs tiden om — allt annat
 * lämnas orört.
 *
 * Dessutom (samma FB-tråd): "Film i parken: Grease" flyttas från Landskrona
 * centrum till Teaterparken, och Facebook-dubbletten (geokodad till Bergen)
 * göms.
 *
 * Kör:  npx ts-node src/scripts/oneoff-fix-landskrona-utc.ts [--apply]
 */
import * as cheerio from 'cheerio';
import { db } from '../config/firebase';
import { Timestamp } from 'firebase-admin/firestore';
import { setEventTime, setEventCoords, setHidden, sqlite } from '../utils/sqliteHelper';

const APPLY = process.argv.includes('--apply');
const PREFIX = 'https://www.landskrona.se/evenemang/';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

// "Film i parken: Grease" — källan säger Teaterparken, Järnvägsgatan 2.
const GREASE_URL = `${PREFIX}film-i-parken-grease/`;
const TEATERPARKEN = { lat: 55.869372, lng: 12.8335473, name: 'Teaterparken, Landskrona', address: 'Järnvägsgatan 2, 261 30 Landskrona' };
// Facebook-dubbletten av samma visning — rätt tid, men geokodad till Bergen.
const FB_DUP_URL = 'https://www.facebook.com/events/26623354810657254/';

interface Row { url: string; title: string; time: string; firestoreId: string | null }

/** Rätt starttid enligt sidan, eller null om attributet redan är korrekt/otolkbart. */
function correctedTime(html: string): Date | null {
    const $ = cheerio.load(html);
    const attr =
        $('[itemprop="startDate"]').attr('content') ||
        $('time[itemprop="startDate"]').attr('datetime') ||
        $('time[datetime]').first().attr('datetime') || '';
    if (!attr || !/T\d{2}:\d{2}/.test(attr) || /(?:Z|[+-]\d{2}:?\d{2})$/.test(attr)) return null;

    const textClock = $(`time[datetime="${attr}"]`).first().text().match(/\b(\d{1,2})[:.](\d{2})\b/);
    if (!textClock) return null;

    const asUtc = new Date(`${attr}Z`);
    if (isNaN(asUtc.getTime())) return null;
    if (asUtc.getHours() !== parseInt(textClock[1], 10) || asUtc.getMinutes() !== parseInt(textClock[2], 10)) return null;
    return asUtc;
}

async function main() {
    if (!db) { console.error('❌ Firestore ej initialiserat.'); process.exit(1); }
    console.log(APPLY ? '✍️  APPLY — skriver till Firestore + SQLite\n' : '🔍 DRY-RUN (kör med --apply för att skriva)\n');

    const rows = sqlite.prepare(
        `SELECT url, title, time, firestoreId FROM link_events
         WHERE url LIKE ? AND hidden = 0 AND time >= ? ORDER BY time`
    ).all(`${PREFIX}%`, new Date().toISOString().slice(0, 10)) as Row[];
    console.log(`${rows.length} kommande landskrona.se-event att kontrollera.\n`);

    let fixed = 0, unchanged = 0, failed = 0;
    for (const row of rows) {
        let html: string;
        try {
            const res = await fetch(row.url, { headers: { 'User-Agent': UA } });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            html = await res.text();
        } catch (err: any) {
            console.log(`   ⚠️  ${row.title} — kunde inte hämta sidan (${err.message})`);
            failed++;
            continue;
        }

        // Bara ren tidszonsrättning: samma kalenderdag och som mest några
        // timmars skillnad. Sidor vars första <time> är ett HELT annat datum
        // (t.ex. konsthallens vernissage-datum) ska inte flytta eventet — det
        // fallet hanteras av enginens text-fallback, inte av det här skriptet.
        const raw = correctedTime(html);
        const stored = new Date(row.time);
        const sameDay = !!raw && raw.toDateString() === stored.toDateString();
        const smallShift = !!raw && Math.abs(raw.getTime() - stored.getTime()) <= 3 * 3600_000;
        const corrected = raw && sameDay && smallShift ? raw : null;
        if (raw && !corrected) {
            console.log(`   ⏭️  ${row.title} — hoppas över (attributet pekar på ${raw.toLocaleDateString('sv-SE')}, inte eventdagen)`);
        }
        if (!corrected || corrected.toISOString() === stored.toISOString()) {
            unchanged++;
        } else {
            const fmt = (d: Date) => d.toLocaleString('sv-SE', { timeZone: 'Europe/Stockholm', dateStyle: 'short', timeStyle: 'short' });
            console.log(`   🕒 ${row.title}: ${fmt(new Date(row.time))} → ${fmt(corrected)}`);
            if (APPLY) {
                if (row.firestoreId) {
                    await db.collection('linkEvents').doc(row.firestoreId).update({
                        time: Timestamp.fromDate(corrected),
                        hasSpecificTime: true,
                    });
                }
                setEventTime(row.url, corrected.toISOString(), true);
            }
            fixed++;
        }
        await new Promise(r => setTimeout(r, 250)); // snäll mot sajten
    }

    console.log(`\n${fixed} tider rättade, ${unchanged} redan rätt, ${failed} misslyckade.`);

    // ── Grease: plats + dubblett ────────────────────────────────────────────
    const grease = sqlite.prepare('SELECT url, title, firestoreId FROM link_events WHERE url = ?').get(GREASE_URL) as Row | undefined;
    console.log(`\n📍 ${GREASE_URL}\n   plats → ${TEATERPARKEN.name} (${TEATERPARKEN.lat}, ${TEATERPARKEN.lng})`);
    console.log(`🙈 ${FB_DUP_URL}\n   hidden → true (dubblett, geokodad till Bergen)`);
    if (APPLY) {
        if (grease?.firestoreId) {
            await db.collection('linkEvents').doc(grease.firestoreId).update({
                locationName: TEATERPARKEN.name,
                extractedAddress: TEATERPARKEN.address,
                geocodedQuery: 'Teaterparken, Landskrona',
                lat: TEATERPARKEN.lat,
                lng: TEATERPARKEN.lng,
                isLocationVerified: true,
                category: 'culture',
            });
        }
        setEventCoords(GREASE_URL, TEATERPARKEN.lat, TEATERPARKEN.lng, 'Teaterparken, Landskrona');
        sqlite.prepare('UPDATE link_events SET locationName = ?, extractedAddress = ?, category = ?, updatedAt = ? WHERE url = ?')
            .run(TEATERPARKEN.name, TEATERPARKEN.address, 'culture', new Date().toISOString(), GREASE_URL);

        const dup = sqlite.prepare('SELECT firestoreId FROM link_events WHERE url = ?').get(FB_DUP_URL) as { firestoreId?: string } | undefined;
        if (dup?.firestoreId) await db.collection('linkEvents').doc(dup.firestoreId).update({ hidden: true });
        setHidden(FB_DUP_URL, true);
        console.log('\n✅ Klart. Kör `npm run aggregate` för att publicera till kartan.');
    }
    process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
