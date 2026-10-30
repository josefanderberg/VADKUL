/**
 * Tolka LLM-auditens JSON-svar (utils/llmAudit: eventauditen och GPS-auditen).
 *
 * Första {...}-blocket parsas som vanligt. Klipps svaret mitt i räddas de
 * fält som hann bli kompletta: qwen3 tystnar på vissa emoji (🏑 för
 * innebandy gav `..."categoryConfidence":"high","emoji":"` och sedan
 * ingenting), men verdict och kategori står först i svaret och saknad
 * emoji/pris får kategorins default som vanligt. Utan räddningen föll samma
 * event på "Kunde inte parsa" varje varv och täppte till audit-daemonens kö
 * (30/10: ~27 innebandymatcher först i kön, 24 000 ogranskade event).
 */

/** Ett komplett "nyckel": värde-par - strängen måste vara avslutad. */
const FÄLT = /"(\w+)"\s*:\s*("(?:[^"\\]|\\.)*"|true|false|null|-?\d+(?:\.\d+)?)/g;

export function parseLlmJson(raw: string): Record<string, unknown> | null {
    const start = raw.indexOf('{');
    if (start === -1) return null;
    const helt = raw.slice(start).match(/\{[\s\S]*\}/);
    if (helt) {
        try {
            return JSON.parse(helt[0]);
        } catch {
            // trasigt block - rädda fälten nedan
        }
    }
    const ut: Record<string, unknown> = {};
    for (const m of raw.slice(start).matchAll(FÄLT)) {
        try {
            ut[m[1]] = JSON.parse(m[2]);
        } catch {
            // ogiltig escape i strängen - hoppa över fältet
        }
    }
    return Object.keys(ut).length > 0 ? ut : null;
}
