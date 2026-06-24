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

import Database from 'better-sqlite3';
import { db } from '../config/firebase';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
    const stats: Record<string, string> = {};

    // ── 1. Totalt antal linkEvents — Firestore .count()-aggregering ──────────
    //    Billig (debiteras ~1 read per 1000 dokument) i stället för ett fullt
    //    collection-svep på ~20k+ dokument varje natt. Behåller "Totalt i
    //    Firebase"-semantiken exakt (alla dokument, inkl. hidden).
    try {
        if (db) {
            const agg = await db.collection('linkEvents').count().get();
            stats['STAT_TOTAL_EVENTS'] = String(agg.data().count);
        }
    } catch (err) {
        stats['STAT_FIREBASE_ERROR'] = String(err);
    }

    // ── 2. Hotspots + daglig fördelning — ur SQLite-spegeln (gratis) ─────────
    //    Tidigare lästes lat/lng/time per dokument ur samma Firestore-svep som
    //    ovan. Spegeln har samma data lokalt. Universat: kommande, synliga events
    //    (time >= idag, hidden = 0) — det clustringen/fördelningen faktiskt mäter
    //    (matchar konventionen i post-quality-stats.ts).
    try {
        const sqliteDb = new Database(path.resolve(__dirname, '../../events.db'), { readonly: true });
        try {
            const now = new Date();
            const todayStart = new Date(now);
            todayStart.setHours(0, 0, 0, 0);
            const weekEnd = new Date(todayStart);
            weekEnd.setDate(weekEnd.getDate() + 7);
            weekEnd.setHours(23, 59, 59, 999);

            const rows = sqliteDb.prepare(`
                SELECT lat, lng, time FROM link_events
                WHERE hidden = 0 AND time >= ?
            `).all(todayStart.toISOString()) as Array<{ lat: number | null; lng: number | null; time: string | null }>;

            // Dubblettkoordinater (>1 event på exakt samma lat/lng, 4 decimaler)
            const coordMap = new Map<string, number>();
            for (const r of rows) {
                if (r.lat && r.lng && r.lat !== 0 && r.lng !== 0) {
                    const key = `${Number(r.lat).toFixed(4)},${Number(r.lng).toFixed(4)}`;
                    coordMap.set(key, (coordMap.get(key) || 0) + 1);
                }
            }
            const hotspots = [...coordMap.entries()]
                .filter(([, count]) => count > 1)
                .sort((a, b) => b[1] - a[1]);
            stats['STAT_DUPLICATE_LOCATIONS'] = String(hotspots.length);
            stats['STAT_TOP_HOTSPOTS'] = hotspots.slice(0, 5)
                .map(([coord, count]) => `${coord}(${count}st)`)
                .join(', ') || 'inga';

            // Daglig fördelning (kommande 7 dagar)
            const dailyMap: Record<string, number> = {};
            for (let i = 0; i < 7; i++) {
                const d = new Date(todayStart);
                d.setDate(d.getDate() + i);
                dailyMap[d.toLocaleDateString('sv-SE', { weekday: 'short' })] = 0;
            }
            for (const r of rows) {
                if (!r.time) continue;
                const t = new Date(r.time);
                if (!isNaN(t.getTime()) && t >= todayStart && t <= weekEnd) {
                    const key = t.toLocaleDateString('sv-SE', { weekday: 'short' });
                    if (key in dailyMap) dailyMap[key]++;
                }
            }
            stats['STAT_DAILY_BREAKDOWN'] = Object.entries(dailyMap)
                .map(([day, count]) => `${day} ${count}`)
                .join(', ');
        } finally {
            sqliteDb.close();
        }
    } catch (err) {
        stats['STAT_SQLITE_ERROR'] = String(err);
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
