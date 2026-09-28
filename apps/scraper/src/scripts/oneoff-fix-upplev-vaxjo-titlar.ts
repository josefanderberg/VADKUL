/**
 * Engångsfix 2026-09-28: 19 upplev.vaxjo.se-event hette "Upplev Växjö".
 *
 * Sidornas första <h1> är sajtloggan, och cheerioFallback valde bara den h1
 * som matchade sidtitelns FÖRSTA segment. Eventnamn med eget bindestreck
 * ("Kicki i Soläng – en helt vanlig person från Småland") klövs, ingen h1
 * matchade och loggan vann. Grundorsaken är lagad i sitemap-enginen; det här
 * skriptet rättar raderna som redan finns (runnern skriver aldrig om titeln
 * på kända url:er).
 *
 * Kör:  npx ts-node src/scripts/oneoff-fix-upplev-vaxjo-titlar.ts [--apply]
 * Sedan: npm run aggregate
 */
import { db } from '../config/firebase';
import { stamped } from '../utils/firestoreStamp';
import { sqlite } from '../utils/sqliteHelper';
import { extractFromHtml } from '../sources/engines/sitemap';

const APPLY = process.argv.includes('--apply');
const PREFIX = 'https://upplev.vaxjo.se/evenemang/';
const LOGO_TITLE = 'Upplev Växjö';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

interface Row { url: string; title: string; firestoreId: string | null }

async function main() {
    if (!db) { console.error('❌ Firestore ej initialiserat.'); process.exit(1); }
    console.log(APPLY ? '✍️  APPLY - skriver till Firestore + SQLite\n' : '🔍 DRY-RUN (kör med --apply för att skriva)\n');

    const rows = sqlite.prepare(
        `SELECT url, title, firestoreId FROM link_events
         WHERE url LIKE ? AND title = ? AND time >= ? ORDER BY time`
    ).all(`${PREFIX}%`, LOGO_TITLE, new Date().toISOString().slice(0, 10)) as Row[];
    console.log(`${rows.length} kommande event med titeln "${LOGO_TITLE}".\n`);

    const setTitle = sqlite.prepare('UPDATE link_events SET title = ?, updatedAt = ? WHERE url = ?');
    let fixed = 0, skipped = 0;
    for (const row of rows) {
        let title: string | undefined;
        try {
            const res = await fetch(row.url, { headers: { 'User-Agent': UA } });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            title = extractFromHtml(await res.text(), row.url, 'Växjö')?.title;
        } catch (err: any) {
            console.log(`   ⚠️  ${row.url} - kunde inte hämta sidan (${err.message})`);
        }
        if (!title || title === LOGO_TITLE) { skipped++; continue; }

        console.log(`   ✏️  ${title}`);
        if (APPLY) {
            if (row.firestoreId) {
                try {
                    await db.collection('linkEvents').doc(row.firestoreId).update(stamped({ title }));
                } catch (e: any) {
                    // Spökrad i spegeln: dokumentet är raderat i Firestore.
                    if (e.code !== 5 && !/NOT_FOUND/.test(e.message ?? '')) throw e;
                    console.log('      (finns inte i Firestore - bara spegeln rättas)');
                }
            }
            setTitle.run(title, new Date().toISOString(), row.url);
        }
        fixed++;
        await new Promise(r => setTimeout(r, 250)); // snäll mot sajten
    }

    console.log(`\n${fixed} titlar rättade, ${skipped} hoppade över.`);
    if (APPLY) console.log('\n✅ Klart. Kör `npm run aggregate`.');
    process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
