/**
 * Schemaläggare för Sources — bestämmer vilka källor som ska köras idag.
 *
 * Tanken: vid 300 källor vill vi inte hamra alla varje natt. Vi delar ut dem
 * deterministiskt över veckan baserat på `updateFrequency`.
 *
 * Frekvenser:
 *   - hourly    — alltid (för cron-jobb som körs flera ggr/dag)
 *   - daily     — varje dag
 *   - every-3d  — mån/tor (dag 0, 3, 6 i veckan)
 *   - weekly    — onsdag (dag 3 i veckan)
 *
 * Spridning per veckodag (söndag=0, måndag=1, ..., lördag=6):
 *
 *   Dag    | Daily | Every-3d | Weekly
 *   Mån(1) |  ✓    |   ✓      |
 *   Tis(2) |  ✓    |          |
 *   Ons(3) |  ✓    |          |   ✓
 *   Tor(4) |  ✓    |   ✓      |
 *   Fre(5) |  ✓    |          |
 *   Lör(6) |  ✓    |          |
 *   Sön(0) |  ✓    |   ✓      |
 *
 * En weekly-källa körs en gång/vecka. En every-3d körs ~2.3 ggr/vecka.
 */

import { Source } from './types';

export function shouldRunToday(source: Source, today: Date = new Date()): boolean {
    if (source.disabled) return false;
    if (source.status === 'dead') return false;  // bevisat tom — proba aldrig om
    const freq = source.updateFrequency ?? 'daily';
    if (freq === 'hourly' || freq === 'daily') return true;

    const dayOfWeek = today.getDay(); // 0=söndag .. 6=lördag

    if (freq === 'every-3d') {
        // Sön, Mån, Tor — ungefär var 3:e dag
        return dayOfWeek === 0 || dayOfWeek === 1 || dayOfWeek === 4;
    }
    if (freq === 'weekly') {
        // Onsdag (mitten av veckan)
        return dayOfWeek === 3;
    }
    return true;
}

/**
 * Filtrera ut källor som ska köras idag enligt sin frekvens.
 */
export function scheduledForToday(sources: Source[], today: Date = new Date()): Source[] {
    return sources.filter((s) => shouldRunToday(s, today));
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
    const lines = [`Schedule (${day}): ${willRun}/${total} källor körs idag`];
    for (const [freq, { run, skip }] of Object.entries(groups)) {
        lines.push(`  ${freq.padEnd(10)} ${run} runs / ${skip} skips`);
    }
    return lines.join('\n');
}
