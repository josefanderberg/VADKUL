/**
 * Audit: räkna hur många Facebook-events i DB har expired CDN-bilder.
 *
 * FB-bilder har `?oe=HEX` parameter med unix-stamp expiry. Vi kollar:
 *   - Hur många är redan expired (visas som trasig bild i appen)
 *   - Hur många löper ut inom 7 dagar (måste refreshas snart)
 *   - Hur många är giltiga >7 dagar
 *
 * Användning: npx ts-node src/scripts/check-fb-expired-images.ts
 */

import path from 'path';
import Database from 'better-sqlite3';

const db = new Database(path.resolve(__dirname, '../../events.db'), { readonly: true });

const rows = db.prepare(`
    SELECT url, title, coverImage FROM link_events
    WHERE hidden = 0 AND coverImage LIKE '%fbcdn.net%'
`).all() as { url: string; title: string; coverImage: string }[];

const now = Date.now();
const oneDayMs = 24 * 60 * 60 * 1000;
let expired = 0, expiringSoon = 0, valid = 0, noExpiry = 0;

for (const r of rows) {
    const m = r.coverImage.match(/[?&]oe=([0-9a-f]+)/i);
    if (!m) { noExpiry++; continue; }
    const exp = parseInt(m[1], 16) * 1000;
    if (!exp) { noExpiry++; continue; }
    const diff = exp - now;
    if (diff < 0) expired++;
    else if (diff < 7 * oneDayMs) expiringSoon++;
    else valid++;
}

console.log(`Facebook coverImage-audit (${rows.length} events totalt)\n`);
console.log(`  ❌ Expired (visas som trasiga):  ${expired}`);
console.log(`  ⏳ Expirar inom 7 dagar:         ${expiringSoon}`);
console.log(`  ✅ Giltig >7 dagar:               ${valid}`);
console.log(`  ?  Ingen expiry-stamp:            ${noExpiry}`);
console.log(`\nProblemet (expired + soon): ${expired + expiringSoon} av ${rows.length} (${Math.round(100 * (expired + expiringSoon) / rows.length)}%)`);
process.exit(0);
