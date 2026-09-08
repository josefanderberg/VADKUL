import { describe, it, expect } from 'vitest';
import { isBlacklistedTitle } from './sitemap';

describe('skiplänkar som titel', () => {
    it('avvisar svenska hoppa-till-innehåll-varianter', () => {
        for (const t of ['Till innehållet', 'till innehallet', 'Hoppa till innehållet', 'Gå till huvudinnehållet']) {
            expect(isBlacklistedTitle(t)).toBe(true);
        }
    });

    it('avvisar engelsk skiplänk', () => {
        expect(isBlacklistedTitle('Skip to main content')).toBe(true);
        expect(isBlacklistedTitle('Skip to content')).toBe(true);
    });

    it('rör inte riktiga eventtitlar', () => {
        for (const t of ['Innehållet i höstens program', 'Till minne av Astrid', 'Enköpingsmässan']) {
            expect(isBlacklistedTitle(t)).toBe(false);
        }
    });
});
