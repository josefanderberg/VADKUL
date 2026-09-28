/**
 * Engångsfix 2026-09-28: upplev.vaxjo.se låg på SLUTTIDEN.
 *
 * SiteVision-propsen skriver endDate före startDate, och cheerioFallbacks
 * textskanning tog första ISO-datumet → Tengstrandfestivalen 20:00 i st.f.
 * 19:00, "Pjäs" 20:45 i st.f. 19:00 osv. Kartan visade dubbletter med två
 * olika tider (Facebook/Tickster rätt, kommunen fel) och dubblettrensningen
 * missade dem eftersom den kräver samma starttid. Grundorsaken är lagad i
 * sitemap-enginen (startInsteadOfEnd); det här skriptet rättar raderna som
 * redan finns, eftersom runnern aldrig skriver om tiden på kända url:er.
 *
 * Per event: hämta sidan, och bara när den lagrade tiden EXAKT är sidans
 * endDate och sidan har ett tidigare startDate samma dag byts tiden. Den
 * gamla tiden sparas som endDate (den är ju eventets riktiga slut).
 *
 * Kör:  npx ts-node src/scripts/oneoff-fix-vaxjo-sluttid.ts [--apply]
 * Sedan: npm run dedupe-cross -- --apply && npm run aggregate
 */
import { db } from '../config/firebase';
import { Timestamp } from 'firebase-admin/firestore';
import { stamped } from '../utils/firestoreStamp';
import { setEventTime, setEventEndDate, sqlite } from '../utils/sqliteHelper';
import { startInsteadOfEnd } from '../sources/engines/sitemap';

const APPLY = process.argv.includes('--apply');
const PREFIX = 'https://upplev.vaxjo.se/evenemang/';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

interface Row { url: string; title: string; time: string; firestoreId: string | null }

async function main() {
    if (!db) { console.error('❌ Firestore ej initialiserat.'); process.exit(1); }
    console.log(APPLY ? '✍️  APPLY - skriver till Firestore + SQLite\n' : '🔍 DRY-RUN (kör med --apply för att skriva)\n');

    const rows = sqlite.prepare(
        `SELECT url, title, time, firestoreId FROM link_events
         WHERE url LIKE ? AND time >= ? ORDER BY time`
    ).all(`${PREFIX}%`, new Date().toISOString().slice(0, 10)) as Row[];
    console.log(`${rows.length} kommande upplev.vaxjo.se-event att kontrollera.\n`);

    const fmt = (d: Date) => d.toLocaleString('sv-SE', { timeZone: 'Europe/Stockholm', dateStyle: 'short', timeStyle: 'short' });
    let fixed = 0, unchanged = 0, failed = 0;
    for (const row of rows) {
        let html: string;
        try {
            const res = await fetch(row.url, { headers: { 'User-Agent': UA } });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            html = await res.text();
        } catch (err: any) {
            console.log(`   ⚠️  ${row.title} - kunde inte hämta sidan (${err.message})`);
            failed++;
            continue;
        }

        const stored = new Date(row.time);
        const start = startInsteadOfEnd(html, stored);
        if (start === stored) {
            unchanged++;
        } else {
            console.log(`   🕒 ${row.title}: ${fmt(stored)} → ${fmt(start)} (slut ${fmt(stored).slice(-5)})`);
            if (APPLY) {
                if (row.firestoreId) {
                    try {
                        await db.collection('linkEvents').doc(row.firestoreId).update(stamped({
                            time: Timestamp.fromDate(start),
                            endDate: Timestamp.fromDate(stored),
                            hasSpecificTime: true,
                        }));
                    } catch (e: any) {
                        // Spökrad i spegeln: dokumentet är raderat i Firestore.
                        if (e.code !== 5 && !/NOT_FOUND/.test(e.message ?? '')) throw e;
                        console.log('      (finns inte i Firestore - hoppas över)');
                        continue;
                    }
                }
                setEventTime(row.url, start.toISOString(), true);
                setEventEndDate(row.url, stored.toISOString());
            }
            fixed++;
        }
        await new Promise(r => setTimeout(r, 250)); // snäll mot sajten
    }

    console.log(`\n${fixed} tider rättade, ${unchanged} redan rätt, ${failed} misslyckade.`);
    if (APPLY) console.log('\n✅ Klart. Kör `npm run dedupe-cross -- --apply && npm run aggregate`.');
    process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
