/**
 * Vänteläge för event som audit-daemonen inte fick något svar för.
 *
 * Daemonen tar alltid de tidigaste ogranskade eventen. Ett event som
 * fallerade varje gång stod därför först i kön för evigt: 30/10 tog ~27
 * innebandymatcher över halva varje batch (33 min för 23 nya event) och kön
 * på 24 000 krympte aldrig. Nu väntar ett fallerat event 30 min, sedan 2 h,
 * 8 h och högst ett dygn innan nästa försök. Lyckas det släpps det.
 *
 * Bara i minnet: en omstart ger alla ett nytt försök, och ett kort
 * Ollama-avbrott kostar de drabbade eventen högst en halvtimme.
 */

export const BACKOFF_START_MS = 30 * 60_000;
export const BACKOFF_MAX_MS = 24 * 3_600_000;

/** Väntetiden efter `fails` misslyckanden i rad: 30 min · 4^(n-1), högst ett dygn. */
export function backoffMs(fails: number): number {
    return Math.min(BACKOFF_MAX_MS, BACKOFF_START_MS * 4 ** Math.max(0, fails - 1));
}

export class AuditBackoff {
    private readonly entries = new Map<string, { fails: number; retryAt: number }>();

    /** Registrera ett misslyckande; returnerar väntetiden i ms. */
    failed(url: string, now: number): number {
        const fails = (this.entries.get(url)?.fails ?? 0) + 1;
        const wait = backoffMs(fails);
        this.entries.set(url, { fails, retryAt: now + wait });
        return wait;
    }

    succeeded(url: string): void {
        this.entries.delete(url);
    }

    waiting(url: string, now: number): boolean {
        const e = this.entries.get(url);
        return !!e && e.retryAt > now;
    }

    /** Antal event som väntar just nu - så många extra rader måste batchfrågan hämta. */
    waitingCount(now: number): number {
        let n = 0;
        for (const e of this.entries.values()) if (e.retryAt > now) n++;
        return n;
    }

    /** De första `size` raderna (kön är tidsordnad) som inte väntar. */
    pick<T extends { url: string }>(rows: readonly T[], size: number, now: number): T[] {
        return rows.filter(r => !this.waiting(r.url, now)).slice(0, size);
    }
}
