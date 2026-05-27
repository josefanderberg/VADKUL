/**
 * post-run-stats.ts
 *
 * Körs av run-daily.sh efter varje scraper-körning.
 * Hämtar statistik från Firebase och keyword_stats.json och skriver
 * en sammanfattning till stdout som run-daily.sh kan plocket upp.
 *
 * Output-format (stdout, en rad per stat):
 *   STAT_DUPLICATE_LOCATIONS=12
 *   STAT_TOTAL_EVENTS=345
 *   STAT_FB_UNIQUE_URLS=88
 *   STAT_FB_DUPLICATE_HITS=204
 *   STAT_FB_TOP_KEYWORDS=konsert(14),live(11),kväll(9)
 *   STAT_FB_SAVED=6
 *   STAT_DAILY_BREAKDOWN=mån 3,tis 7,ons 2,...
 */

import { db } from '../config/firebase';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
    const stats: Record<string, string> = {};

    // ── 1. Firebase: totalt antal linkEvents ─────────────────────────────────
    try {
        if (db) {
            const snapshot = await db.collection('linkEvents').get();
            const totalEvents = snapshot.size;
            stats['STAT_TOTAL_EVENTS'] = String(totalEvents);

            // ── 2. Dubblettkoordinater (>1 event på exakt samma lat/lng) ────────
            const coordMap = new Map<string, number>();
            snapshot.docs.forEach(doc => {
                const d = doc.data();
                const lat = d.lat;
                const lng = d.lng;
                if (lat && lng && lat !== 0 && lng !== 0) {
                    const key = `${Number(lat).toFixed(4)},${Number(lng).toFixed(4)}`;
                    coordMap.set(key, (coordMap.get(key) || 0) + 1);
                }
            });

            // Platser med mer än 1 event
            const hotspots = [...coordMap.entries()]
                .filter(([, count]) => count > 1)
                .sort((a, b) => b[1] - a[1]);

            stats['STAT_DUPLICATE_LOCATIONS'] = String(hotspots.length);

            // Top 5 platser med flest events
            const top5 = hotspots.slice(0, 5)
                .map(([coord, count]) => `${coord}(${count}st)`)
                .join(', ');
            stats['STAT_TOP_HOTSPOTS'] = top5 || 'inga';

            // ── 3. Daglig fördelning (kommande 7 dagar) ──────────────────────
            const now = new Date();
            const todayStart = new Date(now);
            todayStart.setHours(0, 0, 0, 0);
            const weekEnd = new Date(todayStart);
            weekEnd.setDate(weekEnd.getDate() + 7);
            weekEnd.setHours(23, 59, 59, 999);

            const dailyMap: Record<string, number> = {};
            for (let i = 0; i < 7; i++) {
                const d = new Date(todayStart);
                d.setDate(d.getDate() + i);
                const key = d.toLocaleDateString('sv-SE', { weekday: 'short' });
                dailyMap[key] = 0;
            }

            snapshot.docs.forEach(doc => {
                const d = doc.data();
                let t: Date | null = null;
                if (d.time?.toDate) t = d.time.toDate();
                else if (d.time) t = new Date(d.time);
                if (t && t >= todayStart && t <= weekEnd) {
                    const key = t.toLocaleDateString('sv-SE', { weekday: 'short' });
                    if (key in dailyMap) dailyMap[key]++;
                }
            });

            stats['STAT_DAILY_BREAKDOWN'] = Object.entries(dailyMap)
                .map(([day, count]) => `${day} ${count}`)
                .join(', ');
        }
    } catch (err) {
        stats['STAT_FIREBASE_ERROR'] = String(err);
    }

    // ── 4. Facebook keyword_stats.json ────────────────────────────────────────
    try {
        const kwPath = path.resolve(__dirname, '../../keyword_stats.json');
        if (fs.existsSync(kwPath)) {
            const kw = JSON.parse(fs.readFileSync(kwPath, 'utf-8'));
            stats['STAT_FB_UNIQUE_URLS'] = String(kw.totalUniqueUrls ?? 0);
            stats['STAT_FB_DUPLICATE_HITS'] = String(kw.totalDuplicateHits ?? 0);

            // Top 5 mest givande sökord
            const top5kw: string[] = (kw.perKeywordTotals || [])
                .slice(0, 5)
                .map((k: any) => `${k.keyword}(${k.unique})`);
            stats['STAT_FB_TOP_KEYWORDS'] = top5kw.join(', ') || 'n/a';

            // Hur gammal är filen? (för att veta om FB kördes idag)
            const mtime = fs.statSync(kwPath).mtime;
            const ageHours = (Date.now() - mtime.getTime()) / 3600000;
            stats['STAT_FB_STATS_AGE_H'] = ageHours.toFixed(1);
        } else {
            stats['STAT_FB_UNIQUE_URLS'] = 'n/a';
            stats['STAT_FB_DUPLICATE_HITS'] = 'n/a';
            stats['STAT_FB_TOP_KEYWORDS'] = 'n/a';
        }
    } catch (err) {
        stats['STAT_FB_ERROR'] = String(err);
    }

    // ── Output ────────────────────────────────────────────────────────────────
    for (const [key, value] of Object.entries(stats)) {
        process.stdout.write(`${key}=${value}\n`);
    }
    process.exit(0);
}

main().catch(err => {
    console.error('post-run-stats error:', err);
    process.exit(1);
});
