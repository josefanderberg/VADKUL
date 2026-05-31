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

            // Grundläggande
            stats['STAT_FB_UNIQUE_URLS']    = String(kw.totalUniqueUrls ?? kw.discovery?.totalUniqueUrls ?? 0);
            stats['STAT_FB_DUPLICATE_HITS'] = String(kw.totalDuplicateHits ?? kw.discovery?.totalDuplicateHits ?? 0);
            stats['STAT_FB_DURATION_MIN']   = String(kw.durationMinutes ?? 'n/a');

            // Health score
            stats['STAT_FB_HEALTH_SCORE'] = String(kw.healthScore ?? 'n/a');

            // Discovery-fas
            const disc = kw.discovery;
            if (disc) {
                stats['STAT_FB_QUERIES_TOTAL']     = String(disc.totalQueries ?? 0);
                stats['STAT_FB_HIT_RATE_PCT']      = String(disc.hitRatePct ?? 'n/a');
                stats['STAT_FB_CAP_RATE_PCT']      = String(disc.capRatePct ?? 'n/a');
                stats['STAT_FB_ZERO_RATE_PCT']     = String(disc.zeroRatePct ?? 'n/a');
                stats['STAT_FB_AVG_FOUND']         = String(disc.avgFoundPerQuery ?? 'n/a');
                stats['STAT_FB_DEDUP_RATE_PCT']    = String(disc.dedupRatePct ?? 'n/a');
                stats['STAT_FB_CITIES_COVERAGE']   = disc.cities
                    ? `${disc.cities.withHits}/${disc.cities.searched} (${disc.cities.coveragePct}%)`
                    : 'n/a';
                stats['STAT_FB_CITIES_AT_CAP']     = String(disc.cities?.atCap ?? 'n/a');
                stats['STAT_FB_DEAD_KEYWORDS']     = String(disc.keywords?.deadCount ?? 'n/a');
            }

            // Extraction-fas
            const ext = kw.extraction;
            if (ext) {
                stats['STAT_FB_EXTRACT_TOTAL']     = String(ext.totalToProcess ?? 0);
                stats['STAT_FB_EXTRACT_NEW']       = String(ext.newUrls ?? 0);
                stats['STAT_FB_EXTRACT_SAVED']     = String(ext.newlySaved ?? 0);
                stats['STAT_FB_EXTRACT_FOREIGN']   = String(ext.skippedForeign ?? 0);
                stats['STAT_FB_EXTRACT_DATE_SKIP'] = String(ext.skippedDate ?? 0);
                stats['STAT_FB_EXTRACT_FAILED']    = String(ext.failed ?? 0);
                stats['STAT_FB_EXTRACT_SUCCESS_PCT'] = String(ext.successRatePct ?? 'n/a');
                stats['STAT_FB_EVENTS_IN_LOG']     = String(ext.eventsInLog ?? 0);
            }

            // Top 5 mest givande sökord (exkl. städer)
            const top5kw: string[] = ((kw.perKeywordTotals || []) as any[])
                .filter((k: any) => k.type === 'keyword' || !/^[A-ZÅÄÖ]/.test(k.keyword))
                .slice(0, 5)
                .map((k: any) => `${k.keyword}(${k.unique})`);
            stats['STAT_FB_TOP_KEYWORDS'] = top5kw.join(', ') || 'n/a';

            // Top 5 städer
            const top5cities: string[] = ((kw.perKeywordTotals || []) as any[])
                .filter((k: any) => k.type === 'city' || /^[A-ZÅÄÖ]/.test(k.keyword))
                .slice(0, 5)
                .map((k: any) => `${k.keyword}(${k.unique})`);
            stats['STAT_FB_TOP_CITIES'] = top5cities.join(', ') || 'n/a';

            // Körningshistorik — trend (senaste 3 körningar)
            const histPath = path.resolve(__dirname, '../../scraper_run_history.json');
            if (fs.existsSync(histPath)) {
                const history: any[] = JSON.parse(fs.readFileSync(histPath, 'utf-8'));
                const recent = history.slice(-3).reverse();
                stats['STAT_FB_HISTORY_HEALTH'] = recent
                    .map((r: any) => `${r.runDate}:${r.healthScore ?? '?'}`)
                    .join(', ');
                stats['STAT_FB_HISTORY_URLS'] = recent
                    .map((r: any) => `${r.runDate}:${r.discovery?.totalUniqueUrls ?? '?'}`)
                    .join(', ');
            }

            // Filålder
            const mtime = fs.statSync(kwPath).mtime;
            const ageHours = (Date.now() - mtime.getTime()) / 3600000;
            stats['STAT_FB_STATS_AGE_H'] = ageHours.toFixed(1);
        } else {
            stats['STAT_FB_UNIQUE_URLS']  = 'n/a';
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
