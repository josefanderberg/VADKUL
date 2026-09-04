/**
 * Parallellism mot Ollama för nattkedjans LLM-steg (K4 llm-enrich, K8 audit).
 *
 * Stegen körde ett event i taget: upp till 500 + 500 anrop à 10–40 s på minin
 * = flera timmar per natt. OLLAMA_CONCURRENCY (default 3) styr hur många
 * anrop som skickas samtidigt.
 *
 * Servern måste tillåta det: Ollama ≥ 0.2 sätter OLLAMA_NUM_PARALLEL till 4
 * automatiskt om minnet räcker, annars 1. Vid 1 köas anropen på servern och
 * tar lika lång tid som sekventiellt — därför skalas timeouten med
 * parallelliteten så köade anrop inte avbryts i onödan. Sätt explicit på minin:
 *   launchctl setenv OLLAMA_NUM_PARALLEL 3   (+ starta om Ollama-appen)
 */

function clamp(n: number, lo: number, hi: number): number {
    return Math.min(hi, Math.max(lo, n));
}

export function ollamaConcurrencyFrom(raw: string | undefined): number {
    const n = parseInt(raw ?? '', 10);
    return Number.isFinite(n) && n > 0 ? clamp(n, 1, 8) : 3;
}

export const OLLAMA_CONCURRENCY = ollamaConcurrencyFrom(process.env.OLLAMA_CONCURRENCY);

/** Per-anrop-timeout: 30 s per plats i kön, så ett anrop som köas bakom
 *  (concurrency − 1) andra på en serialiserande server ändå hinner fram. */
export const OLLAMA_TIMEOUT_MS = 30_000 * OLLAMA_CONCURRENCY;

/** Dela upp i bitar om `size` (sista biten kan vara kortare). */
export function chunk<T>(items: readonly T[], size: number): T[][] {
    const n = Math.max(1, Math.floor(size));
    const out: T[][] = [];
    for (let i = 0; i < items.length; i += n) out.push(items.slice(i, i + n));
    return out;
}

/** Kör `fn` över `items` med högst `concurrency` samtidigt; resultat i
 *  ursprunglig ordning. */
export async function mapWithConcurrency<T, R>(
    items: readonly T[],
    concurrency: number,
    fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
    const results: R[] = new Array(items.length);
    let next = 0;
    const workers = Array.from({ length: Math.max(1, Math.min(concurrency, items.length)) }, async () => {
        while (next < items.length) {
            const i = next++;
            results[i] = await fn(items[i], i);
        }
    });
    await Promise.all(workers);
    return results;
}
