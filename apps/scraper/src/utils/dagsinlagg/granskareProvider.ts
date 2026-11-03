/**
 * granskareProvider.ts - modellanropet bakom granskaren. Bildrutor (JPEG)
 * + prompten (granskare.ts) in, modellens råa svar ut. Två vägar:
 *
 *   claude  - Claude API med bildinmatning (standard, kräver
 *             ANTHROPIC_API_KEY i ~/.vadkul-secrets/env). Bäst omdöme;
 *             sex rutor per klipp kostar ören.
 *   ollama  - qwen3-vl på minin (gratis, svagare). Reserv när nyckeln
 *             saknas eller DAGSINLAGG_GRANSKARE=ollama.
 */

import fs from 'fs';

export type Provider = 'claude' | 'ollama' | 'ingen';

const CLAUDE_MODEL = process.env.DAGSINLAGG_CLAUDE_MODEL ?? 'claude-sonnet-5-5';
const OLLAMA_URL = process.env.OLLAMA_URL ?? 'http://localhost:11434';
const OLLAMA_MODEL = process.env.DAGSINLAGG_OLLAMA_MODEL ?? 'qwen3-vl:4b';
const TIMEOUT_MS = 120_000;

export function valdProvider(): Provider {
    const v = (process.env.DAGSINLAGG_GRANSKARE ?? '').toLowerCase();
    if (v === 'ollama') return 'ollama';
    if (v === 'claude') return 'claude';
    if (v === 'ingen') return 'ingen';
    return process.env.ANTHROPIC_API_KEY ? 'claude' : 'ollama';
}

function base64(fil: string): string {
    return fs.readFileSync(fil).toString('base64');
}

async function claude(bildrutor: string[], prompt: string): Promise<string> {
    const nyckel = process.env.ANTHROPIC_API_KEY;
    if (!nyckel) throw new Error('ANTHROPIC_API_KEY saknas');
    const content: unknown[] = bildrutor.map(fil => ({
        type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64(fil) },
    }));
    content.push({ type: 'text', text: prompt });
    const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': nyckel, 'anthropic-version': '2023-06-01' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
        body: JSON.stringify({ model: CLAUDE_MODEL, max_tokens: 600, temperature: 0.2, messages: [{ role: 'user', content }] }),
    });
    const data = await res.json() as any;
    if (!res.ok || data.error) throw new Error(`Claude: ${data.error?.message ?? res.status}`);
    return (data.content ?? []).filter((c: any) => c.type === 'text').map((c: any) => c.text).join('\n');
}

async function ollama(bildrutor: string[], prompt: string): Promise<string> {
    const res = await fetch(`${OLLAMA_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(TIMEOUT_MS * 2),
        body: JSON.stringify({
            model: OLLAMA_MODEL, stream: false, think: false,
            options: { temperature: 0.1, num_predict: 500 },
            messages: [{ role: 'user', content: prompt, images: bildrutor.map(base64) }],
        }),
    });
    if (!res.ok) throw new Error(`Ollama: HTTP ${res.status}`);
    const data = await res.json() as any;
    return data?.message?.content ?? '';
}

/** 'ingen': godkänner allt med 75 (för provkörning utan modell, eller när
 *  Josef litar på sina egna klipp). Tema och textrader lämnas till filnamnet. */
function ingen(): string {
    return JSON.stringify({ tema: 'okant', betyg: 75, brott: [], textrader: [], motivering: 'ingen granskning (DAGSINLAGG_GRANSKARE=ingen)' });
}

/** Modellens råa svar; tolkas av tolkaOmdome i granskare.ts. */
export async function fragaGranskaren(bildrutor: string[], prompt: string, provider = valdProvider()): Promise<string> {
    if (provider === 'ingen') return ingen();
    return provider === 'claude' ? claude(bildrutor, prompt) : ollama(bildrutor, prompt);
}
