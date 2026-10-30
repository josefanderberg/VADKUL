import { describe, it, expect } from 'vitest';
import { parseLlmJson } from './llmJson';

describe('parseLlmJson', () => {
    it('helt svar parsas som vanligt, även med text runt', () => {
        expect(parseLlmJson('Här: {"verdict":"ok","emoji":"🎵","price":null} klart')).toEqual({ verdict: 'ok', emoji: '🎵', price: null });
    });

    it('svaret som klipptes vid innebandyemojin 30/10 räddas', () => {
        const raw = '{"verdict":"ok","confidence":"high","inSweden":true,"reason":"Innebandymatch i Sverige",'
            + '"category":"sport","categoryConfidence":"high","emoji":"';
        expect(parseLlmJson(raw)).toEqual({
            verdict: 'ok',
            confidence: 'high',
            inSweden: true,
            reason: 'Innebandymatch i Sverige',
            category: 'sport',
            categoryConfidence: 'high',
        });
    });

    it('en halv sträng tas inte med', () => {
        expect(parseLlmJson('{"verdict":"ok","reason":"Konsert i Väx')).toEqual({ verdict: 'ok' });
    });

    it('escapade citattecken och tal klarar räddningen', () => {
        expect(parseLlmJson('{"reason":"Kören \\"Vox\\" sjunger","n":12,"emoji":"')).toEqual({ reason: 'Kören "Vox" sjunger', n: 12 });
    });

    it('trasigt men slutet block räddar de giltiga fälten', () => {
        expect(parseLlmJson('{"verdict":"ok","category":"music",,}')).toEqual({ verdict: 'ok', category: 'music' });
    });

    it('inget block eller inga fält = null', () => {
        expect(parseLlmJson('Jag kan inte svara på det.')).toBeNull();
        expect(parseLlmJson('{"verdict":')).toBeNull();
    });
});
