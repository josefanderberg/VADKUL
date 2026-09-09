/**
 * invariants.ts — ren logik för datainvariant-vakten (check-invariants.ts).
 *
 * Vakten tittar på FÖRDELNINGEN av publicerbara framtida event per källa —
 * mönster som är osynliga per event men skriker i statistiken. Facit-fallet
 * är Kulturbolaget-datumkapningen (juli + 29/8 2026): varje event såg rimligt
 * ut för sig (riktig titel, venue, ett datum) men 56 event delade 7 unika
 * tidsstämplar eftersom "Rekommenderade evenemang"-widgetens microdata kapade
 * datumen. health.ts såg inget (körningen sparade 56, 0 fel) och LLM-auditen
 * såg inget (varje event var rimligt). Bara fördelningen avslöjade felet.
 *
 * Trösklarna jämför mot källans EGEN historik där sådan finns — "kl 19:00"
 * är genuint vanligt och festivaler klumpar legitimt, så absoluta tal utan
 * baslinje ger falsklarm. Utan historik gäller konservativa absolutgränser.
 */

export interface InvariantEventRow {
    hostName: string;
    /** ISO-8601 (link_events.time). */
    time: string;
    /** 1 = källan gav klockslag; 0/null = defaulttid. */
    hasSpecificTime: number | null;
    locationName: string | null;
}

export interface SourceMetrics {
    hostName: string;
    events: number;
    /** Event där källan gav klockslag — bara de bär tidssignal. */
    clockedEvents: number;
    /** Unika tidsstämplar bland eventen MED klockslag. */
    distinctTimes: number;
    /** Snitt event per unik tidsstämpel bland klockade event (KB-kapningen: 8.0).
     *  Skalfritt, till skillnad från en ratio: Tickster med 2010 event ligger
     *  legitimt på ~3.7 (många konserter börjar 19:00 samma kväll). */
    meanClusterSize: number;
    /** Största gruppen event med IDENTISK tidsstämpel och klockslag från källan. */
    largestClusterSize: number;
    largestClusterTime: string | null;
    /** Andel event utan klockslag (defaulttid), 0–100. */
    noClockPct: number;
    /** Vanligaste locationName:s andel, 0–100 (venue-kapningssignalen). */
    topVenueShare: number;
    topVenue: string | null;
}

/** Median av tidigare körningars metrics för samma källa (null = ingen historik). */
export interface SourceBaseline {
    meanClusterSize: number;
    noClockPct: number;
    largestClusterSize: number;
}

export interface InvariantFinding {
    hostName: string;
    /** 'alarm' → 🚨-rad i nattrapporten; 'info' → bara i --report/tabellen. */
    level: 'alarm' | 'info';
    rule: 'tidskluster' | 'likriktade-tider' | 'klockslag-tappade' | 'venue-koncentration';
    message: string;
}

/** Källor med färre framtida event än så här bedöms inte (för lite signal). */
export const MIN_EVENTS = 10;
/** Identiskt tidsstämpel-kluster (med klockslag) på minst så här många event larmar … */
export const CLUSTER_MIN_SIZE = 8;
/** … om klustret dessutom är minst så här stor andel av källans klockade event (%). */
export const CLUSTER_MIN_SHARE = 25;
/** Snitt klockade event per unik tidsstämpel som larmar (KB: 8.0; Tickster friskt ~3.7). */
export const MEAN_CLUSTER_ALARM = 4;
/** noClockPct-hopp över baslinjen (procentenheter) som larmar — strukturbyte på sidan. */
export const NO_CLOCK_JUMP = 40;
/** Kluster som är ≥ 3× källans egen baslinje larmar även under absoluttrösklarna. */
export const CLUSTER_BASELINE_FACTOR = 3;

export function computeSourceMetrics(rows: InvariantEventRow[]): SourceMetrics[] {
    const bySource = new Map<string, InvariantEventRow[]>();
    for (const r of rows) {
        if (!r.hostName) continue;
        const list = bySource.get(r.hostName);
        if (list) list.push(r); else bySource.set(r.hostName, [r]);
    }

    const out: SourceMetrics[] = [];
    for (const [hostName, evs] of bySource) {
        if (evs.length < MIN_EVENTS) continue;

        const clockedTimeCounts = new Map<string, number>();
        const venueCounts = new Map<string, number>();
        let noClock = 0;
        for (const e of evs) {
            if (e.hasSpecificTime === 1) {
                clockedTimeCounts.set(e.time, (clockedTimeCounts.get(e.time) ?? 0) + 1);
            } else {
                noClock++;
            }
            const venue = (e.locationName ?? '').trim();
            if (venue) venueCounts.set(venue, (venueCounts.get(venue) ?? 0) + 1);
        }

        let largestClusterSize = 0;
        let largestClusterTime: string | null = null;
        for (const [t, n] of clockedTimeCounts) {
            if (n > largestClusterSize) { largestClusterSize = n; largestClusterTime = t; }
        }
        let topVenueCount = 0;
        let topVenue: string | null = null;
        for (const [v, n] of venueCounts) {
            if (n > topVenueCount) { topVenueCount = n; topVenue = v; }
        }

        const clockedEvents = evs.length - noClock;
        out.push({
            hostName,
            events: evs.length,
            clockedEvents,
            distinctTimes: clockedTimeCounts.size,
            meanClusterSize: clockedTimeCounts.size > 0 ? clockedEvents / clockedTimeCounts.size : 0,
            largestClusterSize,
            largestClusterTime,
            noClockPct: Math.round((noClock / evs.length) * 100),
            topVenueShare: Math.round((topVenueCount / evs.length) * 100),
            topVenue,
        });
    }
    return out.sort((a, b) => b.events - a.events);
}

