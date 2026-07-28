/**
 * Engångs-apply: läs titel→kategori-mappningar (JSON, producerade av
 * LLM-klassning 2026-07-28) och skriv på alla framtida 'other'-event med
 * matchande titel. Firestore i batchar + SQLite.
 *
 *   npx ts-node src/scripts/oneoff-apply-title-categories.ts <fil1.json> [fil2.json ...] [--apply]
 */

import * as fs from 'fs';
import { db } from '../config/firebase';
import { sqlite } from '../utils/sqliteHelper';
import { CANONICAL_CATEGORIES } from '../utils/categoryNormalize';

const APPLY = process.argv.includes('--apply');
const files = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const CANONICAL = new Set<string>(CANONICAL_CATEGORIES);

async function main() {
    const map = new Map<string, string>();
    for (const f of files) {
        const data = JSON.parse(fs.readFileSync(f, 'utf8')) as Record<string, string>;
        for (const [title, cat] of Object.entries(data)) {
            if (!CANONICAL.has(cat) || cat === 'other') continue;
            map.set(title.trim(), cat);
        }
    }
    console.log(`Mappningar inlästa: ${map.size} titlar från ${files.length} filer`);

    const rows = sqlite.prepare(`
        SELECT url, firestoreId, title FROM link_events
        WHERE category = 'other' AND hidden = 0 AND status = 'published'
          AND time >= datetime('now')
    `).all() as any[];

    const changes: { url: string; firestoreId?: string; cat: string }[] = [];
    const dist = new Map<string, number>();
    for (const r of rows) {
        const cat = map.get((r.title || '').trim());
        if (!cat) continue;
        changes.push({ url: r.url, firestoreId: r.firestoreId, cat });
        dist.set(cat, (dist.get(cat) ?? 0) + 1);
    }
    console.log(`Träffade event: ${changes.length} av ${rows.length} kvarvarande 'other'`);
    for (const [cat, n] of [...dist.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${cat}: ${n}`);

    if (!APPLY) { console.log('\nDry-run — kör med --apply för att skriva.'); return; }
    if (!db) throw new Error('Firestore ej initialiserat');

    const upd = sqlite.prepare('UPDATE link_events SET category = ? WHERE url = ?');
    for (const c of changes) upd.run(c.cat, c.url);

    let written = 0;
    for (let i = 0; i < changes.length; i += 450) {
        const batch = db.batch();
        for (const c of changes.slice(i, i + 450)) {
            if (!c.firestoreId) continue;
            batch.update(db.collection('linkEvents').doc(c.firestoreId), { category: c.cat });
        }
        await batch.commit();
        written += Math.min(450, changes.length - i);
    }
    console.log(`✅ Firestore: ${written} uppdaterade.`);
    process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
