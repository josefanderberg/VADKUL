/**
 * scraperAlerts — EN samlad lista över skrapproblem som behöver en människa.
 *
 * Bakgrund (28/9 2026): felen upptäcktes redan — invariant-vakten larmade om
 * Malmö Live, auto-karantänen pausade Visit Isabergsregionen — men signalerna
 * låg utspridda i Telegram-rapporter och nattloggar och glömdes. Den här
 * modulen slår ihop dem till en lista som nattkedjan skriver till
 * scraper-alerts.json och som `npm run dev` skriver ut lokalt.
 *
 * Rena funktioner — all IO bor i scripts/scraper-alerts.ts.
 */

export type AlertLevel = 'fel' | 'varning';
export type AlertKind = 'krasch' | 'tyst' | 'volymras' | 'karantan' | 'datumkluster' | 'nollkoordinat' | 'utlandskoordinat' | 'invariant';

export interface Alert {
    level: AlertLevel;
    kind: AlertKind;
    /** Käll-id (scrape_runs.source_id) eller hostName när källan saknas. */
    source: string;
    message: string;
    /** ISO-datum då problemet började, när det är känt. */
    since?: string;
}

export interface RunRow {
    source_id: string;
    host_name?: string | null;
    started_at: string;
    found: number;
    skipped_duplicate: number;
    error_count: number;
    first_error?: string | null;
}

/** Så många körningar i rad utan livstecken innan en källa räknas som tyst. */
export const SILENT_RUNS = 3;

/**
 * Källor som slutat ge något, och källor vars senaste körning kraschade.
 * `runs` ska vara nyast först per källa. Karantänsatta/avstängda hoppas —
 * de rapporteras separat eller är medvetet av.
 */
export function detectRunProblems(
    runsBySource: Map<string, RunRow[]>,
    skip: Set<string>,
): Alert[] {
    const out: Alert[] = [];
    for (const [id, runs] of runsBySource) {
        if (skip.has(id) || runs.length === 0) continue;
        const last = runs[0];
        if (last.error_count > 0 && last.found === 0) {
            out.push({
                level: 'fel', kind: 'krasch', source: id, since: last.started_at.slice(0, 10),
                message: `senaste körningen gav 0 event och fel: ${(last.first_error ?? 'okänt fel').slice(0, 140)}`,
            });
            continue;
        }
        if (runs.length <= SILENT_RUNS) continue;
        const recent = runs.slice(0, SILENT_RUNS);
        // Dubbletter = källan lever, den hade bara inget nytt (runner.ts räknar
        // numera även motorns före-fetch-skippar som dubbletter).
        const dead = recent.every((r) => r.found === 0 && r.skipped_duplicate === 0 && r.error_count === 0);
        const before = runs.slice(SILENT_RUNS).find((r) => r.found > 0);
        if (dead && before) {
            out.push({
                level: 'varning', kind: 'tyst', source: id, since: recent[recent.length - 1].started_at.slice(0, 10),
                message: `gav ${before.found} event ${before.started_at.slice(0, 10)}, 0 de ${SILENT_RUNS} senaste körningarna — bytt URL-struktur/blockerad?`,
            });
        }
    }
    return out;
}

/** Så många körningar som bedöms, och så gammal måste jämförelsen vara. */
export const DROP_RECENT_RUNS = 3;
export const DROP_BASELINE_AGE_DAYS = 14;
/** Under den här andelen av källans egen nivå räknas som ett ras. */
export const DROP_SHARE = 0.4;
/** Källor som aldrig gett fler än så här per körning är för små att döma. */
export const DROP_MIN_BASELINE = 20;

