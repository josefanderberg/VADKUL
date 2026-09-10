/**
 * analyze-popular.ts — kalibreringsunderlag för 🔥 Populära-klassningen.
 *
 * Dry-run, read-only: läser LOKALA SQLite med exakt samma WHERE som
 * aggregate-events (kör `npm run sync-to-sqlite` först — gammal spegel ger
 * fel andelar) och skriver ut räknade golv, inga tyckanden. Ägaren läser
 * utfallet och sätter POPULAR_THRESHOLD i utils/popularEvent.ts.
 *
 * Användning:
 *   npx ts-node src/scripts/analyze-popular.ts                # tröskel från koden
 *   npx ts-node src/scripts/analyze-popular.ts --threshold=25 # prova en annan
 */

import path from 'path';
import Database from 'better-sqlite3';
import {
    buildTitleFreq, normTitlePop, popularScore, isVetoed,
    POPULAR_THRESHOLD, PopularInput,
} from '../utils/popularEvent';
import { CITIES, distKm } from './city-gaps';

const CITY_RADIUS_KM = 30;   // samma default som city-gaps

interface Row {
    url: string; title: string | null; time: string; category: string | null;
    hasSpecificTime: number | null; coverImage: string | null; price: string | null;
    attendees: number | null; hostName: string | null; locationName: string | null;
    lat: number | null; lng: number | null;
}

function main() {
    const thresholdArg = process.argv.find(a => a.startsWith('--threshold='));
    const threshold = thresholdArg ? Number(thresholdArg.split('=')[1]) : POPULAR_THRESHOLD;

    const sqlite = new Database(path.resolve(__dirname, '../../events.db'), { readonly: true });
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const rows = sqlite.prepare(`
        SELECT url, title, time, category, hasSpecificTime, coverImage, price,
               attendees, hostName, locationName, lat, lng
        FROM link_events
        WHERE hidden = 0 AND status = 'published' AND time >= ?
        ORDER BY time ASC
    `).all(now.toISOString()) as Row[];

    const titleFreq = buildTitleFreq(rows);

    type Scored = { row: Row; input: PopularInput; score: number; vetoed: boolean; pop: boolean };
    const scored: Scored[] = rows.filter(r => r.url).map(row => {
        // Samma midnatts-heuristik som aggregate-events för legacy-rader.
        const t = new Date(row.time);
        const hasSpecificTime = row.hasSpecificTime != null
            ? row.hasSpecificTime === 1
            : !((t.getHours() === 0 && t.getMinutes() === 0) || (t.getUTCHours() === 0 && t.getUTCMinutes() === 0));
        const input: PopularInput = {
            url: row.url, title: row.title || '', time: row.time,
            category: row.category || 'other', hasSpecificTime,
            coverImage: row.coverImage, price: row.price,
            attendees: Number(row.attendees) || 0,
            locationName: row.locationName,
        };
        const rc = titleFreq.get(normTitlePop(input.title)) ?? 1;
        const score = popularScore(input, rc);
        const vetoed = isVetoed(input);
        const pop = !vetoed && score >= threshold;
        return { row, input, score, vetoed, pop };
    });

    const flagged = scored.filter(s => s.pop);
    const pct = (n: number, of: number) => of ? `${(n / of * 100).toFixed(1)} %` : '–';

    const nonVetoScores = scored.filter(s => !s.vetoed).map(s => s.score).sort((a, b) => a - b);
    const perc = (p: number) => nonVetoScores.length
        ? nonVetoScores[Math.min(nonVetoScores.length - 1, Math.floor(p / 100 * nonVetoScores.length))]
        : 0;

    console.log(`\nNATIONELLT: ${scored.length} event · ${flagged.length} flaggade (${pct(flagged.length, scored.length)}) · tröskel ${threshold}`);
    console.log(`Vetade: ${scored.filter(s => s.vetoed).length} (opt-in/brus/småvärd-domän)`);
    console.log(`Poängfördelning (ej vetade): p10=${perc(10)} p25=${perc(25)} p50=${perc(50)} p75=${perc(75)} p90=${perc(90)} p99=${perc(99)}`);

    console.log(`\nPER STAD (topp 30 efter eventantal, radie ${CITY_RADIUS_KM} km):`);
    const cityRows = CITIES.map(c => {
        let total = 0, pop = 0;
        for (const s of scored) {
            if (s.row.lat == null || s.row.lng == null) continue;
            if (distKm(c.lat, c.lng, s.row.lat, s.row.lng) > CITY_RADIUS_KM) continue;
            total++;
            if (s.pop) pop++;
        }
        return { name: c.name, total, pop };
    }).sort((a, b) => b.total - a.total).slice(0, 30);
    for (const c of cityRows) {
        console.log(`  ${c.name.padEnd(14)} ${String(c.total).padStart(5)} event · ${String(c.pop).padStart(4)} pop (${pct(c.pop, c.total)})`);
    }

    const line = (s: Scored) =>
        `  ${String(s.score).padStart(4)} · ${(s.input.title || '(utan titel)').slice(0, 52).padEnd(52)} · ${(s.input.category || '').padEnd(8)} · ${(s.row.hostName || '').slice(0, 24).padEnd(24)} · ${s.input.time.slice(0, 10)}`;

    console.log('\nTOPP 20 FLAGGADE:');
    [...flagged].sort((a, b) => b.score - a.score).slice(0, 20).forEach(s => console.log(line(s)));

    console.log(`\nGRÄNSFALL — 10 närmast ÖVER tröskeln (${threshold}):`);
    [...flagged].sort((a, b) => a.score - b.score).slice(0, 10).forEach(s => console.log(line(s)));
    console.log(`\nGRÄNSFALL — 10 närmast UNDER tröskeln:`);
    scored.filter(s => !s.vetoed && s.score < threshold)
        .sort((a, b) => b.score - a.score).slice(0, 10).forEach(s => console.log(line(s)));

    console.log('\nHÖGST POÄNG BLAND VETADE (sanity — fångar vetona rätt saker?):');
    scored.filter(s => s.vetoed).sort((a, b) => b.score - a.score).slice(0, 10).forEach(s => console.log(line(s)));

    console.log('');
}

main();
