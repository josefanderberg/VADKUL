/**
 * granskareProvider.ts - modellanropet bakom granskaren. Bildrutor (JPEG)
 * + prompten (granskare.ts) in, modellens råa svar ut. Två vägar:
 *
 *   claude  - Claude API med bildinmatning via det officiella SDK:t
 *             (standard, kräver ANTHROPIC_API_KEY i ~/.vadkul-secrets/env).
 *             Bäst omdöme. 6-11 rutor à 540x960 ≈ 7 000 tokens in per klipp,
 *             runt 25 öre med Sonnet 5.5; varje anrop loggar sin kostnad.
 *   ollama  - qwen3-vl på minin (gratis, svagare). Reserv när nyckeln
 *             saknas eller DAGSINLAGG_GRANSKARE=ollama.
 */

import fs from 'fs';
import Anthropic from '@anthropic-ai/sdk';

export type Provider = 'claude' | 'ollama' | 'ingen';

const CLAUDE_MODEL = process.env.DAGSINLAGG_CLAUDE_MODEL ?? 'claude-sonnet-5-5';
const OLLAMA_URL = process.env.OLLAMA_URL ?? 'http://localhost:11434';
const OLLAMA_MODEL = process.env.DAGSINLAGG_OLLAMA_MODEL ?? 'qwen3-vl:4b';
const TIMEOUT_MS = 120_000;
/** Plats för modellens tänkande + JSON-svaret (600 räckte inte: Sonnet 5.5
 *  tänker alltid, och tänkandet räknas mot max_tokens). */
const CLAUDE_MAX_TOKENS = 4000;
/** Pris per miljon tokens (in, ut) för loggraden. Ändras priset: byt här. */
const PRIS_USD: Record<string, [number, number]> = {
    'claude-sonnet-5-5': [2, 10], 'claude-haiku-5-5': [0.1, 0.5], 'claude-opus-5-5': [4, 20],
};
const SEK_PER_USD = 10.5;
/** Modeller som tar serverns fallback vid avböjande ('default' väljer modell själv). */
const MED_FALLBACK = new Set(['claude-sonnet-5-5', 'claude-opus-5-5', 'claude-opus-5', 'claude-fable-5-1']);

/** Kostnaden för ett anrop i öre (för loggen, inte för fakturan). */
export function kostnadOre(modell: string, inTokens: number, utTokens: number): number | null {
    const p = PRIS_USD[modell];
    if (!p) return null;
    return ((inTokens * p[0] + utTokens * p[1]) / 1_000_000) * SEK_PER_USD * 100;
}

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

/**
 * Claude via SDK:t. Ingen temperature (Sonnet 5.5 svarar 400 på andra
 * värden än standard), effort medium räcker för att bedöma bildrutor mot en
 * fast rubrik. Avböjer modellen tar serverns fallback över ('default').
 */
async function claude(bildrutor: string[], prompt: string): Promise<string> {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY saknas');
    const client = new Anthropic({ timeout: TIMEOUT_MS, maxRetries: 2 });
    const content: Anthropic.Beta.Messages.BetaContentBlockParam[] = [
        ...bildrutor.map(fil => ({
            type: 'image' as const,
            source: { type: 'base64' as const, media_type: 'image/jpeg' as const, data: base64(fil) },
        })),
        { type: 'text' as const, text: prompt },
    ];
    const svar = await client.beta.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: CLAUDE_MAX_TOKENS,
        output_config: { effort: 'medium' },
        ...(MED_FALLBACK.has(CLAUDE_MODEL) ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
        messages: [{ role: 'user', content }],
    });
    const ore = kostnadOre(svar.model, svar.usage.input_tokens, svar.usage.output_tokens);
    console.log(`[granskare] ${svar.model}: ${svar.usage.input_tokens} tokens in, ${svar.usage.output_tokens} ut${ore === null ? '' : ` (ca ${ore.toFixed(1)} öre)`}`);
    if (svar.stop_reason === 'refusal') throw new Error(`Claude avböjde (${svar.stop_details?.category ?? 'okänd orsak'})`);
    if (svar.stop_reason === 'max_tokens') throw new Error('Claude: svaret kapades vid max_tokens');
    return svar.content
        .filter((b): b is Anthropic.Beta.Messages.BetaTextBlock => b.type === 'text')
        .map(b => b.text)
        .join('\n');
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
