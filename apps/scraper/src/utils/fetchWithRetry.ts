/**
 * fetchWithRetry — robust fetch med exponential backoff.
 *
 * Beteende:
 *   - Max 3 försök (konfigurerbart)
 *   - Retry vid nätverksfel (connect refused, timeout) + statuskoderna nedan
 *   - Statuskoder som ej retriar: 4xx utom {408, 425, 429} — de returneras direkt
 *   - Backoff: baseDelay * 3^(attempt-1) × jitter(0.8–1.2)
 *   - Retry-After-header respekteras (sekunder eller HTTP-datum)
 *   - Yttre abort-signal (ctx.signal) avbryter omedelbart utan retry
 *   - Per-attempt timeout hanteras internt — engines behöver inte skapa egen AC
 *
 * Kalla med:
 *   const res = await fetchWithRetry(url, { headers: ... }, { signal: ctx.signal, timeoutPerAttemptMs: 20000, label: url });
 *   if (!res.ok) return null;  // caller hanterar !ok precis som förut
 */

export const RETRYABLE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

const MAX_RETRY_DELAY_MS = 30_000;

export interface FetchRetryOptions {
    /** Abort-signal från ctx — avbryter ALLA försök omedelbart. */
    signal?: AbortSignal;
    /** Timeout per försök i ms (default 20 000). */
    timeoutPerAttemptMs?: number;
    /** Max antal försök (default 3). */
    maxAttempts?: number;
    /** Bas-fördröjning i ms för backoff (default 500). */
    baseDelayMs?: number;
    /** Kortare URL/label som syns i retry-loggar. */
    label?: string;
}

/**
 * Kasta om abort-signalen är från den yttre signalen (vår caller vill avbryta),
 * men låt timeouts ge upphov till retry.
 */
function isOuterAbort(err: unknown, outerSignal?: AbortSignal): boolean {
    return !!(outerSignal?.aborted && (err as Error)?.name === 'AbortError');
}

function jitter(ms: number): number {
    return ms * (0.8 + Math.random() * 0.4);
}

async function sleep(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
        if (signal?.aborted) {
            reject(new DOMException('Aborted', 'AbortError'));
            return;
        }
        const t = setTimeout(resolve, ms);
        const onAbort = () => {
            clearTimeout(t);
            reject(new DOMException('Aborted', 'AbortError'));
        };
        signal?.addEventListener('abort', onAbort, { once: true });
    });
}

function retryDelayMs(attempt: number, baseDelay: number, retryAfterHeader: string | null): number {
    if (retryAfterHeader) {
        const seconds = parseFloat(retryAfterHeader);
        if (!isNaN(seconds) && seconds > 0) {
            return Math.min(seconds * 1000, MAX_RETRY_DELAY_MS);
        }
        const date = new Date(retryAfterHeader).getTime();
        if (!isNaN(date)) {
            const wait = date - Date.now();
            if (wait > 0) return Math.min(wait, MAX_RETRY_DELAY_MS);
        }
    }
    // Exponential backoff: 500ms → 1 500ms → 4 500ms, with jitter
    return jitter(baseDelay * Math.pow(3, attempt - 1));
}

export async function fetchWithRetry(
    url: string,
    init: Omit<RequestInit, 'signal'>,
    opts: FetchRetryOptions = {},
): Promise<Response> {
    const maxAttempts      = opts.maxAttempts        ?? 3;
    const baseDelay        = opts.baseDelayMs        ?? 500;
    const timeoutMs        = opts.timeoutPerAttemptMs ?? 20_000;
    const outerSignal      = opts.signal;
    const label            = opts.label
        ? ` [${opts.label.slice(0, 60)}]`
        : ` [${url.slice(0, 60)}]`;

    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        if (outerSignal?.aborted) {
            throw new DOMException('Aborted', 'AbortError');
        }

        // Per-attempt timeout — fresh AC each retry
        const ac = new AbortController();
        const timer = setTimeout(() => ac.abort(), timeoutMs);

        // Link outer signal → abort this attempt too
        const onOuterAbort = () => ac.abort();
        outerSignal?.addEventListener('abort', onOuterAbort, { once: true });

        try {
            const res = await fetch(url, { ...init, signal: ac.signal });

            // Non-retryable 4xx — return immediately, no logging
            if (res.status >= 400 && res.status < 500 && !RETRYABLE_STATUSES.has(res.status)) {
                return res;
            }

            // Success or 2xx/3xx
            if (!RETRYABLE_STATUSES.has(res.status)) {
                return res;
            }

            // Retryable status — return on last attempt
            if (attempt === maxAttempts) {
                return res;
            }

            const delay = retryDelayMs(attempt, baseDelay, res.headers.get('retry-after'));
            console.log(
                `  ⟳ retry ${attempt}/${maxAttempts}${label} — HTTP ${res.status}` +
                (delay >= 1000 ? ` (waiting ${(delay / 1000).toFixed(1)}s)` : ''),
            );
            await sleep(delay, outerSignal);

        } catch (err) {
            lastError = err;

            // Outer abort → propagate immediately
            if (isOuterAbort(err, outerSignal)) throw err;

            // Last attempt → rethrow
            if (attempt === maxAttempts) throw err;

            const reason = (err as Error)?.name === 'AbortError' ? 'timeout' : (err as Error)?.message ?? String(err);
            const delay = retryDelayMs(attempt, baseDelay, null);
            console.log(`  ⟳ retry ${attempt}/${maxAttempts}${label} — ${reason}`);
            await sleep(delay, outerSignal);

        } finally {
            clearTimeout(timer);
            outerSignal?.removeEventListener('abort', onOuterAbort);
        }
    }

    throw lastError ?? new Error('fetchWithRetry: exhausted all attempts');
}
