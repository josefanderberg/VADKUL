/**
 * LLM-baserad audit av events: använder Ollama (qwen3:8b) för att bedöma
 * om eventet ser legitimt ut.
 *
 * Granskar:
 *   - Är platsen i Sverige?
 *   - Verkar titel/beskrivning hänga ihop?
 *   - Junk (cookie-banner, kommunsida, trafikinfo, formulär osv)?
 *   - Verkar locationName vara en riktig plats eller bara generiskt ord?
 *
 * Returnerar verdict + reason så vi kan visa det i admin-UI.
 *
 * Modell: qwen3:8b (text-only). För bildgranskning behövs llama3.2-vision.
 */

const OLLAMA_URL = process.env.OLLAMA_URL ?? 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_AUDIT_MODEL ?? process.env.OLLAMA_MODEL ?? 'qwen3:8b';
const TIMEOUT_MS = 30_000;

export type AuditVerdict = 'ok' | 'suspect' | 'junk';

export interface AuditInput {
    title: string;
    locationName?: string;
    extractedAddress?: string;
    description?: string;
    hostName?: string;
    url: string;
}

export interface AuditResult {
    verdict: AuditVerdict;
    confidence: 'high' | 'medium' | 'low';
    reason: string;
    inSweden: boolean;
    raw?: string;
}

async function callOllama(prompt: string): Promise<string | null> {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);
    try {
        const res = await fetch(`${OLLAMA_URL}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: ac.signal,
            body: JSON.stringify({
                model: OLLAMA_MODEL,
                stream: false,
                think: false,
                options: { temperature: 0.1, num_predict: 300 },
                messages: [{ role: 'user', content: prompt }],
            }),
        });
        if (!res.ok) return null;
        const data = await res.json();
        return data?.message?.content ?? null;
    } catch {
        return null;
    } finally {
        clearTimeout(timer);
    }
}

export async function ollamaIsAvailable(): Promise<boolean> {
    try {
        const res = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(3000) });
        return res.ok;
    } catch {
        return false;
    }
}

const PROMPT_TEMPLATE = (e: AuditInput) => `Du granskar event för en svensk eventaggregator. Den här veckan i Sverige.

EVENT:
- Titel: "${e.title}"
- Plats: "${e.locationName || '(saknas)'}"
- Adress: "${e.extractedAddress || '(saknas)'}"
- Arrangör: "${e.hostName || '(saknas)'}"
- Beskrivning: "${(e.description || '').slice(0, 600)}"
- URL: ${e.url}

Bedöm:
1. verdict — "ok" om det är ett riktigt evenemang i Sverige som folk kan gå på. "suspect" om det är oklart (t.ex. ofullständig info, men kunde vara legit). "junk" om det INTE är ett evenemang (cookie-banner, sökresultatsida, "Startsida", trafikinfo, kommunsida, eller event i annat land som felaktigt markerats som svenskt).
2. confidence — "high" om du är säker. "medium"/"low" annars.
3. inSweden — true/false. Är platsen i Sverige? Var noggrann med platsindikatorer i adress/beskrivning. Om text säger "Berlin", "Copenhagen", "Polska", "Manchester" etc → false.
4. reason — kort förklaring (max 15 ord, svenska).

Svara BARA med JSON, inga extra tecken: {"verdict":"ok|suspect|junk","confidence":"high|medium|low","inSweden":true|false,"reason":"..."}`;

function parseJson(raw: string): Partial<AuditResult> | null {
    // Plocka första {...}-blocket
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try {
        return JSON.parse(m[0]);
    } catch {
        return null;
    }
}

export async function auditEvent(e: AuditInput): Promise<AuditResult> {
    const prompt = PROMPT_TEMPLATE(e);
    const raw = await callOllama(prompt);
    if (!raw) {
        return { verdict: 'suspect', confidence: 'low', reason: 'LLM-anrop misslyckades', inSweden: true };
    }
    const parsed = parseJson(raw);
    if (!parsed || !parsed.verdict) {
        return { verdict: 'suspect', confidence: 'low', reason: 'Kunde inte parsa LLM-svar', inSweden: true, raw };
    }
    return {
        verdict: (['ok', 'suspect', 'junk'].includes(parsed.verdict as string) ? parsed.verdict : 'suspect') as AuditVerdict,
        confidence: (['high', 'medium', 'low'].includes(parsed.confidence as string) ? parsed.confidence : 'low') as AuditResult['confidence'],
        reason: (parsed.reason || '').toString().slice(0, 150),
        inSweden: parsed.inSweden !== false,
        raw,
    };
}
