/**
 * Cleanup-junk-titles: raderar prod-events som matchar title-blacklist.
 *
 * Vi upptäckte att 31x "Nyköpings kommuns webbplats", 12x "Startsida" m.fl.
 * sparades INNAN title-blacklist appliceras även på JSON-LD-källa. Detta
 * städar det som redan landat.
 *
 * Användning:
 *   npx ts-node src/scripts/cleanup-junk-titles.ts            # dry-run
 *   npx ts-node src/scripts/cleanup-junk-titles.ts --apply
 */

import { db } from '../config/firebase';

const APPLY = process.argv.includes('--apply');

// Samma blacklist som i sitemap-engine
const TITLE_BLACKLIST: RegExp[] = [
    /^startsida$/i,
    /^hem$/i,
    /^vi (använder|anvander) kakor/i,
    /^cookie/i,
    /^sok\s*resultat/i,
    /^404\b/,
    /^\d+ parkeringar.*avst[äa]ngd/i,
    /trafikst[öo]rning/i,
    /v[äa]garbete/i,
    /\bkommuns?\s+webbplats\b/i,
    /\bofficiella?\s+webbplats\b/i,
    /^trafikstart/i,
    /^\d+\s+(parkering|p-plats|p-rute)/i,
    /\bv[äa]g(en|s|arna)?\s+avst[äa]ngd/i,
];

async function main() {
    if (!db) throw new Error('Firebase ej init');
    console.log(APPLY ? '🔧 APPLY' : '🔍 DRY-RUN');

    const snap = await db.collection('linkEvents').get();
    const matches: { id: string; title: string; location: string }[] = [];
    for (const doc of snap.docs) {
        const data = doc.data();
        const title = data.title || '';
        if (TITLE_BLACKLIST.some(re => re.test(title))) {
            matches.push({ id: doc.id, title, location: data.locationName || '-' });
        }
    }

    console.log(`\nMatchade junk-events: ${matches.length}`);
    // Gruppera per titel för översikt
    const byTitle = new Map<string, number>();
    for (const m of matches) byTitle.set(m.title, (byTitle.get(m.title) || 0) + 1);
    const sorted = [...byTitle.entries()].sort((a, b) => b[1] - a[1]);
    for (const [t, n] of sorted.slice(0, 20)) {
        console.log(`  ${String(n).padStart(3)}x  ${t.slice(0, 70)}`);
    }
    if (sorted.length > 20) console.log(`  ... och ${sorted.length - 20} fler titlar`);

    if (!APPLY) {
        console.log('\nKör med --apply för att radera.');
        process.exit(0);
    }

    // Batcha 400 ops per commit (Firestore-gräns 500)
    let deleted = 0;
    for (let i = 0; i < matches.length; i += 400) {
        const batch = db.batch();
        const slice = matches.slice(i, i + 400);
        for (const m of slice) batch.delete(db.collection('linkEvents').doc(m.id));
        await batch.commit();
        deleted += slice.length;
        console.log(`  ...raderade ${deleted}/${matches.length}`);
    }
    console.log(`\n✅ Raderade ${deleted} junk-events från prod.`);
    process.exit(0);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
