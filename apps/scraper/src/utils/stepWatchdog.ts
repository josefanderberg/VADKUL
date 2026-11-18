/**
 * stepWatchdog — vakt mot tysta häng i nattkedjans långa steg.
 *
 * Bakgrund (18/11 2026): FB-svansen hängde 17/11 03:37 mitt i ett event
 * (0 % CPU, väntade på ett löfte som aldrig löstes) och låg kvar i 35 h.
 * launchd startar aldrig en ny körning medan den gamla lever, så natten
 * efter uteblev helt, och efterstegen (städning, kostnadsvakt, audit,
 * re-aggregate, datapushen, Telegram-rapporten) kördes inte någon av nätterna.
 *
 * Vakten mäter aktivitet som "något skrevs till stdout/stderr": FB-skrapan
 * loggar varje sida och varje event, så en halvtimme utan en enda rad är ett
 * häng, inte ett långsamt steg. En hård takgräns fångar det som loggar men
 * aldrig blir klart. När vakten slår till släpper kedjan steget och går
 * vidare; det hängda löftet lämnas och dör med processen (process.exit i
 * index.ts, där puppeteer också stänger sin Chrome).
 */

export type WatchdogVerdict = 'stall' | 'overtime' | null;
export type WatchdogOutcome = 'done' | 'stall' | 'overtime';

/** Ren regel: har steget hängt (tyst för länge) eller dragit över taket? */
export function watchdogVerdict(p: {
    now: number;
    startedAt: number;
    lastActivityAt: number;
    stallMs: number;
    maxMs: number;
}): WatchdogVerdict {
    if (p.now - p.startedAt > p.maxMs) return 'overtime';
    // Aktivitet före stegets start räknas inte: tystnaden mäts från det
    // senare av de två.
    const since = Math.max(p.startedAt, p.lastActivityAt);
    if (p.now - since > p.stallMs) return 'stall';
    return null;
}

interface Writable { write: (...args: any[]) => boolean }

/**
 * Spåra senaste skrivningen till strömmarna (console.log/-error går hit).
 * restore() lägger tillbaka de ursprungliga write-funktionerna.
 */
export function tapStreamActivity(
    streams: Writable[] = [process.stdout, process.stderr],
    now: () => number = Date.now,
): { lastActivityAt: () => number; restore: () => void } {
    let last = now();
    const originals = streams.map((s) => s.write);
    streams.forEach((s, i) => {
        const orig = originals[i];
        s.write = function (this: unknown, ...args: any[]) {
            last = now();
            return orig.apply(this, args);
        };
    });
    return {
        lastActivityAt: () => last,
        restore: () => streams.forEach((s, i) => { s.write = originals[i]; }),
    };
}

/**
 * Kör `work` men ge upp när vakten slår till. Ett fel i `work` bubblar
 * vidare som vanligt (runStep i index.ts fångar det).
 */
export async function runWithWatchdog(
    work: () => Promise<unknown>,
    opts: {
        stallMs: number;
        maxMs: number;
        lastActivityAt: () => number;
        checkEveryMs?: number;
        now?: () => number;
    },
): Promise<WatchdogOutcome> {
    const now = opts.now ?? Date.now;
    const startedAt = now();
    let timer: ReturnType<typeof setInterval> | undefined;
    const watchdog = new Promise<WatchdogOutcome>((resolve) => {
        timer = setInterval(() => {
            const verdict = watchdogVerdict({
                now: now(),
                startedAt,
                lastActivityAt: opts.lastActivityAt(),
                stallMs: opts.stallMs,
                maxMs: opts.maxMs,
            });
            if (verdict) resolve(verdict);
        }, opts.checkEveryMs ?? 60_000);
    });
    try {
        return await Promise.race([work().then((): WatchdogOutcome => 'done'), watchdog]);
    } finally {
        clearInterval(timer);
    }
}