export function evaluateSource(m: SourceMetrics, baseline: SourceBaseline | null): InvariantFinding[] {
    const findings: InvariantFinding[] = [];
    const clusterShare = m.clockedEvents > 0 ? Math.round((m.largestClusterSize / m.clockedEvents) * 100) : 0;

    // 1. Tidskluster: många event med IDENTISK tidsstämpel trots att källan
    //    påstår sig ge klockslag. Kluster utan klockslag räknas inte —
    //    dagslösa event klumpar legitimt på defaulttiden.
    const absoluteHit = m.largestClusterSize >= CLUSTER_MIN_SIZE && clusterShare >= CLUSTER_MIN_SHARE;
    const baselineHit = baseline !== null
        && m.largestClusterSize >= CLUSTER_MIN_SIZE
        && m.largestClusterSize >= baseline.largestClusterSize * CLUSTER_BASELINE_FACTOR;
    if (absoluteHit || baselineHit) {
        findings.push({
            hostName: m.hostName,
            level: 'alarm',
            rule: 'tidskluster',
            message: `${m.hostName}: ${m.largestClusterSize} av ${m.clockedEvents} klockade event delar exakt ${m.largestClusterTime} (${clusterShare} %) — datumkapning? Jämför mot källsidan; receptet finns i purge-source-events.ts.`,
        });
    }

    // 2. Likriktade tider: högt SNITT event per unik tidsstämpel bland klockade
    //    event — fångar kapningar även när klustren är jämnt utsmetade (KB:
    //    56/7 = 8.0). Skalfritt: stora friska källor (Tickster ~3.7) går fria,
    //    och klockslagslösa festivalklumpar räknas inte alls.
    if (m.clockedEvents >= MIN_EVENTS && m.meanClusterSize >= MEAN_CLUSTER_ALARM) {
        findings.push({
            hostName: m.hostName,
            level: 'alarm',
            rule: 'likriktade-tider',
            message: `${m.hostName}: ${m.clockedEvents} klockade event på bara ${m.distinctTimes} unika tidsstämplar (snitt ${m.meanClusterSize.toFixed(1)}/stämpel) — misstänkt likriktning.`,
        });
    }

    // 3. Klockslag tappade: källan brukade ge tider men gör det inte längre —
    //    typiskt tecken på att sidan bytt struktur och parsern faller tillbaka.
    if (baseline !== null && m.noClockPct - baseline.noClockPct > NO_CLOCK_JUMP) {
        findings.push({
            hostName: m.hostName,
            level: 'alarm',
            rule: 'klockslag-tappade',
            message: `${m.hostName}: andel utan klockslag ${baseline.noClockPct} % → ${m.noClockPct} % — har sidan bytt struktur?`,
        });
    }

    // 4. Venue-koncentration: info-nivå (aldrig larm) — venue-källor som KB
    //    koncentrerar legitimt, men raden gör kapningar synliga vid granskning
    //    (Sisters of Mercy fick "Slagthuset" från widgeten i juli).
    if (m.topVenueShare >= 90 && m.events >= 15 && m.topVenue) {
        findings.push({
            hostName: m.hostName,
            level: 'info',
            rule: 'venue-koncentration',
            message: `${m.hostName}: ${m.topVenueShare} % av ${m.events} event på "${m.topVenue}".`,
        });
    }

    return findings;
}

/** Median över tidigare körningar → baslinje. Kräver minst 3 körningar. */
export function buildBaseline(history: SourceMetrics[]): SourceBaseline | null {
    if (history.length < 3) return null;
    const median = (xs: number[]): number => {
        const s = [...xs].sort((a, b) => a - b);
        const mid = Math.floor(s.length / 2);
        return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
    };
    return {
        meanClusterSize: median(history.map((h) => h.meanClusterSize)),
        noClockPct: median(history.map((h) => h.noClockPct)),
        largestClusterSize: median(history.map((h) => h.largestClusterSize)),
    };
}
