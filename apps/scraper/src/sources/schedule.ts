/**
 * Schemaläggare för Sources — bestämmer vilka källor som ska köras inatt.
 *
 * Tanken: vid 300+ källor vill vi inte hamra alla varje natt — men vi vill
 * heller inte ha klump-dagar. Varje källa får en deterministisk FAS ur en
 * hash av sitt id, och körs när dagnumret träffar fasen:
 *
 *   körs ikväll  ⇔  localDayNumber(today) % cadence === fnv1a(id) % cadence
 *
 * Det sprider every-3d-källor jämnt över 3 nätter och weekly över 7 — varje
 * natt får ~1/3 av alla every-3d + ~1/7 av alla weekly. Inga tomma nätter,
 * inga peak-nätter (gamla schemat körde ALLA every-3d sön/mån/tor och ALLA
 * weekly på onsdag → tis/fre/lör hade 12 källor, sön/mån/tor ~198).
 *
 * Frekvenser (kadens i dagar):
 *   - hourly    1  — alltid (för cron-jobb som körs flera ggr/dag)
 *   - daily     1  — varje natt
 *   - every-3d  3  — var tredje natt (fas-spridd)
 *   - weekly    7  — en natt i veckan (fas-spridd)
 *   - biweekly 14  — varannan vecka (långhorisont-venues: operahus/konserthus
 *                    som publicerar hela säsonger månader i förväg)
 *
 * Refresh-körningar: var 4:e körning per källa är en FULL-refresh där
 * skip-känt-URL-optimeringen stängs av, så ändrade/inställda event fångas
 * (sitemap-motorn hoppar annars över detaljsidor vi redan har i DB).
 */

import { Source } from './types';
import { applyQuarantine } from './quarantine';

const CADENCE_DAYS: Record<string, number> = {
    hourly: 1,
    daily: 1,
    'every-3d': 3,
    weekly: 7,
    biweekly: 14,
};

/** Var N:e körning är en full-refresh (skip-känt avstängt). */
const REFRESH_EVERY_NTH_RUN = 4;

/** FNV-1a 32-bit — deterministisk, snabb, jämn spridning för korta id-strängar. */
export function fnv1a(str: string): number {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
}

/**
 * Lokalt dagnummer — dagar sedan epoch räknat på LOKALA kalenderdatumet.
 * Flippar vid lokal midnatt (inte UTC), så en körning som startar 00:30
 * svensk tid får ett stabilt "inatt"-nummer.
 */
export function localDayNumber(d: Date): number {
    return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000);
}

function cadenceOf(source: Source): number {
    return CADENCE_DAYS[source.updateFrequency ?? 'daily'] ?? 1;
}

export function shouldRunToday(source: Source, today: Date = new Date()): boolean {
    if (source.disabled) return false;
    if (source.status === 'dead') return false;  // bevisat tom — proba aldrig om
    const cadence = cadenceOf(source);
    if (cadence === 1) return true;
    const phase = fnv1a(source.id) % cadence;
    return localDayNumber(today) % cadence === phase;
}

/**
 * Är dagens körning en FULL-refresh för källan? Var 4:e körning (fas-spridd
 * med egen hash så refresh-nätterna inte klumpar sig) ska motorn re-fetcha
 * även kända URL:er — annars upptäcks aldrig flyttade/ändrade event för
 * detaljsidor vi redan har i DB.
 *
 * runIndex ökar med 1 per schemalagd körning (dagnummer / kadens), så
 * "var 4:e körning" blir: daily → var 4:e natt, every-3d → var 12:e natt,
 * weekly → var 4:e vecka.
 */
export function isRefreshRun(source: Source, today: Date = new Date()): boolean {
    const cadence = cadenceOf(source);
    const runIndex = Math.floor(localDayNumber(today) / cadence);
    const offset = fnv1a(`${source.id}:refresh`) % REFRESH_EVERY_NTH_RUN;
    return (runIndex + offset) % REFRESH_EVERY_NTH_RUN === 0;
}

/**
 * Filtrera ut källor som ska köras idag enligt sin frekvens + fas,
 * minus auto-karantänen (se sources/quarantine.ts). Karantänsatta källor
 * hålls pausade utom sin vecko-retry; manuella --ids-körningar går inte
 * genom denna funktion och påverkas alltså aldrig.
 */
export function scheduledForToday(sources: Source[], today: Date = new Date()): Source[] {
    const scheduled = sources.filter((s) => shouldRunToday(s, today));
    const { run, retrying, held } = applyQuarantine(scheduled, today);
    if (held.length || retrying.length) {
        console.log(
            `⏸️  Karantän: ${held.length} pausade` +
            (retrying.length ? `, ${retrying.length} vecko-retry (${retrying.map((s) => s.id).join(', ')})` : ''),
        );
    }
    return [...run, ...retrying];
}

/**
 * Gruppvis sammanfattning av schedule (för logging/debugging).
 */
export function summarizeSchedule(sources: Source[], today: Date = new Date()): string {
    const groups: Record<string, { run: number; skip: number }> = {};
    for (const s of sources) {
        const freq = s.updateFrequency ?? 'daily';
        if (!groups[freq]) groups[freq] = { run: 0, skip: 0 };
        if (shouldRunToday(s, today)) groups[freq].run++;
        else groups[freq].skip++;
    }
    const day = ['sön', 'mån', 'tis', 'ons', 'tor', 'fre', 'lör'][today.getDay()];
    const total = sources.length;
    const willRun = sources.filter((s) => shouldRunToday(s, today)).length;
    const refreshing = sources.filter((s) => shouldRunToday(s, today) && isRefreshRun(s, today)).length;
    const lines = [`Schedule (${day}, dag ${localDayNumber(today)}): ${willRun}/${total} källor körs inatt (${refreshing} som full-refresh)`];
    for (const [freq, { run, skip }] of Object.entries(groups)) {
        lines.push(`  ${freq.padEnd(10)} ${run} runs / ${skip} skips`);
    }
    return lines.join('\n');
}