const median = (xs: number[]): number => {
    const s = [...xs].sort((a, b) => a - b);
    return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

/**
 * Vad körningen SÅG. `found` är bara det motorn returnerade — en motor som
 * hoppar över kända adresser före hämtning returnerar tre nya event en vanlig
 * natt och 150 på var fjärde (full-refresh). Runnern bokför de överhoppade som
 * dubbletter, så det största av de två talen är det stabila måttet.
 */
export const seenVolume = (r: RunRow): number => Math.max(r.found, r.skipped_duplicate);

/**
 * Källor som LEVER men tappat det mesta — luckan mellan "tyst" (0 event) och
 * frisk. Naturskyddsföreningen gav 27 av 239 event i två veckor (14/11 2026):
 * en regex släppte bara igenom vart tionde, källan såg levande ut, och
 * registrets golv (expectedMinEvents: 100) lästes inte av någon.
 *
 * Två mått, i den ordningen:
 *   1. Registrets golv: de senaste körningarna ligger under expectedMinEvents.
 *   2. Källans egen nivå: under 40 % av medianen för körningar som är minst
 *      två veckor gamla. Fångar ras även där inget golv är satt.
 * Medianen över tre körningar, så en enstaka dålig natt larmar inte. Källor
 * som redan är tysta (0) har sitt eget larm och hoppas här.
 * `runs` nyast först per källa; `now` för testbarhet.
 */
export function detectVolumeDrops(
    runsBySource: Map<string, RunRow[]>,
    skip: Set<string>,
    floors: Map<string, number> = new Map(),
    now: Date = new Date(),
): Alert[] {
    const out: Alert[] = [];
    const cutoff = now.getTime() - DROP_BASELINE_AGE_DAYS * 86_400_000;
    for (const [id, runs] of runsBySource) {
        if (skip.has(id) || runs.length < DROP_RECENT_RUNS) continue;
        const recentRuns = runs.slice(0, DROP_RECENT_RUNS);
        const recent = median(recentRuns.map(seenVolume));
        if (recent === 0) continue;   // tyst/krasch — eget larm
        const since = recentRuns[recentRuns.length - 1].started_at.slice(0, 10);

        const floor = floors.get(id);
        if (floor !== undefined && recent < floor) {
            out.push({
                level: 'varning', kind: 'volymras', source: id, since,
                message: `ger ${Math.round(recent)} event per körning, under källans golv ${floor} (expectedMinEvents) — tappar tolkningen event?`,
            });
            continue;
        }
        const older = runs.filter((r) => new Date(r.started_at).getTime() < cutoff).map(seenVolume);
        if (older.length < 4) continue;
        const baseline = median(older);
        if (baseline >= DROP_MIN_BASELINE && recent < baseline * DROP_SHARE) {
            out.push({
                level: 'varning', kind: 'volymras', source: id, since,
                message: `ger ${Math.round(recent)} event per körning mot ${Math.round(baseline)} tidigare — ändrad sajt, eller tolkningen tappar event?`,
            });
        }
    }
    return out;
}

/**
 * Många olika event på SAMMA dag — typiskt ett sajtvitt datum (banner,
 * "Andra event"-kort) som fritext-parsern tagit. Invariant-vakten ser
 * identiska TIDSSTÄMPLAR; Malmö Live 28/9 hade olika klockslag på samma dag.
 */
export function detectDayClusters(
    rows: { host: string; day: string }[],
    minEvents = 10,
    share = 0.6,
): Alert[] {
    const byHost = new Map<string, Map<string, number>>();
    for (const r of rows) {
        const m = byHost.get(r.host) ?? new Map<string, number>();
        m.set(r.day, (m.get(r.day) ?? 0) + 1);
        byHost.set(r.host, m);
    }
    const out: Alert[] = [];
    for (const [host, days] of byHost) {
        const total = [...days.values()].reduce((a, b) => a + b, 0);
        if (total < minEvents) continue;
        const [day, n] = [...days.entries()].sort((a, b) => b[1] - a[1])[0];
        if (n / total >= share) {
            out.push({
                level: 'varning', kind: 'datumkluster', source: host,
                message: `${n} av ${total} kommande event ligger ${day} — sajtvitt datum i stället för eventets?`,
            });
        }
    }
    return out;
}

/**
 * Synliga kommande event på 0,0 — kartan filtrerar bort dem (osynliga). EN
 * samlad rad med de värsta värdarna; en rad per församling drunknade listan.
 */
export function detectNullIsland(hosts: string[], minTotal = 10, top = 5): { total: number; alerts: Alert[] } {
    const counts = new Map<string, number>();
    for (const h of hosts) counts.set(h, (counts.get(h) ?? 0) + 1);
    if (hosts.length < minTotal) return { total: hosts.length, alerts: [] };
    const worst = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, top)
        .map(([h, n]) => `${h} ${n}`).join(', ');
    return {
        total: hosts.length,
        alerts: [{
            level: 'varning', kind: 'nollkoordinat', source: `${hosts.length} event`,
            message: `utan koordinat (0,0), syns inte på kartan — värst: ${worst}`,
        }],
    };
}

/**
 * Norden-boxen: Ticketmaster-källan hämtar medvetet SE+NO+DK, så grannländerna
 * är hemma här. Utanför boxen är ett kommande event nästan säkert felgeokodat
 * eller utländskt innehåll på svensk plattform (billetto.se:s Mexiko-turer,
 * sedda 18/10) — och till skillnad från 0,0-eventen VISAS de på kartan.
 */
export const NORDEN_BOX = { latMin: 54, latMax: 72, lngMin: 4, lngMax: 32 };

/** Synliga kommande event med koordinater utanför Norden — EN samlad rad. */
export function detectForeignCoords(
    rows: { host: string; lat: number | null; lng: number | null }[],
    top = 5,
): Alert[] {
    const counts = new Map<string, number>();
    let total = 0;
    for (const r of rows) {
        if (r.lat == null || r.lng == null) continue;
        if (Math.abs(r.lat) < 0.01 && Math.abs(r.lng) < 0.01) continue; // 0,0 har egen rad
        const ute = r.lat < NORDEN_BOX.latMin || r.lat > NORDEN_BOX.latMax
            || r.lng < NORDEN_BOX.lngMin || r.lng > NORDEN_BOX.lngMax;
        if (!ute) continue;
        total++;
        counts.set(r.host, (counts.get(r.host) ?? 0) + 1);
    }
    if (total === 0) return [];
    const worst = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, top)
        .map(([h, n]) => `${h} ${n}`).join(', ');
    return [{
        level: 'varning', kind: 'utlandskoordinat', source: `${total} event`,
        message: `koordinater utanför Norden, syns på kartan — felgeokodat eller utländskt innehåll: ${worst}`,
    }];
}

export function quarantineAlerts(q: Record<string, { since?: string; reason?: string }>): Alert[] {
    return Object.entries(q).map(([id, e]) => ({
        level: 'varning' as const, kind: 'karantan' as const, source: id, since: e.since,
        message: `i karantän sedan ${e.since ?? '?'}: ${e.reason ?? ''}`.trim(),
    }));
}

/** Fel först, sedan varningar; inom nivå: krasch > tyst > volymras > datum > 0,0 > utland > invariant > karantän. */
export function sortAlerts(alerts: Alert[]): Alert[] {
    const kindOrder: AlertKind[] = ['krasch', 'tyst', 'volymras', 'datumkluster', 'nollkoordinat', 'utlandskoordinat', 'invariant', 'karantan'];
    return [...alerts].sort((a, b) =>
        (a.level === b.level ? 0 : a.level === 'fel' ? -1 : 1)
        || kindOrder.indexOf(a.kind) - kindOrder.indexOf(b.kind)
        || a.source.localeCompare(b.source, 'sv'));
}
