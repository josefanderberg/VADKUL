/**
 * K4: Lokal AI-granskning via Ollama.
 * Används som post-processor på events där lat=0,lng=0 (isLocationVerified=false).
 *
 * Modell: qwen3:8b (5.2 GB, bäst på svensk text och reasoning)
 * Kräver: Ollama körs på localhost:11434
 */

const OLLAMA_URL = process.env.OLLAMA_URL ?? 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? 'qwen3:8b';
const TIMEOUT_MS = 30_000;

export interface LlmEnrichResult {
    locationCandidate: string | null;
    city: string | null;
    category: string;
    isJunk: boolean;
    confidence: 'high' | 'medium' | 'low' | 'none';
    raw?: string;
}

async function callOllama(prompt: string): Promise<string | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
        const res = await fetch(`${OLLAMA_URL}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
                model: OLLAMA_MODEL,
                stream: false,
                think: false,
                options: { temperature: 0.1, num_predict: 256 },
                messages: [{ role: 'user', content: prompt }]
            })
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

const VALID_CATEGORIES = new Set([
    'music', 'performing-arts', 'comedy', 'market', 'sport',
    'education', 'art', 'social', 'food-drink', 'family', 'other'
]);

function parseJson(raw: string): any | null {
    try {
        const match = raw.match(/\{[\s\S]*\}/);
        return match ? JSON.parse(match[0]) : null;
    } catch {
        return null;
    }
}

function normalizeConfidence(v: unknown): LlmEnrichResult['confidence'] {
    if (typeof v === 'number') {
        if (v >= 0.75) return 'high';
        if (v >= 0.45) return 'medium';
        if (v > 0) return 'low';
        return 'none';
    }
    const s = String(v).toLowerCase();
    if (['high', 'medium', 'low', 'none'].includes(s)) return s as LlmEnrichResult['confidence'];
    return 'none';
}

function normalizeCategory(v: unknown): string {
    if (typeof v !== 'string') return 'other';
    const lower = v.toLowerCase();
    if (VALID_CATEGORIES.has(lower)) return lower;
    // Fuzzy mapping for common model variants
    if (/dansfest|dance|dans/.test(lower)) return 'performing-arts';
    if (/musik|music|konsert|concert/.test(lower)) return 'music';
    if (/festival/.test(lower)) return 'music';
    if (/quiz|pub/.test(lower)) return 'social';
    if (/sport|träning/.test(lower)) return 'sport';
    return 'other';
}

/**
 * Extraherar en platskandidat ur beskrivningen och klassificerar eventet.
 * Returnerar null för locationCandidate om ingen specifik plats hittas.
 */
export async function llmEnrichEvent(
    title: string,
    description: string,
    extractedAddress: string
): Promise<LlmEnrichResult> {
    const fallback: LlmEnrichResult = {
        locationCandidate: null, city: null, category: 'other',
        isJunk: false, confidence: 'none'
    };

    if (!title && !description) return fallback;

    const desc = (description || '').slice(0, 600);
    const prompt = `Svara BARA med JSON. Event: "${title}". Adress: "${extractedAddress || ''}". Beskrivning: "${desc}".
Ge JSON: {"location": <plats/adress ur texten eller null>, "city": <stad eller null>, "category": <EN av: music/performing-arts/comedy/market/sport/education/art/social/food-drink/family/other>, "isJunk": <true/false>, "confidence": <high/medium/low/none>}`;

    const raw = await callOllama(prompt);
    if (!raw) return fallback;

    const parsed = parseJson(raw);
    if (!parsed) return { ...fallback, raw };

    return {
        locationCandidate: typeof parsed.location === 'string' && parsed.location !== 'null' ? parsed.location : null,
        city: typeof parsed.city === 'string' && parsed.city !== 'null' ? parsed.city : null,
        category: normalizeCategory(parsed.category),
        isJunk: parsed.isJunk === true,
        confidence: normalizeConfidence(parsed.confidence),
        raw,
    };
}

export async function ollamaIsAvailable(): Promise<boolean> {
    try {
        const res = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(3000) });
        return res.ok;
    } catch {
        return false;
    }
}
