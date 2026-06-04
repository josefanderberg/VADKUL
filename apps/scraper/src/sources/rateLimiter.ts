/**
 * Per-domän rate limiter.
 *
 * Vid 300+ scrapers vill vi inte hamras en sajt — varje engine kallar `wait(url)`
 * innan fetch. Begär per domän serialiseras till minst `minIntervalMs` mellan
 * varandra. Globalt sett kan vi köra många domäner parallellt.
 *
 * Default 1500 ms = max ~40 requests/min per domän, vänligt mot små sajter.
 */

const DEFAULT_INTERVAL_MS = 1500;

class DomainRateLimiter {
    private lastHit = new Map<string, number>();
    private pending = new Map<string, Promise<void>>();

    constructor(private minIntervalMs: number = DEFAULT_INTERVAL_MS) {}

    async wait(url: string): Promise<void> {
        let domain: string;
        try {
            domain = new URL(url).hostname;
        } catch {
            return; // dålig URL, släpp förbi
        }

        // Serialisera per domän: vänta på senaste pending och boka oss in
        const prev = this.pending.get(domain) ?? Promise.resolve();
        const next = prev.then(async () => {
            const last = this.lastHit.get(domain) ?? 0;
            const elapsed = Date.now() - last;
            if (elapsed < this.minIntervalMs) {
                await new Promise((r) => setTimeout(r, this.minIntervalMs - elapsed));
            }
            this.lastHit.set(domain, Date.now());
        });
        this.pending.set(domain, next);
        return next;
    }
}

/** Global instans — alla engines delar samma throttling. */
export const domainLimiter = new DomainRateLimiter(
    parseInt(process.env.SCRAPE_DOMAIN_INTERVAL_MS || String(DEFAULT_INTERVAL_MS), 10),
);
