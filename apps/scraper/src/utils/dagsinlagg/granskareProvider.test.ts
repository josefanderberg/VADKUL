import { describe, it, expect, afterEach } from 'vitest';
import { kostnadOre, valdProvider } from './granskareProvider';

describe('kostnadOre', () => {
    it('Sonnet 5.5: ett 30-sekundersklipp (11 rutor) kostar runt 25 öre', () => {
        // 7 000 in à $2/M + 1 000 ut à $10/M = $0,024 = 25,2 öre vid 10,5 kr/$.
        expect(kostnadOre('claude-sonnet-5-5', 7000, 1000)).toBeCloseTo(25.2, 1);
    });

    it('Haiku 5.5 är runt tjugo gånger billigare', () => {
        expect(kostnadOre('claude-haiku-5-5', 7000, 1000)).toBeCloseTo(1.26, 2);
    });

    it('okänd modell: ingen gissning', () => {
        expect(kostnadOre('claude-okand', 1, 1)).toBeNull();
    });
});

describe('valdProvider', () => {
    const spara = { g: process.env.DAGSINLAGG_GRANSKARE, k: process.env.ANTHROPIC_API_KEY };
    afterEach(() => {
        if (spara.g === undefined) delete process.env.DAGSINLAGG_GRANSKARE; else process.env.DAGSINLAGG_GRANSKARE = spara.g;
        if (spara.k === undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = spara.k;
    });

    it('utan val: Claude om nyckeln finns, annars Ollama', () => {
        delete process.env.DAGSINLAGG_GRANSKARE;
        process.env.ANTHROPIC_API_KEY = 'test';
        expect(valdProvider()).toBe('claude');
        delete process.env.ANTHROPIC_API_KEY;
        expect(valdProvider()).toBe('ollama');
    });

    it('DAGSINLAGG_GRANSKARE vinner (ingen = lita på egna klipp)', () => {
        process.env.ANTHROPIC_API_KEY = 'test';
        process.env.DAGSINLAGG_GRANSKARE = 'ingen';
        expect(valdProvider()).toBe('ingen');
        process.env.DAGSINLAGG_GRANSKARE = 'Ollama';
        expect(valdProvider()).toBe('ollama');
    });
});
